import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { normaliseHeader, parseCsv } from "@/lib/csv";
import type { Dictionary } from "@/lib/i18n/types";
import { interpolate } from "@/lib/i18n/format";
import {
  codePrefixOf,
  formatEntityCode,
  sequenceFromCode,
} from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { currentSchoolId } from "@/lib/scope";
import { withFamilyPrefix } from "@/modules/families/validation";
// The owners of these invariants, called rather than reimplemented: the fee
// schedule comes from the price list and the status is derived, and the import
// is bound by both exactly as the enrolment form is.
import { generateFeeSchedule } from "@/modules/enrolment/service";
import { refreshHouseholdAccess } from "@/modules/families/service";
import { refreshStudentStatus } from "@/modules/students/service";
import { subscriptionScopeKey } from "@/modules/transport/enums";
import { IMPORT_COLUMNS, matchHeaders, type ImportColumn } from "@/modules/imports/columns";
import {
  parseBoolean,
  parseEmail,
  parseGender,
  parseImportDate,
  parsePhone,
  parseText,
} from "@/modules/imports/parse";

/**
 * Planning and committing a pupil import.
 *
 * ── The plan is never trusted ────────────────────────────────────────────────
 * `planImport` reads and writes nothing; `commitImport` re-plans the same file
 * from scratch and writes only what its own plan says. The browser sends the
 * file, never the verdict — otherwise a crafted request could post a "plan" that
 * skipped the duplicate checks and the school scoping, which is the whole point
 * of them. Re-planning costs one extra parse of a file the school waited a
 * fortnight to assemble; it is not a cost worth arguing about.
 *
 * ── What a school gets wrong, and what happens ───────────────────────────────
 * Every problem is attached to the line and the column it is in, because "row 12
 * is invalid" sends a secretary hunting across twenty-four cells. A row with any
 * error is rejected on its own and the rest of the file still loads: an import
 * that refuses four hundred good pupils over three bad ones is an import nobody
 * runs twice.
 */

export type ImportIssue = {
  /** Column key, or null when the problem is with the row as a whole. */
  column: string | null;
  message: string;
};

export type ImportOutcome = "CREATE" | "SKIP" | "REJECT";

/**
 * What a row's names resolved to.
 *
 * The file names a level, a class and a bus line the way the school says them
 * out loud; these are what they turned out to be. Resolved during planning so
 * the preview can show a secretary that "3AP-A" was understood *before* four
 * hundred pupils are seated in it.
 */
export type ResolvedRefs = {
  levelOfferingId?: string;
  /** The level as it will be shown back, e.g. "3AP" or "2BAC SM". */
  levelLabel?: string;
  schoolClassId?: string;
  classLabel?: string;
  routeId?: string;
  stopId?: string;
};

export type ImportRowPlan = {
  /** Line number as Excel shows it — the header is line 1. */
  line: number;
  outcome: ImportOutcome;
  /** Parsed, display-ready values, keyed by column. What will be written. */
  values: Record<string, string>;
  issues: ImportIssue[];
  /** The dossier this row will land in; several rows share one. */
  familyKey: string;
  /** Set when the family already exists, so the preview can say "attached to". */
  existingFamilyCode?: string;
  /** Empty when the row names no level — the pupil's file opens unseated. */
  refs: ResolvedRefs;
  /** True when this row will also produce an inscription and its échéancier. */
  enrols: boolean;
};

export type ImportPlan = {
  rows: ImportRowPlan[];
  /** Columns in the file the app has no home for. Shown, never fatal. */
  unknownHeaders: string[];
  /** Required columns the file is missing entirely — this alone blocks. */
  missingColumns: string[];
  counts: {
    create: number;
    skip: number;
    reject: number;
    /** Distinct dossiers the file will open. */
    newFamilies: number;
    /** Rows that also produce an inscription, and therefore an échéancier. */
    enrol: number;
  };
};

/** The most rows one file may carry. */
const MAX_ROWS = 3000;

/**
 * Everything the file can name, read once.
 *
 * A four-hundred-row file naming a dozen distinct classes would otherwise be
 * four hundred lookups; the school's whole set of levels, classes and bus lines
 * is a few dozen rows, so it is cheaper to hold all of it than to query per row.
 *
 * Every list is keyed by *several* spellings — a code, a name, an Arabic name —
 * because the whole point is that the secretary writes what they already say.
 * `available` is carried alongside so an unrecognised value can be answered with
 * "here is what does exist" rather than a bare refusal.
 */
type References = {
  levelOfferings: Map<string, { id: string; label: string }>;
  levelsAvailable: string[];
  /** Keyed `${levelOfferingId}:${spelling}` — a class is only valid in its level. */
  classes: Map<string, { id: string; label: string }>;
  classesByOffering: Map<string, string[]>;
  routes: Map<string, { id: string; label: string }>;
  routesAvailable: string[];
  /** Keyed `${routeId}:${spelling}`. */
  stops: Map<string, { id: string; label: string }>;
  stopsByRoute: Map<string, string[]>;
};

/** Adds every spelling of a thing to the index, ignoring blanks. */
function index<T>(map: Map<string, T>, spellings: (string | null)[], value: T) {
  for (const spelling of spellings) {
    const key = normaliseHeader(spelling ?? "");
    if (key !== "") map.set(key, value);
  }
}

async function loadReferences(
  schoolId: string,
  schoolYearId: string | null,
): Promise<References> {
  const refs: References = {
    levelOfferings: new Map(),
    levelsAvailable: [],
    classes: new Map(),
    classesByOffering: new Map(),
    routes: new Map(),
    routesAvailable: [],
    stops: new Map(),
    stopsByRoute: new Map(),
  };

  if (schoolYearId) {
    const offerings = await db.levelOffering.findMany({
      where: { schoolYearId, isActive: true },
      select: {
        id: true,
        level: { select: { code: true, name: true, nameAr: true } },
        track: { select: { code: true, name: true, nameAr: true } },
        classes: { select: { id: true, code: true, name: true } },
      },
    });

    for (const offering of offerings) {
      // "3AP" for primaire, "2BAC SM" where the level is streamed — the label a
      // school writes on a door and therefore the one it writes in Excel.
      const label = offering.track
        ? `${offering.level.code} ${offering.track.code}`
        : offering.level.code;
      refs.levelsAvailable.push(label);

      const spellings = offering.track
        ? [
            label,
            `${offering.level.code}-${offering.track.code}`,
            `${offering.level.name} ${offering.track.name}`,
          ]
        : [
            offering.level.code,
            offering.level.name,
            offering.level.nameAr,
          ];
      index(refs.levelOfferings, spellings, { id: offering.id, label });

      const classLabels: string[] = [];
      for (const schoolClass of offering.classes) {
        classLabels.push(schoolClass.code);
        // Namespaced by the offering: "A" means a different room in 3AP than in
        // 4AP, and a bare code would seat a child in whichever was read first.
        index(
          refs.classes,
          [schoolClass.code, schoolClass.name].map((spelling) =>
            spelling ? `${offering.id}:${spelling}` : null,
          ),
          { id: schoolClass.id, label: schoolClass.code },
        );
      }
      refs.classesByOffering.set(offering.id, classLabels);
    }
  }

  // Lines belong to a year, not to the school — a circuit is opened, run and
  // retired within one, so with no year in context there is nothing to match.
  const routes = schoolYearId
    ? await db.transportRoute.findMany({
        where: { schoolYearId, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          nameAr: true,
          stops: { select: { id: true, name: true, nameAr: true } },
        },
      })
    : [];

  for (const route of routes) {
    refs.routesAvailable.push(route.name);
    index(refs.routes, [route.code, route.name, route.nameAr], {
      id: route.id,
      label: route.name,
    });

    const stopLabels: string[] = [];
    for (const stop of route.stops) {
      stopLabels.push(stop.name);
      index(
        refs.stops,
        [stop.name, stop.nameAr].map((s) => (s ? `${route.id}:${s}` : null)),
        { id: stop.id, label: stop.name },
      );
    }
    refs.stopsByRoute.set(route.id, stopLabels);
  }

  return refs;
}

/**
 * Turns a row's level, class, line and stop into ids.
 *
 * Anything named and not found is an error on that cell rather than a silent
 * null: a pupil quietly imported without the class the file put them in is a
 * pupil somebody has to find again in September. The message names what *does*
 * exist, because the usual cause is a spelling the school changed in the app and
 * not in the spreadsheet.
 */
function resolveRow(
  values: Record<string, string>,
  refs: References,
  hasYear: boolean,
  t: Dictionary,
  issues: ImportIssue[],
): ResolvedRefs {
  const resolved: ResolvedRefs = {};

  const levelText = values.levelCode;
  if (!levelText) return resolved;

  if (!hasYear) {
    issues.push({ column: "levelCode", message: t.imports.errors.noSchoolYear });
    return resolved;
  }

  // The stream, when the school splits it out into its own column.
  const combined = values.trackCode
    ? `${levelText} ${values.trackCode}`
    : levelText;
  const offering =
    refs.levelOfferings.get(normaliseHeader(combined)) ??
    refs.levelOfferings.get(normaliseHeader(levelText));

  if (!offering) {
    issues.push({
      column: "levelCode",
      message: interpolate(t.imports.errors.unknownLevel, {
        value: combined,
        available: refs.levelsAvailable.join(", ") || "—",
      }),
    });
    return resolved;
  }

  resolved.levelOfferingId = offering.id;
  resolved.levelLabel = offering.label;

  if (values.className) {
    const found = refs.classes.get(
      normaliseHeader(`${offering.id}:${values.className}`),
    );
    if (!found) {
      issues.push({
        column: "className",
        message: interpolate(t.imports.errors.unknownClass, {
          value: values.className,
          level: offering.label,
          available:
            (refs.classesByOffering.get(offering.id) ?? []).join(", ") || "—",
        }),
      });
    } else {
      resolved.schoolClassId = found.id;
      resolved.classLabel = found.label;
    }
  }

  // A line named at all means the bus, whatever the Transport column says — the
  // school wrote a circuit down because the child rides it.
  if (values.routeName) {
    const route = refs.routes.get(normaliseHeader(values.routeName));
    if (!route) {
      issues.push({
        column: "routeName",
        message: interpolate(t.imports.errors.unknownRoute, {
          value: values.routeName,
          available: refs.routesAvailable.join(", ") || "—",
        }),
      });
    } else {
      resolved.routeId = route.id;

      if (values.stopName) {
        const stop = refs.stops.get(
          normaliseHeader(`${route.id}:${values.stopName}`),
        );
        if (!stop) {
          issues.push({
            column: "stopName",
            message: interpolate(t.imports.errors.unknownStop, {
              value: values.stopName,
              route: route.label,
              available:
                (refs.stopsByRoute.get(route.id) ?? []).join(", ") || "—",
            }),
          });
        } else {
          resolved.stopId = stop.id;
        }
      }
    }
  }

  return resolved;
}

/**
 * Reads a file into a plan, touching nothing.
 *
 * The duplicate check runs against the school in context and against the file
 * itself: a list assembled from two sources routinely names the same child
 * twice, and catching it only in the database would let the first copy through
 * and then reject the second for colliding with it.
 */
export async function planImport(
  context: AuthContext,
  csvText: string,
  t: Dictionary,
): Promise<ImportPlan> {
  const schoolId = currentSchoolId(context);
  const grid = parseCsv(csvText);

  if (grid.length === 0) {
    return emptyPlan([], [t.imports.errors.emptyFile]);
  }

  const [headerRow, ...bodyRows] = grid;
  const mapping = matchHeaders(headerRow, t);

  const unknownHeaders = headerRow.filter((_, index) => mapping[index] === null);

  const present = new Set(
    mapping.filter((column): column is ImportColumn => column !== null).map((c) => c.key),
  );
  const missingColumns = IMPORT_COLUMNS.filter(
    (column) => column.required && !present.has(column.key),
  ).map((column) => t.imports.columns[column.labelKey]);

  if (missingColumns.length > 0) {
    return emptyPlan(unknownHeaders, [], missingColumns);
  }

  const rows = bodyRows.slice(0, MAX_ROWS);

  // The year in context is the one pupils are enrolled into. A file naming a
  // level with no year selected is answered per row rather than refused whole —
  // its identity columns are still perfectly importable.
  const schoolYearId = context.currentSchoolYear?.id ?? null;
  const hasYear = schoolYearId !== null;
  const references = await loadReferences(schoolId, schoolYearId);

  // ── Everything the duplicate check needs, in two reads rather than 2n ──────
  const existing = await db.student.findMany({
    where: { schoolId },
    select: { code: true, massarCode: true, firstName: true, lastName: true },
  });
  const takenMassar = new Map(
    existing
      .filter((s): s is typeof s & { massarCode: string } => s.massarCode !== null)
      .map((s) => [s.massarCode.toUpperCase(), s]),
  );
  const takenCode = new Map(existing.map((s) => [s.code.toUpperCase(), s]));

  const existingFamilies = await db.family.findMany({
    where: { schoolId },
    select: { code: true, name: true },
  });
  const familyByName = new Map(
    existingFamilies.map((family) => [familyKeyOf(family.name), family.code]),
  );

  // Seen within this file, so the second copy of a child is caught too.
  const seenMassar = new Map<string, number>();
  const seenCode = new Map<string, number>();
  const newFamilyKeys = new Set<string>();

  const planned: ImportRowPlan[] = rows.map((cells, index) => {
    const line = index + 2; // header is line 1
    const issues: ImportIssue[] = [];
    const values: Record<string, string> = {};

    // ── Parse every mapped cell ────────────────────────────────────────────
    for (let i = 0; i < mapping.length; i += 1) {
      const column = mapping[i];
      if (!column) continue;
      const raw = cells[i] ?? "";
      const parsed = parseCell(column, raw, t, issues);
      if (parsed !== null) values[column.key] = parsed;
    }

    for (const column of IMPORT_COLUMNS) {
      if (column.required && !values[column.key]) {
        issues.push({
          column: column.key,
          message: interpolate(t.imports.errors.requiredColumn, {
            column: t.imports.columns[column.labelKey],
          }),
        });
      }
    }

    // Canonicalised before it is matched or written, so a sheet listing
    // "Bennis" attaches to the "Famille Bennis" already on file rather than
    // opening a second dossier for the same household.
    if (values.familyName) values.familyName = withFamilyPrefix(values.familyName);

    const familyKey = familyKeyOf(values.familyName ?? "");
    const existingFamilyCode = familyByName.get(familyKey);

    // Names → ids, before the row is judged, so a misspelt class is reported
    // alongside a missing birth date rather than one import run later.
    const refs = resolveRow(values, references, hasYear, t, issues);
    const enrols = Boolean(refs.levelOfferingId);

    if (issues.length > 0) {
      return {
        line,
        outcome: "REJECT" as const,
        values,
        issues,
        familyKey,
        existingFamilyCode,
        refs,
        enrols: false,
      };
    }

    // ── Already on file? ───────────────────────────────────────────────────
    const massar = values.massarCode?.toUpperCase();
    const code = values.code?.toUpperCase();

    const duplicate =
      (massar && takenMassar.get(massar)) || (code && takenCode.get(code)) || null;

    if (duplicate) {
      issues.push({
        column: massar && takenMassar.has(massar) ? "massarCode" : "code",
        message: interpolate(t.imports.errors.alreadyOnFile, {
          name: `${duplicate.lastName} ${duplicate.firstName}`,
          code: duplicate.code,
        }),
      });
      return {
        line,
        outcome: "SKIP" as const,
        values,
        issues,
        familyKey,
        existingFamilyCode,
        refs,
        enrols: false,
      };
    }

    const earlierMassar = massar ? seenMassar.get(massar) : undefined;
    const earlierCode = code ? seenCode.get(code) : undefined;
    const earlier = earlierMassar ?? earlierCode;

    if (earlier !== undefined) {
      issues.push({
        column: earlierMassar !== undefined ? "massarCode" : "code",
        message: interpolate(t.imports.errors.duplicateInFile, { line: earlier }),
      });
      return {
        line,
        outcome: "SKIP" as const,
        values,
        issues,
        familyKey,
        existingFamilyCode,
        refs,
        enrols: false,
      };
    }

    if (massar) seenMassar.set(massar, line);
    if (code) seenCode.set(code, line);
    if (familyKey !== "" && !existingFamilyCode) newFamilyKeys.add(familyKey);

    return {
      line,
      outcome: "CREATE" as const,
      values,
      issues,
      familyKey,
      existingFamilyCode,
      refs,
      enrols,
    };
  });

  return {
    rows: planned,
    unknownHeaders,
    missingColumns: [],
    counts: {
      create: planned.filter((row) => row.outcome === "CREATE").length,
      skip: planned.filter((row) => row.outcome === "SKIP").length,
      reject: planned.filter((row) => row.outcome === "REJECT").length,
      newFamilies: newFamilyKeys.size,
      enrol: planned.filter((row) => row.outcome === "CREATE" && row.enrols).length,
    },
  };
}

/**
 * Writes the plan.
 *
 * One transaction for the whole file: a half-loaded list is worse than none,
 * because the school cannot tell which pupils it still has to enter and
 * re-running the import would duplicate the ones that landed. Three thousand
 * rows is well inside what SQLite commits in one go.
 *
 * Codes are allocated in a block rather than through `allocateStudentCode` per
 * row — that helper scans the table each call, which for four hundred pupils
 * would be four hundred scans, and each would return the same number anyway
 * since nothing is committed until the end.
 */
export async function commitImport(
  context: AuthContext,
  csvText: string,
  t: Dictionary,
): Promise<{ created: number; families: number; enrolled: number }> {
  const schoolId = context.currentSchool!.id;
  const schoolYearId = context.currentSchoolYear?.id ?? null;

  // Re-planned server-side. The browser's copy is a display, not an authority.
  const plan = await planImport(context, csvText, t);
  const toCreate = plan.rows.filter((row) => row.outcome === "CREATE");
  if (toCreate.length === 0) return { created: 0, families: 0, enrolled: 0 };

  const year = new Date().getFullYear();
  const settings = await loadSchoolSettings(schoolId);
  const nextStudentSeq = await nextSequence(
    schoolId,
    "student",
    settings.studentCodeFormat,
    year,
  );
  const nextFamilySeq = await nextSequence(
    schoolId,
    "family",
    settings.familyCodeFormat,
    year,
  );

  let studentSeq = nextStudentSeq;
  let familySeq = nextFamilySeq;

  const neighbourhoods = await db.neighbourhood.findMany({
    where: { city: { schoolId } },
    select: { id: true, name: true },
  });
  const neighbourhoodByName = new Map(
    neighbourhoods.map((n) => [familyKeyOf(n.name), n.id]),
  );

  /*
    The two charges the template's Transport and Cantine columns map onto, in
    this school's own catalogue — see EnrollmentOption.

    Keyed on `FeeType.kind`, as the export and the services report are: the
    template asks about the bus and the cantine by name, so the import has to
    resolve those two specifically. Null where the school does not sell one, in
    which case the column raises nothing rather than inventing a charge.
  */
  const optionalFeeTypes = await db.feeType.findMany({
    where: {
      schoolId,
      isActive: true,
      isMandatory: false,
      kind: { in: ["TRANSPORT", "CANTEEN"] },
    },
    orderBy: [{ position: "asc" }, { code: "asc" }],
    select: { id: true, kind: true },
  });
  const optionalCharges = {
    TRANSPORT:
      optionalFeeTypes.find((feeType) => feeType.kind === "TRANSPORT")?.id ??
      null,
    CANTEEN:
      optionalFeeTypes.find((feeType) => feeType.kind === "CANTEEN")?.id ?? null,
  };

  let created = 0;
  let familiesOpened = 0;

  /*
    Enrolments created in the transaction, collected so their fee schedules can
    be generated once it has committed.

    `generateFeeSchedule` opens its own transaction, which cannot be nested
    inside this one. Running it after is safe because it is idempotent and
    additive — it writes only the lines that are missing — so a failure halfway
    leaves enrolments whose échéancier is completed by simply running it again,
    rather than a half-written file nobody can reconcile.
  */
  const enrolmentsToBill: string[] = [];
  const studentsToRefresh: string[] = [];

  await db.$transaction(async (tx) => {
    // Family code → id, filled as dossiers are opened or found.
    const familyIds = new Map<string, string>();

    for (const row of toCreate) {
      const key = row.familyKey;
      // No household named: the pupil's file is opened on its own, which the
      // nullable column exists for. No dossier and no guardians are invented.
      let familyId = key === "" ? null : (familyIds.get(key) ?? null);

      if (key !== "" && !familyId) {
        if (row.existingFamilyCode) {
          // A dossier of that name is already open — a sibling imported earlier,
          // or entered by hand. Attaching beats opening a second one.
          const found = await tx.family.findFirst({
            where: { schoolId, code: row.existingFamilyCode },
            select: { id: true },
          });
          if (found) familyId = found.id;
        }

        if (!familyId) {
          const family = await tx.family.create({
            data: {
              schoolId,
              code: formatEntityCode(settings.familyCodeFormat, year, familySeq),
              name: row.values.familyName!,
              phone: row.values.familyPhone ?? null,
              email: row.values.familyEmail ?? null,
              addressLine: row.values.addressLine ?? null,
              city: row.values.city ?? null,
            },
            select: { id: true },
          });
          familySeq += 1;
          familiesOpened += 1;
          familyId = family.id;

          await createGuardians(tx, familyId, row);
        }

        familyIds.set(key, familyId);
      }

      const student = await tx.student.create({
        data: {
          schoolId,
          familyId,
          code:
            row.values.code ??
            formatEntityCode(settings.studentCodeFormat, year, studentSeq),
          massarCode: row.values.massarCode ?? null,
          firstName: row.values.firstName!,
          lastName: row.values.lastName!,
          firstNameAr: row.values.firstNameAr ?? null,
          lastNameAr: row.values.lastNameAr ?? null,
          gender: row.values.gender!,
          birthDate: new Date(row.values.birthDate!),
          nationality: row.values.nationality ?? "MA",
          neighbourhoodId:
            neighbourhoodByName.get(familyKeyOf(row.values.neighbourhood ?? "")) ??
            null,
          // Never set from the file: `Student.status` is derived from the
          // enrolments, and `refreshStudentStatus` below is what moves it once
          // the inscription exists. The default says the file is merely open.
        },
        select: { id: true },
      });

      if (!row.values.code) studentSeq += 1;
      created += 1;

      // ── L'inscription ──────────────────────────────────────────────────
      if (row.enrols && schoolYearId && row.refs.levelOfferingId) {
        // A line named in the file means the bus, whether or not the Transport
        // column was also ticked — see `resolveRow`.
        const usesTransport =
          parseBoolean(row.values.usesTransport ?? "") || Boolean(row.refs.routeId);

        const enrolment = await tx.enrollment.create({
          data: {
            studentId: student.id,
            schoolYearId,
            levelOfferingId: row.refs.levelOfferingId,
            schoolClassId: row.refs.schoolClassId ?? null,
            enrolledOn: row.values.enrolledOn
              ? new Date(row.values.enrolledOn)
              : new Date(),
            isRepeating: parseBoolean(row.values.isRepeating ?? ""),
            /*
              The opt-ins, as rows against the school's own charges — see
              EnrollmentOption.

              `startsOn` is left null throughout: null means "from the start of
              the year", which is what a rentrée import always is. A mid-year
              joiner is put on the bus through the enrolment screen, where the
              start month is asked for.

              A school whose catalogue has no bus or no cantine gets no
              subscription, however the column was filled in — there is nothing
              to subscribe to. The file said what the family wants; the
              catalogue says what the school sells, and only the second can
              raise a charge.
            */
            options: {
              create: [
                ...(usesTransport && optionalCharges.TRANSPORT
                  ? [{ feeTypeId: optionalCharges.TRANSPORT }]
                  : []),
                ...(parseBoolean(row.values.usesCanteen ?? "") &&
                optionalCharges.CANTEEN
                  ? [{ feeTypeId: optionalCharges.CANTEEN }]
                  : []),
              ],
            },
          },
          select: { id: true },
        });

        enrolmentsToBill.push(enrolment.id);
        studentsToRefresh.push(student.id);

        // The abonnement itself, when the file said which line and which stop.
        // Both are required by the table, so a line without a stop records the
        // charge on the échéancier and leaves the seat to be assigned — which
        // is better than refusing the pupil over a missing bus stop.
        if (row.refs.routeId && row.refs.stopId) {
          // No column in the file names a run, so this always falls back to
          // the direction — BOTH, the model's default, exactly as a manual
          // rentrée subscription with no horaire declared would.
          await tx.transportSubscription.create({
            data: {
              enrollmentId: enrolment.id,
              routeId: row.refs.routeId,
              stopId: row.refs.stopId,
              scopeKey: subscriptionScopeKey("BOTH", null),
            },
          });
        }
      }
    }
  });

  /*
    Outside the transaction, and deliberately — see the note on `enrolmentsToBill`.
    `generateFeeSchedule` reads the price list for the level and writes one line
    per charge per instalment, filtered by the opt-ins set above, which is what
    makes the échéancier appear without anybody opening the pupil's file.
  */
  for (const enrolmentId of enrolmentsToBill) {
    await generateFeeSchedule(enrolmentId);
  }

  // `Student.status` is derived, and this is the only thing allowed to set it.
  for (const studentId of studentsToRefresh) {
    await refreshStudentStatus(studentId);
    await refreshHouseholdAccess(studentId);
  }

  return { created, families: familiesOpened, enrolled: enrolmentsToBill.length };
}

/** Père and mère, when the file named them. */
async function createGuardians(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  familyId: string,
  row: ImportRowPlan,
): Promise<void> {
  const parents = [
    {
      relationship: "FATHER",
      firstName: row.values.fatherFirstName,
      lastName: row.values.fatherLastName ?? row.values.lastName,
      nationalId: row.values.fatherNationalId,
      phone: row.values.fatherPhone,
      profession: row.values.fatherProfession,
    },
    {
      relationship: "MOTHER",
      firstName: row.values.motherFirstName,
      lastName: row.values.motherLastName ?? row.values.lastName,
      nationalId: row.values.motherNationalId,
      phone: row.values.motherPhone,
      profession: row.values.motherProfession,
    },
  ];

  let primaryTaken = false;

  for (const parent of parents) {
    // A first name is what makes a parent a person rather than an empty row.
    if (!parent.firstName) continue;

    await tx.guardian.create({
      data: {
        familyId,
        relationship: parent.relationship,
        firstName: parent.firstName,
        lastName: parent.lastName ?? "",
        nationalId: parent.nationalId ?? null,
        phone: parent.phone ?? null,
        profession: parent.profession ?? null,
        // The invariant `ensurePrimaryContact` keeps: exactly one per dossier,
        // and here it is whichever parent the file named first.
        isPrimaryContact: !primaryTaken,
      },
    });
    primaryTaken = true;
  }
}

/** The highest sequence already used, plus one. Read once per import. */
async function nextSequence(
  schoolId: string,
  entity: "student" | "family",
  format: string,
  year: number,
): Promise<number> {
  const prefix = codePrefixOf(format, year);
  const rows =
    entity === "student"
      ? await db.student.findMany({
          where: { schoolId, code: { startsWith: prefix } },
          orderBy: { code: "desc" },
          select: { code: true },
          take: 200,
        })
      : await db.family.findMany({
          where: { schoolId, code: { startsWith: prefix } },
          orderBy: { code: "desc" },
          select: { code: true },
          take: 200,
        });

  const highest = rows.reduce((max, row) => {
    const sequence = sequenceFromCode(format, year, row.code);
    return sequence !== null && sequence > max ? sequence : max;
  }, 0);

  return highest + 1;
}

/**
 * Parses one cell, recording why it could not be.
 *
 * Returns the value in the form it will be stored — a date as ISO, a sex as
 * MALE/FEMALE — so the preview shows the school what the app understood rather
 * than what they typed. "15/09/2012 → 2012-09-15" is the check a secretary
 * actually needs to make.
 */
function parseCell(
  column: ImportColumn,
  raw: string,
  t: Dictionary,
  issues: ImportIssue[],
): string | null {
  const label = t.imports.columns[column.labelKey];

  switch (column.kind) {
    case "date": {
      const date = parseImportDate(raw);
      if (raw.trim() !== "" && date === null) {
        issues.push({
          column: column.key,
          message: interpolate(t.imports.errors.badDate, { column: label, value: raw }),
        });
        return null;
      }
      return date ? date.toISOString().slice(0, 10) : null;
    }
    case "gender": {
      const gender = parseGender(raw);
      if (raw.trim() !== "" && gender === null) {
        issues.push({
          column: column.key,
          message: interpolate(t.imports.errors.badGender, { value: raw }),
        });
        return null;
      }
      return gender;
    }
    case "phone":
      return parsePhone(raw);
    case "email":
      return parseEmail(raw);
    default:
      return parseText(raw);
  }
}

/** Households are matched on the name with case and spacing set aside. */
function familyKeyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function emptyPlan(
  unknownHeaders: string[],
  fileErrors: string[] = [],
  missingColumns: string[] = [],
): ImportPlan {
  return {
    rows: fileErrors.map((message, index) => ({
      line: index + 1,
      outcome: "REJECT" as const,
      values: {},
      issues: [{ column: null, message }],
      familyKey: "",
      refs: {},
      enrols: false,
    })),
    unknownHeaders,
    missingColumns,
    counts: {
      create: 0,
      skip: 0,
      reject: fileErrors.length,
      newFamilies: 0,
      enrol: 0,
    },
  };
}
