import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { currentSchoolId, currentSchoolYearId } from "@/lib/scope";
import {
  consumptionPer100km,
  tenthsToLitres,
} from "@/modules/transport/enums";
import { findReport } from "@/modules/reports/catalogue";
import type {
  ReportParams,
  ReportResult,
  ReportRow,
} from "@/modules/reports/types";

/**
 * The database half of each report, keyed by the same `id` the catalogue uses.
 *
 * ── Every runner scopes itself ──────────────────────────────────────────────
 * Each one builds its own `where` from the working context — the school, and
 * the year where the data is year-shaped. Nothing here takes a school id from
 * the request, so a crafted filter narrows a report rather than widening it,
 * which is the same rule `modules/configuration/resource-schema.ts` follows.
 *
 * ── The date range means what it says ───────────────────────────────────────
 * `from` and `to` are inclusive at both ends. `to` is pushed to the *end* of its
 * day before it is used, because a range typed as "1 to 31 January" that
 * silently dropped the 31st is the bug every reporting screen ships with once.
 */

/** How many rows one run may return. Beyond it the report says it was cut. */
const ROW_CAP = 5000;

type Runner = (
  context: AuthContext,
  params: ReportParams,
  range: { from: Date; to: Date },
) => Promise<ReportRow[]>;

const schoolId = (context: AuthContext) =>
  currentSchoolId(context);
const yearId = (context: AuthContext) =>
  currentSchoolYearId(context);

/** The enrolment filter every pupil-shaped report shares. */
function pupilScope(context: AuthContext, params: ReportParams) {
  return {
    schoolYearId: yearId(context),
    student: { schoolId: schoolId(context) },
    ...(params.levelOfferingId
      ? { levelOfferingId: params.levelOfferingId }
      : {}),
    ...(params.schoolClassId ? { schoolClassId: params.schoolClassId } : {}),
    ...(params.cycle
      ? { levelOffering: { level: { educationLevel: { cycle: params.cycle } } } }
      : {}),
  };
}

/**
 * A yes/no column.
 *
 * Returned as a glyph rather than a word because the runners have no business
 * translating — and "Oui"/"نعم" in a French dictionary's CSV is exactly the kind
 * of drift a report is supposed to be free of. The view turns null into an
 * em dash, so "no" reads as blank, which is how a paper list is scanned.
 */
const flag = (value: boolean) => (value ? "\u2713" : null);

/** Surname first: how every Moroccan school list is alphabetised. */
const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.lastName} ${person.firstName}`;

/**
 * How far a scan may read before it aggregates.
 *
 * Separate from `ROW_CAP` because the two cap different things: a summary that
 * returns twelve rows may legitimately have read forty thousand instalments to
 * get them, and capping the read at the row cap would silently under-report the
 * total. Sized to a whole year of a large school with room to spare.
 */
const SCAN_CAP = 100_000;

/** Everything an instalment-shaped report reads. Shared so they cannot drift. */
const feeLineSelect = {
  dueDate: true,
  status: true,
  amountCentimes: true,
  feeType: { select: { name: true } },
  allocations: {
    where: { payment: { status: "POSTED" } },
    select: {
      amountCentimes: true,
      payment: { select: { paidAt: true } },
    },
  },
  enrollment: {
    select: {
      student: { select: { code: true, firstName: true, lastName: true } },
      schoolClass: { select: { code: true } },
    },
  },
} as const;

type FeeLine = {
  dueDate: Date;
  allocations: { amountCentimes: number; payment: { paidAt: Date } }[];
};

/** What has actually come in against one instalment. */
const settled = (line: FeeLine) =>
  line.allocations.reduce((sum, allocation) => sum + allocation.amountCentimes, 0);

/** The day the last centime of an instalment landed. */
function lastPaidOn(line: FeeLine): string | null {
  let latest: Date | null = null;
  for (const allocation of line.allocations) {
    if (!latest || allocation.payment.paidAt > latest) {
      latest = allocation.payment.paidAt;
    }
  }
  return latest ? latest.toISOString() : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: Date, to: Date) =>
  Math.floor((to.getTime() - from.getTime()) / DAY_MS);

/** `2026-03` — sorts lexicographically, which is why it is not "03/2026". */
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** A person's name, falling back to the address when no profile exists yet. */
const personName = (user: {
  email: string;
  profile: { firstName: string; lastName: string } | null;
}) =>
  user.profile
    ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
    : user.email;

/** The distinct ways one receipt was settled, translated. */
const methods = (
  tenders: { method: string }[],
  dictionary: { treasuryOptions: { methods: Record<string, string> } },
) =>
  [
    ...new Set(
      tenders.map(
        (tender) => dictionary.treasuryOptions.methods[tender.method] ?? tender.method,
      ),
    ),
  ].join(", ");

/** The instalment filter the schedule-shaped reports share. */
function feeScope(
  context: AuthContext,
  params: ReportParams,
  range: { from: Date; to: Date },
) {
  return {
    enrollment: pupilScope(context, params),
    ...(params.feeTypeId ? { feeTypeId: params.feeTypeId } : {}),
    dueDate: { gte: range.from, lte: range.to },
  };
}

/** The allocation filter the règlement-shaped reports share. */
function allocationScope(
  context: AuthContext,
  params: ReportParams,
  range: { from: Date; to: Date },
) {
  return {
    payment: {
      schoolId: schoolId(context),
      status: "POSTED",
      paidAt: { gte: range.from, lte: range.to },
    },
    enrollmentFee: { enrollment: pupilScope(context, params) },
  };
}

/**
 * The ledger bucketed by whatever `key` says — the one body behind the daily,
 * monthly and annual relevés de compte.
 *
 * Every bucket is emitted, including one where nothing moved, only where the
 * data has it: a statement that skipped an empty day would let a missing day's
 * takings pass for a quiet one.
 */
async function statement(
  context: AuthContext,
  range: { from: Date; to: Date },
  key: (date: Date) => string,
): Promise<ReportRow[]> {
  const rows = await db.cashOperation.findMany({
    where: {
      schoolId: schoolId(context),
      status: "POSTED",
      kind: { in: ["ENCAISSEMENT", "DECAISSEMENT"] },
      occurredAt: { gte: range.from, lte: range.to },
    },
    take: SCAN_CAP,
    select: { occurredAt: true, kind: true, amountCentimes: true },
  });

  const buckets = new Map<
    string,
    { movements: number; moneyIn: number; moneyOut: number }
  >();

  for (const row of rows) {
    /*
      Bucketed on the local date, not on UTC. A payment taken at nine in the
      evening in Casablanca is that day's takings; keying it off the ISO string
      would file it under tomorrow for part of the year and reconcile against
      nothing.
    */
    const day = new Date(
      row.occurredAt.getFullYear(),
      row.occurredAt.getMonth(),
      row.occurredAt.getDate(),
    );
    const bucketKey = key(day);
    const bucket = buckets.get(bucketKey) ?? {
      movements: 0,
      moneyIn: 0,
      moneyOut: 0,
    };
    bucket.movements += 1;
    if (row.kind === "ENCAISSEMENT") bucket.moneyIn += row.amountCentimes;
    else bucket.moneyOut += row.amountCentimes;
    buckets.set(bucketKey, bucket);
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([bucketKey, bucket]) => ({
      // The three reports name their first column differently; all three are
      // filled, and each one's catalogue entry picks the one it declared.
      day: bucketKey,
      month: bucketKey,
      year: bucketKey,
      movements: bucket.movements,
      moneyIn: bucket.moneyIn,
      moneyOut: bucket.moneyOut,
      net: bucket.moneyIn - bucket.moneyOut,
    }));
}

const RUNNERS: Record<string, Runner> = {
  // ── Vie scolaire ──────────────────────────────────────────────────────────
  inscriptions: async (context, params, range) => {
    const rows = await db.enrollment.findMany({
      where: {
        ...pupilScope(context, params),
        enrolledOn: { gte: range.from, lte: range.to },
      },
      orderBy: [{ enrolledOn: "desc" }],
      take: ROW_CAP + 1,
      select: {
        enrolledOn: true,
        status: true,
        student: { select: { code: true, firstName: true, lastName: true } },
        schoolClass: { select: { code: true } },
        levelOffering: { select: { level: { select: { name: true } } } },
      },
    });

    return rows.map((row) => ({
      code: row.student.code,
      pupil: `${row.student.lastName} ${row.student.firstName}`,
      level: row.levelOffering.level.name,
      class: row.schoolClass?.code ?? null,
      enrolledOn: row.enrolledOn.toISOString(),
      status: row.status,
    }));
  },

  /*
    Effectifs: a headcount per class, split by sex.

    Deliberately ignores the date range — "how many pupils are in 3AP-B" is a
    fact about now, not about a window, and filtering it by enrolment date would
    quietly answer a different question than the one on the label.
  */
  effectifs: async (context, params) => {
    const classes = await db.schoolClass.findMany({
      where: {
        schoolId: schoolId(context),
        levelOffering: {
          schoolYearId: yearId(context),
          ...(params.cycle
            ? { level: { educationLevel: { cycle: params.cycle } } }
            : {}),
        },
      },
      orderBy: [{ code: "asc" }],
      select: {
        code: true,
        levelOffering: { select: { level: { select: { name: true } } } },
        enrollments: {
          where: { status: { in: ["ACTIVE", "PENDING"] } },
          select: { student: { select: { gender: true } } },
        },
      },
    });

    return classes.map((schoolClass) => {
      const boys = schoolClass.enrollments.filter(
        (enrolment) => enrolment.student.gender === "MALE",
      ).length;
      return {
        level: schoolClass.levelOffering.level.name,
        class: schoolClass.code,
        boys,
        girls: schoolClass.enrollments.length - boys,
        total: schoolClass.enrollments.length,
      };
    });
  },

  absences: async (context, params, range) => {
    const rows = await db.enrollment.findMany({
      where: pupilScope(context, params),
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        student: { select: { code: true, firstName: true, lastName: true } },
        schoolClass: { select: { code: true } },
        attendance: {
          where: { date: { gte: range.from, lte: range.to } },
          select: { status: true, isJustified: true },
        },
      },
    });

    return rows
      .map((row) => {
        const absences = row.attendance.filter(
          (mark) => mark.status === "ABSENT",
        ).length;
        const lates = row.attendance.filter(
          (mark) => mark.status === "LATE",
        ).length;
        return {
          code: row.student.code,
          pupil: `${row.student.lastName} ${row.student.firstName}`,
          class: row.schoolClass?.code ?? null,
          absences,
          lates,
          unjustified: row.attendance.filter(
            (mark) => !mark.isJustified && mark.status !== "PRESENT",
          ).length,
        };
      })
      // A pupil who was never absent is not what this report is for; listing
      // five hundred zeroes would bury the dozen rows that matter.
      .filter((row) => row.absences > 0 || row.lates > 0);
  },


  /*
    Non inscrits: on the books but with no live enrolment this year.

    The absence of a row is the fact being reported, so this asks the *student*
    table and excludes those the year already covers — the mirror of every other
    pupil report, which starts from the enrolment. Deliberately unfiltered by
    class: a pupil with no enrolment has no class to filter by.
  */
  "non-inscrits": async (context) => {
    const dictionary = await getDictionary();
    const rows = await db.student.findMany({
      where: {
        schoolId: schoolId(context),
        isActive: true,
        enrollments: {
          none: {
            schoolYearId: yearId(context),
            status: { in: ["ACTIVE", "PENDING"] },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: ROW_CAP + 1,
      select: {
        code: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        status: true,
        family: { select: { name: true, phone: true } },
      },
    });

    return rows.map((row) => ({
      code: row.code,
      pupil: fullName(row),
      birthDate: row.birthDate.toISOString(),
      family: row.family?.name ?? null,
      phone: row.family?.phone ?? null,
      status:
        dictionary.studentOptions.statuses[
          row.status as keyof typeof dictionary.studentOptions.statuses
        ] ?? row.status,
    }));
  },

  /*
    Préinscriptions: enrolments still PENDING — the queue the rentrée works
    through. Ranged on `enrolledOn` so "the ones that came in this week" is a
    question the screen can answer.
  */
  prescriptions: async (context, params, range) => {
    const rows = await db.enrollment.findMany({
      where: {
        ...pupilScope(context, params),
        status: "PENDING",
        enrolledOn: { gte: range.from, lte: range.to },
      },
      orderBy: [{ enrolledOn: "asc" }],
      take: ROW_CAP + 1,
      select: {
        enrolledOn: true,
        student: {
          select: {
            code: true,
            firstName: true,
            lastName: true,
            family: { select: { name: true, phone: true } },
          },
        },
        levelOffering: { select: { level: { select: { name: true } } } },
      },
    });

    return rows.map((row) => ({
      code: row.student.code,
      pupil: fullName(row.student),
      level: row.levelOffering.level.name,
      enrolledOn: row.enrolledOn.toISOString(),
      family: row.student.family?.name ?? null,
      phone: row.student.family?.phone ?? null,
    }));
  },

  /*
    Radiés: departures. Ranged on `leftOn` rather than `enrolledOn`, because the
    date that matters about a departure is the day it happened.
  */
  radies: async (context, params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.enrollment.findMany({
      where: {
        ...pupilScope(context, params),
        status: { in: ["WITHDRAWN", "TRANSFERRED"] },
        leftOn: { gte: range.from, lte: range.to },
      },
      orderBy: [{ leftOn: "desc" }],
      take: ROW_CAP + 1,
      select: {
        status: true,
        leftOn: true,
        student: { select: { code: true, firstName: true, lastName: true } },
        schoolClass: { select: { code: true } },
      },
    });

    return rows.map((row) => ({
      code: row.student.code,
      pupil: fullName(row.student),
      class: row.schoolClass?.code ?? null,
      status:
        dictionary.enrolmentOptions.statuses[
          row.status as keyof typeof dictionary.enrolmentOptions.statuses
        ] ?? row.status,
      leftOn: row.leftOn?.toISOString() ?? null,
    }));
  },

  /*
    Liste Massar: the roster in the shape the ministry's platform wants it —
    the national code first, and the name in Arabic beside the Latin one, since
    that is the pair a clerk reconciles against.
  */
  massar: async (context, params) => {
    const rows = await db.enrollment.findMany({
      where: { ...pupilScope(context, params), status: { in: ["ACTIVE"] } },
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        student: {
          select: {
            code: true,
            massarCode: true,
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
            birthDate: true,
          },
        },
        schoolClass: { select: { code: true } },
      },
    });

    return rows.map((row) => ({
      massar: row.student.massarCode,
      code: row.student.code,
      pupil: fullName(row.student),
      // Both halves or neither: half a name in Arabic is worse than none.
      pupilAr:
        row.student.lastNameAr && row.student.firstNameAr
          ? `${row.student.lastNameAr} ${row.student.firstNameAr}`
          : null,
      birthDate: row.student.birthDate.toISOString(),
      class: row.schoolClass?.code ?? null,
    }));
  },

  /*
    Anciens et nouveaux: who was already here last year and who was not.

    "New" is derived from whether the pupil has an enrolment in any *earlier*
    year, not from `Student.entryDate` — a date somebody typed once is not a
    fact, and the enrolment history is.
  */
  "anciens-nouveaux": async (context, params) => {
    const dictionary = await getDictionary();
    const startsOn = context.currentSchoolYear?.startDate ?? new Date(0);

    const rows = await db.enrollment.findMany({
      where: { ...pupilScope(context, params), status: { in: ["ACTIVE", "PENDING"] } },
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        isRepeating: true,
        student: {
          select: {
            code: true,
            firstName: true,
            lastName: true,
            enrollments: {
              where: { schoolYear: { startDate: { lt: startsOn } } },
              select: { id: true },
              take: 1,
            },
          },
        },
        schoolClass: { select: { code: true } },
      },
    });

    return rows.map((row) => ({
      code: row.student.code,
      pupil: fullName(row.student),
      class: row.schoolClass?.code ?? null,
      kind:
        row.student.enrollments.length > 0
          ? dictionary.report.values.returning
          : dictionary.report.values.newPupil,
      repeating: flag(row.isRepeating),
    }));
  },

  /*
    Registre général: the bound register every Moroccan school keeps — one line
    per pupil, in the order they were admitted, with the civil-status details a
    later attestation is written from.
  */
  "registre-general": async (context, params) => {
    const dictionary = await getDictionary();
    const rows = await db.enrollment.findMany({
      where: { ...pupilScope(context, params) },
      orderBy: [{ enrolledOn: "asc" }],
      take: ROW_CAP + 1,
      select: {
        enrolledOn: true,
        student: {
          select: {
            code: true,
            massarCode: true,
            firstName: true,
            lastName: true,
            gender: true,
            birthDate: true,
            birthCity: { select: { name: true } },
          },
        },
        schoolClass: { select: { code: true } },
      },
    });

    return rows.map((row) => ({
      code: row.student.code,
      massar: row.student.massarCode,
      pupil: fullName(row.student),
      gender:
        dictionary.studentOptions.genders[
          row.student.gender as keyof typeof dictionary.studentOptions.genders
        ] ?? row.student.gender,
      birthDate: row.student.birthDate.toISOString(),
      birthPlace: row.student.birthCity?.name ?? null,
      class: row.schoolClass?.code ?? null,
      enrolledOn: row.enrolledOn.toISOString(),
    }));
  },

  /*
    Par service scolaire: who rides the bus and who eats at the cantine — the
    two lists a school actually prints, and the ones the caterer and the driver
    are handed at the rentrée.
  */
  services: async (context, params) => {
    const rows = await db.enrollment.findMany({
      where: {
        ...pupilScope(context, params),
        status: { in: ["ACTIVE", "PENDING"] },
        // Only the pupils who take something: a list of everybody with two
        // empty columns is not the list anybody asked for.
        options: { some: { feeType: { kind: { in: ["TRANSPORT", "CANTEEN"] } } } },
      },
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        /*
          Read through the subscriptions rather than off two columns, which is
          where these used to live — see EnrollmentOption.

          Keyed on `FeeType.kind` and not on a particular fee type, because this
          report is *about* the bus and the cantine specifically: it is what the
          driver and the caterer are handed. That is precisely the job the kind
          exists for — "grouping on an invoice and on the accountant's report
          far more than behaviour", as billing/enums.ts puts it. A school that
          sells three clubs sees none of them here, and should not: this is not
          the list of everything optional.
        */
        options: { select: { feeType: { select: { kind: true } } } },
        student: { select: { code: true, firstName: true, lastName: true } },
        schoolClass: { select: { code: true } },
      },
    });

    return rows.map((row) => {
      const kinds = new Set(row.options.map((option) => option.feeType.kind));
      return {
        code: row.student.code,
        pupil: fullName(row.student),
        class: row.schoolClass?.code ?? null,
        transport: flag(kinds.has("TRANSPORT")),
        canteen: flag(kinds.has("CANTEEN")),
      };
    });
  },

  /*
    Allergies: the sheet the infirmerie and the cantine work from. Anything
    medical the school was told, for the pupils where there is something to
    tell — an empty row here is a pupil with nothing recorded, which is noise
    on a list whose whole purpose is to be short enough to read.
  */
  allergies: async (context, params) => {
    const rows = await db.enrollment.findMany({
      where: {
        ...pupilScope(context, params),
        status: { in: ["ACTIVE", "PENDING"] },
        student: {
          schoolId: schoolId(context),
          OR: [
            { allergies: { not: null } },
            { chronicCondition: { not: null } },
            { hasDisability: true },
          ],
        },
      },
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        student: {
          select: {
            code: true,
            firstName: true,
            lastName: true,
            bloodType: true,
            allergies: true,
            chronicCondition: true,
            doctorName: true,
            doctorPhone: true,
          },
        },
        schoolClass: { select: { code: true } },
      },
    });

    return rows.map((row) => ({
      code: row.student.code,
      pupil: fullName(row.student),
      class: row.schoolClass?.code ?? null,
      bloodType: row.student.bloodType,
      allergies: row.student.allergies,
      condition: row.student.chronicCondition,
      // The name is no use without the number, so they travel as one cell.
      doctor: row.student.doctorName
        ? [row.student.doctorName, row.student.doctorPhone]
            .filter(Boolean)
            .join(" · ")
        : null,
    }));
  },

  /*
    Accompagnants: who may collect a child. One line per authorised adult, so a
    pupil with two appears twice — which is the point, since the gate reads it
    by adult and not by pupil.
  */
  accompagnants: async (context, params) => {
    const dictionary = await getDictionary();
    const rows = await db.enrollment.findMany({
      where: {
        ...pupilScope(context, params),
        status: { in: ["ACTIVE", "PENDING"] },
        student: { schoolId: schoolId(context), family: { isNot: null } },
      },
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            family: {
              select: {
                guardians: {
                  where: { isActive: true, canPickUp: true },
                  orderBy: [{ isPrimaryContact: "desc" }, { lastName: "asc" }],
                  select: {
                    firstName: true,
                    lastName: true,
                    relationship: true,
                    phone: true,
                    nationalId: true,
                  },
                },
              },
            },
          },
        },
        schoolClass: { select: { code: true } },
      },
    });

    return rows.flatMap((row) =>
      (row.student.family?.guardians ?? []).map((guardian) => ({
        pupil: fullName(row.student),
        class: row.schoolClass?.code ?? null,
        guardian: fullName(guardian),
        relationship:
          dictionary.familyOptions.relationships[
            guardian.relationship as keyof typeof dictionary.familyOptions.relationships
          ] ?? guardian.relationship,
        phone: guardian.phone,
        nationalId: guardian.nationalId,
      })),
    );
  },

  /*
    Annuaire téléphonique: one line per pupil with every number the school
    holds, for the day the class has to be rung round.
  */
  annuaire: async (context, params) => {
    const rows = await db.enrollment.findMany({
      where: {
        ...pupilScope(context, params),
        status: { in: ["ACTIVE", "PENDING"] },
      },
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            family: {
              select: {
                name: true,
                phone: true,
                email: true,
                guardians: {
                  where: { isActive: true },
                  orderBy: [{ isPrimaryContact: "desc" }],
                  select: { phone: true, phoneAlt: true, email: true },
                },
              },
            },
          },
        },
        schoolClass: { select: { code: true } },
      },
    });

    return rows.map((row) => {
      const family = row.student.family;
      const numbers = [
        family?.phone,
        ...(family?.guardians ?? []).flatMap((guardian) => [
          guardian.phone,
          guardian.phoneAlt,
        ]),
      ].filter((value): value is string => Boolean(value));
      // The same number recorded on the family and on the father is one number.
      const unique = [...new Set(numbers)];

      return {
        pupil: fullName(row.student),
        class: row.schoolClass?.code ?? null,
        family: family?.name ?? null,
        phone: unique[0] ?? null,
        phoneAlt: unique.slice(1).join(" · ") || null,
        email:
          family?.email ??
          family?.guardians.find((guardian) => guardian.email)?.email ??
          null,
      };
    });
  },

  /*
    Liste des familles: the households, with how many of their children the
    school currently has. Counted on live enrolments in the working year rather
    than on `Family.children`, so a household whose eldest has left is not still
    billed for three.
  */
  familles: async (context) => {
    const dictionary = await getDictionary();
    const rows = await db.family.findMany({
      where: { schoolId: schoolId(context), isActive: true },
      orderBy: [{ name: "asc" }],
      take: ROW_CAP + 1,
      select: {
        code: true,
        name: true,
        situation: true,
        city: true,
        phone: true,
        _count: {
          select: {
            children: {
              where: {
                enrollments: {
                  some: {
                    schoolYearId: yearId(context),
                    status: { in: ["ACTIVE", "PENDING"] },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      code: row.code,
      family: row.name,
      situation:
        dictionary.familyOptions.situations[
          row.situation as keyof typeof dictionary.familyOptions.situations
        ] ?? row.situation,
      city: row.city,
      phone: row.phone,
      children: row._count.children,
    }));
  },

  /*
    Anniversaires: sorted by the day in the year, not by the year of birth —
    which is what a list pinned in the salle des profs is for. The date range is
    ignored on purpose: birthdays recur, and intersecting them with an arbitrary
    window would answer a question nobody asked.
  */
  anniversaires: async (context, params) => {
    const rows = await db.enrollment.findMany({
      where: {
        ...pupilScope(context, params),
        status: { in: ["ACTIVE", "PENDING"] },
      },
      take: ROW_CAP + 1,
      select: {
        student: {
          select: { firstName: true, lastName: true, birthDate: true },
        },
        schoolClass: { select: { code: true } },
      },
    });

    const today = new Date();
    return rows
      .map((row) => {
        const birth = row.student.birthDate;
        const month = birth.getMonth();
        const day = birth.getDate();
        let age = today.getFullYear() - birth.getFullYear();
        if (
          today.getMonth() < month ||
          (today.getMonth() === month && today.getDate() < day)
        ) {
          age -= 1;
        }
        return {
          sort: month * 100 + day,
          row: {
            // Day and month only: the year is the age column's job.
            day: `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`,
            pupil: fullName(row.student),
            class: row.schoolClass?.code ?? null,
            age,
          },
        };
      })
      .sort((left, right) => left.sort - right.sort)
      .map((entry) => entry.row);
  },

  /*
    Documents manquants: the dossier chase-list.

    A pièce with no row at all counts as missing just as surely as one recorded
    MISSING — nobody ticks "not yet received" for a paper that was never asked
    for, so absence has to be read as absence. Only required, active types
    count; the optional ones are not what holds an inscription up.
  */
  "documents-manquants": async (context, params) => {
    const [required, rows] = await Promise.all([
      db.documentType.findMany({
        where: { schoolId: schoolId(context), isActive: true, isRequired: true },
        orderBy: [{ position: "asc" }],
        select: { id: true, name: true },
      }),
      db.enrollment.findMany({
        where: {
          ...pupilScope(context, params),
          status: { in: ["ACTIVE", "PENDING"] },
        },
        orderBy: [{ student: { lastName: "asc" } }],
        take: ROW_CAP + 1,
        select: {
          student: {
            select: {
              code: true,
              firstName: true,
              lastName: true,
              documents: {
                select: { documentTypeId: true, status: true },
              },
            },
          },
          schoolClass: { select: { code: true } },
        },
      }),
    ]);

    return rows
      .map((row) => {
        const settled = new Set(
          row.student.documents
            .filter(
              (document) =>
                document.status === "RECEIVED" || document.status === "EXEMPTED",
            )
            .map((document) => document.documentTypeId),
        );
        const missing = required.filter((type) => !settled.has(type.id));

        return {
          code: row.student.code,
          pupil: fullName(row.student),
          class: row.schoolClass?.code ?? null,
          missing: missing.length,
          pieces: missing.map((type) => type.name).join(", ") || null,
        };
      })
      .filter((row) => row.missing > 0);
  },


  /*
    Élèves par circuit de transport: the sheet the driver and the
    accompagnateur are handed.

    Ordered by line, then by stop position, then by pupil — the order the bus
    actually calls them in, not alphabetical, because the list is read down the
    route rather than looked up by name. Seat-holding subscriptions only: a
    suspended child still has a seat and still has to be accounted for at the
    stop, which is why SUSPENDED is here and CANCELLED is not.
  */
  "eleves-par-circuit": async (context, params) => {
    const dictionary = await getDictionary();
    const rows = await db.transportSubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "SUSPENDED"] },
        route: { schoolYearId: yearId(context), isActive: true },
        enrollment: pupilScope(context, params),
      },
      orderBy: [
        { route: { code: "asc" } },
        { stop: { position: "asc" } },
        { enrollment: { student: { lastName: "asc" } } },
      ],
      take: ROW_CAP + 1,
      select: {
        direction: true,
        route: { select: { code: true, name: true } },
        stop: { select: { name: true, pickupTime: true } },
        enrollment: {
          select: {
            student: {
              select: {
                code: true,
                firstName: true,
                lastName: true,
                family: {
                  select: {
                    phone: true,
                    guardians: {
                      where: { isActive: true },
                      orderBy: [{ isPrimaryContact: "desc" }],
                      select: { phone: true },
                      take: 1,
                    },
                  },
                },
              },
            },
            schoolClass: { select: { code: true } },
          },
        },
      },
    });

    return rows.map((row) => {
      const student = row.enrollment.student;
      return {
        route: `${row.route.code} — ${row.route.name}`,
        stop: row.stop.name,
        pickupTime: row.stop.pickupTime,
        code: student.code,
        pupil: fullName(student),
        class: row.enrollment.schoolClass?.code ?? null,
        direction:
          dictionary.transportOptions.directions[
            row.direction as keyof typeof dictionary.transportOptions.directions
          ] ?? row.direction,
        // The number somebody would actually ring from the roadside.
        phone: student.family?.phone ?? student.family?.guardians[0]?.phone ?? null,
      };
    });
  },

  /*
    Suivi gasoil par véhicule: the fiche de suivi carburant, one line per plein.

    ── Why the distance is derived rather than stored ──────────────────────────
    Nobody records "kilometres since the last fill" — they record the odometer,
    and the distance is the gap between two readings of the same bus. Computed
    here in one pass through each vehicle's history, which is also the only
    place it can be: a single row does not know what came before it.

    A reading that went backwards, or a first fill with nothing to compare
    against, leaves the distance and the consumption blank rather than zero.
    "We do not know" and "this bus used nothing" are different answers, and the
    fleet screen makes the same distinction — see `consumptionPer100km`.
  */
  "gasoil-par-vehicule": async (context, _params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.fuelRequest.findMany({
      where: {
        schoolId: schoolId(context),
        occurredOn: { gte: range.from, lte: range.to },
      },
      orderBy: [
        { vehicle: { registration: "asc" } },
        { occurredOn: "asc" },
      ],
      take: ROW_CAP + 1,
      select: {
        occurredOn: true,
        litresTenths: true,
        odometerKm: true,
        amountCentimes: true,
        status: true,
        requestedByName: true,
        vehicle: {
          select: {
            registration: true,
            driverName: true,
            driver: { select: { firstName: true, lastName: true } },
          },
        },
        requestedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const lastOdometer = new Map<string, number>();

    return rows.map((row) => {
      const registration = row.vehicle.registration;
      const previous = lastOdometer.get(registration);
      const distance =
        row.odometerKm !== null && previous !== undefined && row.odometerKm > previous
          ? row.odometerKm - previous
          : null;
      if (row.odometerKm !== null) lastOdometer.set(registration, row.odometerKm);

      const consumption =
        distance === null
          ? null
          : consumptionPer100km(row.litresTenths, distance);

      const driver =
        (row.requestedBy
          ? `${row.requestedBy.firstName} ${row.requestedBy.lastName}`.trim()
          : null) ??
        row.requestedByName ??
        (row.vehicle.driver
          ? `${row.vehicle.driver.firstName} ${row.vehicle.driver.lastName}`.trim()
          : null) ??
        row.vehicle.driverName;

      return {
        vehicle: registration,
        date: row.occurredOn.toISOString(),
        driver,
        litres: tenthsToLitres(row.litresTenths),
        odometer: row.odometerKm,
        distance,
        consumption: consumption === null ? null : tenthsToLitres(consumption),
        status:
          dictionary.transportOptions.fuelStatuses[
            row.status as keyof typeof dictionary.transportOptions.fuelStatuses
          ] ?? row.status,
        amount: row.amountCentimes,
      };
    });
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  encaissements: async (context, _params, range) => {
    const rows = await db.payment.findMany({
      where: {
        schoolId: schoolId(context),
        status: "POSTED",
        paidAt: { gte: range.from, lte: range.to },
      },
      orderBy: [{ paidAt: "desc" }],
      take: ROW_CAP + 1,
      select: {
        code: true,
        paidAt: true,
        totalCentimes: true,
        family: { select: { name: true } },
        tenders: { select: { method: true } },
        createdBy: {
          select: { email: true, profile: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    return rows.map((row) => ({
      code: row.code,
      paidAt: row.paidAt.toISOString(),
      family: row.family?.name ?? null,
      method: [...new Set(row.tenders.map((tender) => tender.method))].join(", "),
      amount: row.totalCentimes,
      takenBy: row.createdBy.profile
        ? `${row.createdBy.profile.firstName} ${row.createdBy.profile.lastName}`.trim()
        : row.createdBy.email,
    }));
  },

  decaissements: async (context, _params, range) => {
    const rows = await db.cashOperation.findMany({
      where: {
        schoolId: schoolId(context),
        kind: "DECAISSEMENT",
        status: "POSTED",
        occurredAt: { gte: range.from, lte: range.to },
      },
      orderBy: [{ occurredAt: "desc" }],
      take: ROW_CAP + 1,
      select: {
        occurredAt: true,
        label: true,
        amountCentimes: true,
        method: true,
        beneficiaryName: true,
        category: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      occurredAt: row.occurredAt.toISOString(),
      label: row.label,
      beneficiary: row.beneficiaryName,
      category: row.category?.name ?? null,
      method: row.method,
      amount: row.amountCentimes,
    }));
  },

  /*
    Les impayés. The date range bounds the *due dates*, not the payments: the
    question is "what fell due in this window and is still not settled", which
    is what a chasing list is.
  */
  impayes: async (context, params, range) => {
    const rows = await db.enrollment.findMany({
      where: pupilScope(context, params),
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        student: {
          select: {
            code: true,
            firstName: true,
            lastName: true,
            family: { select: { name: true } },
          },
        },
        schoolClass: { select: { code: true } },
        fees: {
          where: {
            status: "DUE",
            dueDate: { gte: range.from, lte: range.to },
            ...(params.feeTypeId ? { feeTypeId: params.feeTypeId } : {}),
          },
          select: {
            amountCentimes: true,
            dueDate: true,
            allocations: {
              where: { payment: { status: "POSTED" } },
              select: { amountCentimes: true },
            },
          },
        },
      },
    });

    const now = new Date();

    return rows
      .map((row) => {
        let charged = 0;
        let paid = 0;
        let overdue = 0;

        for (const fee of row.fees) {
          const settled = fee.allocations.reduce(
            (total, allocation) => total + allocation.amountCentimes,
            0,
          );
          charged += fee.amountCentimes;
          paid += settled;
          if (fee.dueDate <= now) {
            overdue += Math.max(0, fee.amountCentimes - settled);
          }
        }

        return {
          code: row.student.code,
          pupil: `${row.student.lastName} ${row.student.firstName}`,
          class: row.schoolClass?.code ?? null,
          family: row.student.family?.name ?? null,
          charged,
          paid,
          overdue,
        };
      })
      // Only the families that actually owe something late — everybody else is
      // on schedule, and a chasing list they appear on is a list nobody trusts.
      .filter((row) => row.overdue > 0);
  },

  "recettes-par-rubrique": async (context, _params, range) => {
    const rows = await db.cashOperation.findMany({
      where: {
        schoolId: schoolId(context),
        status: "POSTED",
        kind: { in: ["ENCAISSEMENT", "DECAISSEMENT"] },
        occurredAt: { gte: range.from, lte: range.to },
      },
      select: {
        kind: true,
        amountCentimes: true,
        category: { select: { id: true, name: true } },
      },
    });

    const byCategory = new Map<
      string,
      { category: string; inCount: number; in: number; out: number }
    >();

    for (const row of rows) {
      const key = row.category?.id ?? "__none__";
      const held = byCategory.get(key) ?? {
        category: row.category?.name ?? "—",
        inCount: 0,
        in: 0,
        out: 0,
      };
      held.inCount += 1;
      if (row.kind === "ENCAISSEMENT") held.in += row.amountCentimes;
      else held.out += row.amountCentimes;
      byCategory.set(key, held);
    }

    return [...byCategory.values()]
      .map((row) => ({ ...row, net: row.in - row.out }))
      .sort((a, b) => b.in - b.out - (a.in - a.out));
  },


  /*
    Situation détaillée des échéances: one line per instalment, with what was
    charged against what has come in. The date range bounds the *due dates* —
    the same choice `impayes` makes, and for the same reason: this is a
    question about the schedule, not about when somebody happened to pay.
  */
  "echeances-detail": async (context, params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.enrollmentFee.findMany({
      where: feeScope(context, params, range),
      orderBy: [{ dueDate: "asc" }],
      take: ROW_CAP + 1,
      select: feeLineSelect,
    });

    return rows.map((line) => {
      const collected = settled(line);
      return {
        code: line.enrollment.student.code,
        pupil: fullName(line.enrollment.student),
        class: line.enrollment.schoolClass?.code ?? null,
        service: line.feeType.name,
        dueDate: line.dueDate.toISOString(),
        charged: line.amountCentimes,
        collected,
        // Only a DUE line can be in arrears: a waived one is not owed.
        balance: line.status === "DUE" ? line.amountCentimes - collected : 0,
        status:
          dictionary.enrolmentOptions.lineStatuses[
            line.status as keyof typeof dictionary.enrolmentOptions.lineStatuses
          ] ?? line.status,
      };
    });
  },

  /*
    The three relevés de compte are the same ledger at three grains, so they
    are one function bound three ways — a school that reconciles the day and the
    month against different code eventually reconciles them against different
    numbers.
  */
  "releve-journalier": (context, _params, range) =>
    statement(context, range, (date) => date.toISOString()),
  "releve-mensuel": (context, _params, range) =>
    statement(context, range, (date) => monthKey(date)),
  "releve-annuel": (context, _params, range) =>
    statement(context, range, (date) => String(date.getFullYear())),

  /*
    Règlements par niveau. A receipt is written to a *family*, so the level is
    reached through what the money was allocated to — which is also why a
    payment split across two children of different levels lands, correctly, on
    both lines.
  */
  "reglements-par-niveau": async (context, params, range) => {
    const rows = await db.paymentAllocation.findMany({
      where: allocationScope(context, params, range),
      take: SCAN_CAP,
      select: {
        amountCentimes: true,
        paymentId: true,
        enrollmentFee: {
          select: {
            enrollment: {
              select: {
                studentId: true,
                levelOffering: {
                  select: {
                    level: { select: { name: true, position: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const byLevel = new Map<
      string,
      { position: number; pupils: Set<string>; receipts: Set<string>; amount: number }
    >();

    for (const row of rows) {
      const level = row.enrollmentFee.enrollment.levelOffering.level;
      const bucket = byLevel.get(level.name) ?? {
        position: level.position,
        pupils: new Set<string>(),
        receipts: new Set<string>(),
        amount: 0,
      };
      bucket.pupils.add(row.enrollmentFee.enrollment.studentId);
      bucket.receipts.add(row.paymentId);
      bucket.amount += row.amountCentimes;
      byLevel.set(level.name, bucket);
    }

    return [...byLevel.entries()]
      .sort((left, right) => left[1].position - right[1].position)
      .map(([level, bucket]) => ({
        level,
        pupils: bucket.pupils.size,
        receipts: bucket.receipts.size,
        amount: bucket.amount,
      }));
  },

  /*
    Liste des règlements détaillées: the allocation, not the receipt. One line
    per "this much of that receipt went to that month of that charge" — which is
    the level a disagreement with a family is actually settled at.
  */
  "reglements-details": async (context, params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.paymentAllocation.findMany({
      where: allocationScope(context, params, range),
      orderBy: [{ payment: { paidAt: "desc" } }],
      take: ROW_CAP + 1,
      select: {
        amountCentimes: true,
        payment: {
          select: {
            code: true,
            paidAt: true,
            tenders: { select: { method: true } },
          },
        },
        enrollmentFee: {
          select: {
            dueMonth: true,
            dueYear: true,
            feeType: { select: { name: true } },
            enrollment: {
              select: {
                student: { select: { firstName: true, lastName: true } },
                schoolClass: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      receipt: row.payment.code,
      date: row.payment.paidAt.toISOString(),
      pupil: fullName(row.enrollmentFee.enrollment.student),
      class: row.enrollmentFee.enrollment.schoolClass?.code ?? null,
      service: row.enrollmentFee.feeType.name,
      period: `${String(row.enrollmentFee.dueMonth).padStart(2, "0")}/${row.enrollmentFee.dueYear}`,
      method: methods(row.payment.tenders, dictionary),
      amount: row.amountCentimes,
    }));
  },

  /* Règlements par service scolaire: what each charge actually brought in. */
  "reglements-par-service": async (context, params, range) => {
    const rows = await db.paymentAllocation.findMany({
      where: allocationScope(context, params, range),
      take: SCAN_CAP,
      select: {
        amountCentimes: true,
        enrollmentFee: {
          select: {
            feeType: { select: { name: true, position: true } },
            enrollment: { select: { studentId: true } },
          },
        },
      },
    });

    const byService = new Map<
      string,
      { position: number; pupils: Set<string>; lines: number; amount: number }
    >();

    for (const row of rows) {
      const feeType = row.enrollmentFee.feeType;
      const bucket = byService.get(feeType.name) ?? {
        position: feeType.position,
        pupils: new Set<string>(),
        lines: 0,
        amount: 0,
      };
      bucket.pupils.add(row.enrollmentFee.enrollment.studentId);
      bucket.lines += 1;
      bucket.amount += row.amountCentimes;
      byService.set(feeType.name, bucket);
    }

    return [...byService.entries()]
      .sort((left, right) => left[1].position - right[1].position)
      .map(([service, bucket]) => ({
        service,
        pupils: bucket.pupils.size,
        lines: bucket.lines,
        amount: bucket.amount,
      }));
  },

  /*
    Synthèse annuelle des règlements: the year's takings month by month. Counts
    distinct families as well as receipts, because "how many households paid in
    March" and "how many receipts we wrote in March" are different questions and
    a bursar asks the first one.
  */
  "synthese-annuelle": async (context, _params, range) => {
    const rows = await db.payment.findMany({
      where: {
        schoolId: schoolId(context),
        status: "POSTED",
        paidAt: { gte: range.from, lte: range.to },
      },
      take: SCAN_CAP,
      select: { paidAt: true, totalCentimes: true, familyId: true },
    });

    const byMonth = new Map<
      string,
      { receipts: number; families: Set<string>; amount: number }
    >();

    for (const row of rows) {
      const key = monthKey(row.paidAt);
      const bucket = byMonth.get(key) ?? {
        receipts: 0,
        families: new Set<string>(),
        amount: 0,
      };
      bucket.receipts += 1;
      if (row.familyId) bucket.families.add(row.familyId);
      bucket.amount += row.totalCentimes;
      byMonth.set(key, bucket);
    }

    return [...byMonth.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([month, bucket]) => ({
        month,
        receipts: bucket.receipts,
        families: bucket.families.size,
        amount: bucket.amount,
      }));
  },

  /*
    Relevé de caisse: one line per session of the drawer.

    `variance` is reported from the stored column rather than recomputed, so it
    says what was signed off at the time. A session the day boundary closed has
    no count at all — see `wasAutoClosed` — and shows blank rather than a zero
    variance it never earned.
  */
  "releve-caisse": async (context, _params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.cashSession.findMany({
      where: {
        cashRegister: { schoolId: schoolId(context) },
        openedAt: { gte: range.from, lte: range.to },
      },
      orderBy: [{ openedAt: "desc" }],
      take: ROW_CAP + 1,
      select: {
        openedAt: true,
        openingFloatCentimes: true,
        expectedCentimes: true,
        countedCentimes: true,
        varianceCentimes: true,
        status: true,
        wasAutoClosed: true,
        cashRegister: { select: { name: true } },
        openedBy: {
          select: {
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      openedAt: row.openedAt.toISOString(),
      register: row.cashRegister.name,
      holder: personName(row.openedBy),
      openingFloat: row.openingFloatCentimes,
      expected: row.expectedCentimes,
      counted: row.countedCentimes,
      variance: row.varianceCentimes,
      status: row.wasAutoClosed
        ? dictionary.report.values.autoClosed
        : (dictionary.treasuryOptions.sessionStatuses[
            row.status as keyof typeof dictionary.treasuryOptions.sessionStatuses
          ] ?? row.status),
    }));
  },

  /* Synthèse des règlements par élève: one line per pupil, what they paid. */
  "reglements-par-eleve": async (context, params, range) => {
    const rows = await db.paymentAllocation.findMany({
      where: allocationScope(context, params, range),
      take: SCAN_CAP,
      select: {
        amountCentimes: true,
        paymentId: true,
        enrollmentFee: {
          select: {
            enrollment: {
              select: {
                student: {
                  select: { code: true, firstName: true, lastName: true },
                },
                schoolClass: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    const byPupil = new Map<
      string,
      {
        pupil: string;
        class: string | null;
        receipts: Set<string>;
        amount: number;
      }
    >();

    for (const row of rows) {
      const enrolment = row.enrollmentFee.enrollment;
      const bucket = byPupil.get(enrolment.student.code) ?? {
        pupil: fullName(enrolment.student),
        class: enrolment.schoolClass?.code ?? null,
        receipts: new Set<string>(),
        amount: 0,
      };
      bucket.receipts.add(row.paymentId);
      bucket.amount += row.amountCentimes;
      byPupil.set(enrolment.student.code, bucket);
    }

    return [...byPupil.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([code, bucket]) => ({
        code,
        pupil: bucket.pupil,
        class: bucket.class,
        receipts: bucket.receipts.size,
        amount: bucket.amount,
      }));
  },

  /*
    Liste des paiements payées par élève: the receipts themselves, attributed to
    the pupil they were spent on. A receipt covering two children appears twice,
    each time for its own share — the sum down the column is what the school
    took, not what it wrote.
  */
  "paiements-par-eleve": async (context, params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.paymentAllocation.findMany({
      where: allocationScope(context, params, range),
      orderBy: [{ payment: { paidAt: "desc" } }],
      take: SCAN_CAP,
      select: {
        amountCentimes: true,
        paymentId: true,
        payment: {
          select: {
            code: true,
            paidAt: true,
            tenders: { select: { method: true } },
          },
        },
        enrollmentFee: {
          select: {
            enrollment: {
              select: {
                student: {
                  select: { code: true, firstName: true, lastName: true },
                },
                schoolClass: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    // Collapsed per receipt per pupil: one receipt paying four months of the
    // same child is one payment, not four.
    const byReceiptAndPupil = new Map<string, ReportRow>();

    for (const row of rows) {
      const enrolment = row.enrollmentFee.enrollment;
      const key = `${row.paymentId}:${enrolment.student.code}`;
      const existing = byReceiptAndPupil.get(key);
      if (existing) {
        existing.amount = Number(existing.amount) + row.amountCentimes;
        continue;
      }
      byReceiptAndPupil.set(key, {
        code: enrolment.student.code,
        pupil: fullName(enrolment.student),
        class: enrolment.schoolClass?.code ?? null,
        receipt: row.payment.code,
        date: row.payment.paidAt.toISOString(),
        method: methods(row.payment.tenders, dictionary),
        amount: row.amountCentimes,
      });
    }

    return [...byReceiptAndPupil.values()];
  },

  /*
    Attestation de paiement: who may be given one.

    Only the pupils whose schedule is fully settled to date, because that is
    what the certificate asserts. Issuing it to a family still owing March is
    the mistake this list exists to prevent, so a partial payer is absent rather
    than shown with a balance.
  */
  "attestation-paiement": async (context, params) => {
    const rows = await db.enrollment.findMany({
      where: pupilScope(context, params),
      orderBy: [{ student: { lastName: "asc" } }],
      take: SCAN_CAP,
      select: {
        student: { select: { code: true, firstName: true, lastName: true } },
        schoolClass: { select: { code: true } },
        fees: {
          where: { status: "DUE" },
          select: {
            amountCentimes: true,
            allocations: {
              where: { payment: { status: "POSTED" } },
              select: {
                amountCentimes: true,
                payment: { select: { paidAt: true } },
              },
            },
          },
        },
      },
    });

    return rows
      .map((row) => {
        let charged = 0;
        let collected = 0;
        let lastPaidOn: Date | null = null;

        for (const line of row.fees) {
          charged += line.amountCentimes;
          for (const allocation of line.allocations) {
            collected += allocation.amountCentimes;
            if (!lastPaidOn || allocation.payment.paidAt > lastPaidOn) {
              lastPaidOn = allocation.payment.paidAt;
            }
          }
        }

        return {
          settled: charged > 0 && collected >= charged,
          row: {
            code: row.student.code,
            pupil: fullName(row.student),
            class: row.schoolClass?.code ?? null,
            charged,
            collected,
            lastPaidOn: lastPaidOn ? lastPaidOn.toISOString() : null,
          },
        };
      })
      .filter((entry) => entry.settled)
      .map((entry) => entry.row);
  },

  /*
    Synthèse périodique: the schedule collapsed to its instalments — what each
    échéance of the year raised, took and is still owed. The row a school reads
    to see which month of the year it collects badly.
  */
  "synthese-periodique": async (context, params, range) => {
    const rows = await db.enrollmentFee.findMany({
      where: feeScope(context, params, range),
      take: SCAN_CAP,
      select: {
        dueMonth: true,
        dueYear: true,
        status: true,
        amountCentimes: true,
        allocations: {
          where: { payment: { status: "POSTED" } },
          select: { amountCentimes: true },
        },
      },
    });

    const byPeriod = new Map<
      string,
      { lines: number; charged: number; collected: number; balance: number }
    >();

    for (const line of rows) {
      const key = `${line.dueYear}-${String(line.dueMonth).padStart(2, "0")}`;
      const bucket = byPeriod.get(key) ?? {
        lines: 0,
        charged: 0,
        collected: 0,
        balance: 0,
      };
      const collected = line.allocations.reduce(
        (sum, allocation) => sum + allocation.amountCentimes,
        0,
      );
      const payable = line.status === "DUE";
      bucket.lines += 1;
      bucket.charged += payable ? line.amountCentimes : 0;
      bucket.collected += collected;
      bucket.balance += payable ? line.amountCentimes - collected : 0;
      byPeriod.set(key, bucket);
    }

    return [...byPeriod.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([period, bucket]) => ({ period, ...bucket }));
  },

  /*
    Règlements par chèque. Read off the tenders rather than the receipts,
    because a receipt settled half in cash and half by cheque belongs on this
    list for the cheque half only.
  */
  "reglements-cheque": async (context, _params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.paymentTender.findMany({
      where: {
        method: "CHEQUE",
        payment: {
          schoolId: schoolId(context),
          status: "POSTED",
          paidAt: { gte: range.from, lte: range.to },
        },
      },
      orderBy: [{ payment: { paidAt: "desc" } }],
      take: ROW_CAP + 1,
      select: {
        amountCentimes: true,
        reference: true,
        bankName: true,
        bank: { select: { name: true } },
        cheque: {
          select: {
            number: true,
            dueOn: true,
            status: true,
            bankName: true,
            bank: { select: { name: true } },
          },
        },
        payment: {
          select: {
            code: true,
            paidAt: true,
            family: { select: { name: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      date: row.payment.paidAt.toISOString(),
      receipt: row.payment.code,
      family: row.payment.family?.name ?? null,
      // The bank may have been declared on the tender or on the cheque itself;
      // the family only ever named it once, so either is the answer.
      bank:
        row.bank?.name ??
        row.bankName ??
        row.cheque?.bank?.name ??
        row.cheque?.bankName ??
        null,
      chequeNumber: row.cheque?.number ?? row.reference,
      dueOn: row.cheque?.dueOn?.toISOString() ?? null,
      chequeStatus: row.cheque
        ? (dictionary.treasuryOptions.chequeStatuses[
            row.cheque.status as keyof typeof dictionary.treasuryOptions.chequeStatuses
          ] ?? row.cheque.status)
        : null,
      amount: row.amountCentimes,
    }));
  },

  /* Paiements par espèce — the same, for the cash half. */
  "reglements-espece": async (context, _params, range) => {
    const rows = await db.paymentTender.findMany({
      where: {
        method: "CASH",
        payment: {
          schoolId: schoolId(context),
          status: "POSTED",
          paidAt: { gte: range.from, lte: range.to },
        },
      },
      orderBy: [{ payment: { paidAt: "desc" } }],
      take: ROW_CAP + 1,
      select: {
        amountCentimes: true,
        payment: {
          select: {
            code: true,
            paidAt: true,
            family: { select: { name: true } },
            createdBy: {
              select: {
                email: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      date: row.payment.paidAt.toISOString(),
      receipt: row.payment.code,
      family: row.payment.family?.name ?? null,
      takenBy: personName(row.payment.createdBy),
      amount: row.amountCentimes,
    }));
  },

  /*
    Réductions par service: what the school gave away, and on what.

    Both halves of a reduction count — the percentage and the flat amount — so
    the figure is `base − net` rather than either column, which is the only form
    that stays right when a line carries both.
  */
  "reductions-par-service": async (context, params, range) => {
    const rows = await db.enrollmentFee.findMany({
      where: feeScope(context, params, range),
      take: SCAN_CAP,
      select: {
        baseAmountCentimes: true,
        amountCentimes: true,
        status: true,
        feeType: { select: { name: true, position: true } },
      },
    });

    const byService = new Map<
      string,
      { position: number; lines: number; base: number; charged: number }
    >();

    for (const line of rows) {
      if (line.status !== "DUE") continue;
      if (line.baseAmountCentimes <= line.amountCentimes) continue;
      const bucket = byService.get(line.feeType.name) ?? {
        position: line.feeType.position,
        lines: 0,
        base: 0,
        charged: 0,
      };
      bucket.lines += 1;
      bucket.base += line.baseAmountCentimes;
      bucket.charged += line.amountCentimes;
      byService.set(line.feeType.name, bucket);
    }

    return [...byService.entries()]
      .sort((left, right) => left[1].position - right[1].position)
      .map(([service, bucket]) => ({
        service,
        lines: bucket.lines,
        base: bucket.base,
        reduction: bucket.base - bucket.charged,
        charged: bucket.charged,
      }));
  },

  /* Échéances payées: settled in full, with the day the last centime landed. */
  "echeances-payees": async (context, params, range) => {
    const rows = await db.enrollmentFee.findMany({
      where: { ...feeScope(context, params, range), status: "DUE" },
      orderBy: [{ dueDate: "asc" }],
      take: SCAN_CAP,
      select: feeLineSelect,
    });

    return rows
      .filter((line) => settled(line) >= line.amountCentimes && line.amountCentimes > 0)
      .map((line) => ({
        code: line.enrollment.student.code,
        pupil: fullName(line.enrollment.student),
        class: line.enrollment.schoolClass?.code ?? null,
        service: line.feeType.name,
        dueDate: line.dueDate.toISOString(),
        paidOn: lastPaidOn(line),
        amount: line.amountCentimes,
      }));
  },

  /* Échéances impayées: the mirror of the above, with how late each one is. */
  "echeances-impayees": async (context, params, range) => {
    const rows = await db.enrollmentFee.findMany({
      where: { ...feeScope(context, params, range), status: "DUE" },
      orderBy: [{ dueDate: "asc" }],
      take: SCAN_CAP,
      select: feeLineSelect,
    });

    const now = new Date();

    return rows
      .map((line) => {
        const collected = settled(line);
        return {
          code: line.enrollment.student.code,
          pupil: fullName(line.enrollment.student),
          class: line.enrollment.schoolClass?.code ?? null,
          service: line.feeType.name,
          dueDate: line.dueDate.toISOString(),
          charged: line.amountCentimes,
          collected,
          balance: line.amountCentimes - collected,
          // Negative would mean "not due yet", which is not lateness.
          daysLate: Math.max(0, daysBetween(line.dueDate, now)),
        };
      })
      .filter((row) => row.balance > 0);
  },

  /*
    Impayés par matricule: the same arrears one line per pupil, in matricule
    order — the form the secretariat works down when it rings round, and the
    reason `oldestDue` is here rather than a due date per line.
  */
  "echeances-impayees-matricule": async (context, params, range) => {
    const rows = await db.enrollmentFee.findMany({
      where: { ...feeScope(context, params, range), status: "DUE" },
      take: SCAN_CAP,
      select: feeLineSelect,
    });

    const now = new Date();
    const byPupil = new Map<
      string,
      {
        pupil: string;
        class: string | null;
        lines: number;
        oldestDue: Date;
        balance: number;
      }
    >();

    for (const line of rows) {
      const balance = line.amountCentimes - settled(line);
      if (balance <= 0) continue;
      const student = line.enrollment.student;
      const bucket = byPupil.get(student.code) ?? {
        pupil: fullName(student),
        class: line.enrollment.schoolClass?.code ?? null,
        lines: 0,
        oldestDue: line.dueDate,
        balance: 0,
      };
      bucket.lines += 1;
      bucket.balance += balance;
      if (line.dueDate < bucket.oldestDue) bucket.oldestDue = line.dueDate;
      byPupil.set(student.code, bucket);
    }

    return [...byPupil.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([code, bucket]) => ({
        code,
        pupil: bucket.pupil,
        class: bucket.class,
        lines: bucket.lines,
        oldestDue: bucket.oldestDue.toISOString(),
        daysLate: Math.max(0, daysBetween(bucket.oldestDue, now)),
        balance: bucket.balance,
      }));
  },

  /*
    Recettes / dépenses: the ledger itself, in order, both sides in their own
    column. Cancelled movements are excluded here and shown by `reglements-
    annules` instead — a cash book that silently included them would not add up
    to the drawer.
  */
  "recettes-depenses": async (context, _params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.cashOperation.findMany({
      where: {
        schoolId: schoolId(context),
        status: "POSTED",
        kind: { in: ["ENCAISSEMENT", "DECAISSEMENT"] },
        occurredAt: { gte: range.from, lte: range.to },
      },
      orderBy: [{ occurredAt: "asc" }],
      take: ROW_CAP + 1,
      select: {
        occurredAt: true,
        kind: true,
        label: true,
        method: true,
        amountCentimes: true,
        category: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      date: row.occurredAt.toISOString(),
      label: row.label,
      category: row.category?.name ?? null,
      method:
        dictionary.treasuryOptions.methods[
          row.method as keyof typeof dictionary.treasuryOptions.methods
        ] ?? row.method,
      moneyIn: row.kind === "ENCAISSEMENT" ? row.amountCentimes : null,
      moneyOut: row.kind === "DECAISSEMENT" ? row.amountCentimes : null,
    }));
  },

  /*
    Avis de relance: who to chase, with the number to ring.

    Ordered by how late the oldest unpaid instalment is rather than by name or
    by amount — a small debt six months old is a harder conversation than a
    large one from last week, and it is the one the school should have first.
  */
  relances: async (context, params, range) => {
    const rows = await db.enrollmentFee.findMany({
      where: { ...feeScope(context, params, range), status: "DUE" },
      take: SCAN_CAP,
      select: {
        dueDate: true,
        amountCentimes: true,
        allocations: {
          where: { payment: { status: "POSTED" } },
          select: { amountCentimes: true },
        },
        enrollment: {
          select: {
            student: {
              select: {
                code: true,
                firstName: true,
                lastName: true,
                family: {
                  select: {
                    name: true,
                    phone: true,
                    guardians: {
                      where: { isActive: true },
                      orderBy: [{ isPrimaryContact: "desc" }],
                      select: { phone: true },
                      take: 1,
                    },
                  },
                },
              },
            },
            schoolClass: { select: { code: true } },
          },
        },
      },
    });

    const now = new Date();
    const byPupil = new Map<
      string,
      {
        pupil: string;
        class: string | null;
        family: string | null;
        phone: string | null;
        oldestDue: Date;
        balance: number;
      }
    >();

    for (const line of rows) {
      const collected = line.allocations.reduce(
        (sum, allocation) => sum + allocation.amountCentimes,
        0,
      );
      const balance = line.amountCentimes - collected;
      // Only what has actually fallen due: a relance for next term is a mistake.
      if (balance <= 0 || line.dueDate > now) continue;

      const student = line.enrollment.student;
      const bucket = byPupil.get(student.code) ?? {
        pupil: fullName(student),
        class: line.enrollment.schoolClass?.code ?? null,
        family: student.family?.name ?? null,
        phone:
          student.family?.phone ??
          student.family?.guardians[0]?.phone ??
          null,
        oldestDue: line.dueDate,
        balance: 0,
      };
      bucket.balance += balance;
      if (line.dueDate < bucket.oldestDue) bucket.oldestDue = line.dueDate;
      byPupil.set(student.code, bucket);
    }

    return [...byPupil.entries()]
      .map(([code, bucket]) => ({
        code,
        pupil: bucket.pupil,
        class: bucket.class,
        family: bucket.family,
        phone: bucket.phone,
        oldestDue: bucket.oldestDue.toISOString(),
        daysLate: daysBetween(bucket.oldestDue, now),
        balance: bucket.balance,
      }))
      .sort((left, right) => right.daysLate - left.daysLate);
  },

  /*
    Chèques par état d'encaissement. Ranged on the cheque's own due date rather
    than on when it was taken: the question this answers is "what is coming in,
    or should have", which is a fact about the échéance.
  */
  "cheques-par-etat": async (context, _params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.cheque.findMany({
      where: {
        schoolId: schoolId(context),
        direction: "INCOMING",
        OR: [
          { dueOn: { gte: range.from, lte: range.to } },
          // A cheque with no échéance would otherwise never appear anywhere.
          { dueOn: null, createdAt: { gte: range.from, lte: range.to } },
        ],
      },
      orderBy: [{ status: "asc" }, { dueOn: "asc" }],
      take: ROW_CAP + 1,
      select: {
        status: true,
        number: true,
        bankName: true,
        drawerName: true,
        dueOn: true,
        depositedOn: true,
        settledOn: true,
        amountCentimes: true,
        bank: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      chequeStatus:
        dictionary.treasuryOptions.chequeStatuses[
          row.status as keyof typeof dictionary.treasuryOptions.chequeStatuses
        ] ?? row.status,
      chequeNumber: row.number,
      bank: row.bank?.name ?? row.bankName,
      drawer: row.drawerName,
      dueOn: row.dueOn?.toISOString() ?? null,
      depositedOn: row.depositedOn?.toISOString() ?? null,
      settledOn: row.settledOn?.toISOString() ?? null,
      amount: row.amountCentimes,
    }));
  },

  /*
    Journal des annulations des services de l'inscription: every charge that
    stopped being owed, why, and who decided — read straight off the trail
    `repriceFeeLine` stamps. Ranged on when it was cancelled, not when it fell
    due, because that is the act being audited.
  */
  "annulations-services": async (context, params, range) => {
    const dictionary = await getDictionary();
    const rows = await db.enrollmentFee.findMany({
      where: {
        enrollment: pupilScope(context, params),
        ...(params.feeTypeId ? { feeTypeId: params.feeTypeId } : {}),
        status: { not: "DUE" },
        cancelledAt: { gte: range.from, lte: range.to },
      },
      orderBy: [{ cancelledAt: "desc" }],
      take: ROW_CAP + 1,
      select: {
        cancelledAt: true,
        cancelReason: true,
        status: true,
        amountCentimes: true,
        feeType: { select: { name: true } },
        cancelledBy: {
          select: {
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
        enrollment: {
          select: {
            student: { select: { code: true, firstName: true, lastName: true } },
            schoolClass: { select: { code: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      cancelledOn: row.cancelledAt?.toISOString() ?? null,
      code: row.enrollment.student.code,
      pupil: fullName(row.enrollment.student),
      class: row.enrollment.schoolClass?.code ?? null,
      service: row.feeType.name,
      status:
        dictionary.enrolmentOptions.lineStatuses[
          row.status as keyof typeof dictionary.enrolmentOptions.lineStatuses
        ] ?? row.status,
      reason: row.cancelReason,
      cancelledBy: row.cancelledBy ? personName(row.cancelledBy) : null,
      amount: row.amountCentimes,
    }));
  },

  /* Règlements annulés: receipts voided, with the reason given at the time. */
  "reglements-annules": async (context, _params, range) => {
    const rows = await db.payment.findMany({
      where: {
        schoolId: schoolId(context),
        status: "CANCELLED",
        cancelledAt: { gte: range.from, lte: range.to },
      },
      orderBy: [{ cancelledAt: "desc" }],
      take: ROW_CAP + 1,
      select: {
        code: true,
        paidAt: true,
        cancelledAt: true,
        cancelReason: true,
        totalCentimes: true,
        family: { select: { name: true } },
        createdBy: {
          select: {
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      receipt: row.code,
      date: row.paidAt.toISOString(),
      cancelledOn: row.cancelledAt?.toISOString() ?? null,
      family: row.family?.name ?? null,
      reason: row.cancelReason,
      takenBy: personName(row.createdBy),
      amount: row.totalCentimes,
    }));
  },

  // ── Ressources humaines ───────────────────────────────────────────────────
  paie: async (context, params, range) => {
    /*
      A bulletin is filed against a *month*, not a date, so the range is turned
      into the months it covers. Filtering on `createdAt` would report when a
      secretary typed it rather than the month it pays for.
    */
    const first = range.from.getFullYear() * 12 + range.from.getMonth();
    const last = range.to.getFullYear() * 12 + range.to.getMonth();

    const rows = await db.salaryPayment.findMany({
      where: {
        staff: {
          schoolId: schoolId(context),
          ...(params.staffId ? { id: params.staffId } : {}),
        },
        /*
          Narrowed to the years the range covers before the take, not only after
          it. The month test below is the exact one and stays, but without a
          bound in SQL the take returned the *newest* 5000 bulletins whatever was
          asked for — so a school past that many would report an old month as
          empty rather than as truncated, which reads as "nobody was paid".
        */
        periodYear: {
          gte: range.from.getFullYear(),
          lte: range.to.getFullYear(),
        },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      take: ROW_CAP + 1,
      select: {
        periodYear: true,
        periodMonth: true,
        baseCentimes: true,
        allowanceCentimes: true,
        overtimeCentimes: true,
        bonusCentimes: true,
        netCentimes: true,
        status: true,
        staff: { select: { code: true, firstName: true, lastName: true } },
      },
    });

    return rows
      .filter((row) => {
        const month = row.periodYear * 12 + (row.periodMonth - 1);
        return month >= first && month <= last;
      })
      .map((row) => {
        const gross =
          row.baseCentimes +
          row.allowanceCentimes +
          row.overtimeCentimes +
          row.bonusCentimes;
        return {
          code: row.staff.code,
          staff: `${row.staff.lastName} ${row.staff.firstName}`,
          period: `${String(row.periodMonth).padStart(2, "0")}/${row.periodYear}`,
          gross,
          deductions: gross - row.netCentimes,
          net: row.netCentimes,
          status: row.status,
        };
      });
  },

  avances: async (context, params, range) => {
    const rows = await db.salaryAdvance.findMany({
      where: {
        staff: {
          schoolId: schoolId(context),
          ...(params.staffId ? { id: params.staffId } : {}),
        },
        requestedOn: { gte: range.from, lte: range.to },
      },
      orderBy: [{ requestedOn: "desc" }],
      take: ROW_CAP + 1,
      select: {
        requestedOn: true,
        amountCentimes: true,
        status: true,
        staff: { select: { firstName: true, lastName: true } },
        recoveries: { select: { amountCentimes: true } },
      },
    });

    return rows.map((row) => {
      const recovered = row.recoveries.reduce(
        (total, recovery) => total + recovery.amountCentimes,
        0,
      );
      const owed = ["PAID", "RECOVERED"].includes(row.status)
        ? Math.max(0, row.amountCentimes - recovered)
        : 0;
      return {
        staff: `${row.staff.lastName} ${row.staff.firstName}`,
        requestedOn: row.requestedOn.toISOString(),
        amount: row.amountCentimes,
        recovered,
        outstanding: owed,
        status: row.status,
      };
    });
  },

  "presence-personnel": async (context, params, range) => {
    const rows = await db.staff.findMany({
      where: {
        schoolId: schoolId(context),
        ...(params.staffId ? { id: params.staffId } : {}),
      },
      orderBy: [{ lastName: "asc" }],
      take: ROW_CAP + 1,
      select: {
        code: true,
        firstName: true,
        lastName: true,
        attendance: {
          where: { date: { gte: range.from, lte: range.to } },
          select: { status: true },
        },
      },
    });

    return rows.map((row) => ({
      code: row.code,
      staff: `${row.lastName} ${row.firstName}`,
      present: row.attendance.filter((mark) => mark.status === "PRESENT").length,
      absent: row.attendance.filter((mark) => mark.status === "ABSENT").length,
      late: row.attendance.filter((mark) => mark.status === "LATE").length,
    }));
  },

  // ── Scolarité ─────────────────────────────────────────────────────────────
  resultats: async (context, params, range) => {
    const rows = await db.enrollment.findMany({
      where: pupilScope(context, params),
      orderBy: [{ student: { lastName: "asc" } }],
      take: ROW_CAP + 1,
      select: {
        student: { select: { code: true, firstName: true, lastName: true } },
        schoolClass: { select: { code: true } },
        assessmentGrades: {
          where: {
            score: { not: null },
            assessment: {
              status: { in: ["PUBLISHED", "GRADED"] },
              assessmentType: { countsTowardAverage: true },
              scheduledOn: { gte: range.from, lte: range.to },
            },
          },
          select: {
            score: true,
            assessment: { select: { maxScore: true, coefficient: true } },
          },
        },
      },
    });

    return rows
      .map((row) => {
        /*
          Weighted on the school's own scale, and every mark rebased onto it
          first: a paper out of 10 and one out of 20 cannot be averaged raw, and
          doing it anyway is how an oral quietly halves somebody's mean.
        */
        const outOf = context.settings.gradingMaxScore;
        let weighted = 0;
        let weight = 0;

        for (const grade of row.assessmentGrades) {
          if (grade.score === null || grade.assessment.maxScore <= 0) continue;
          const rebased = (grade.score / grade.assessment.maxScore) * outOf;
          weighted += rebased * grade.assessment.coefficient;
          weight += grade.assessment.coefficient;
        }

        return {
          code: row.student.code,
          pupil: `${row.student.lastName} ${row.student.firstName}`,
          class: row.schoolClass?.code ?? null,
          marked: row.assessmentGrades.length,
          average:
            weight === 0 ? null : Math.round((weighted / weight) * 100) / 100,
        };
      })
      .filter((row) => row.marked > 0);
  },
};

/**
 * Runs one report and totals the columns that asked for it.
 *
 * The permission is re-checked here rather than only on the page: a report is
 * reachable by its id, and the catalogue's `permission` is what stands between
 * a teacher and the payroll. Returns null when the reader may not have it, which
 * the caller turns into a forbidden state rather than an empty table.
 */
export async function runReport(
  context: AuthContext,
  reportId: string,
  params: ReportParams,
): Promise<ReportResult | null> {
  const definition = findReport(reportId);
  // `Object.hasOwn` rather than a bare lookup: `RUNNERS` is a plain object, so
  // `RUNNERS["constructor"]` would otherwise answer a function and sail past the
  // truthiness check below. The catalogue is array-scanned and would refuse it
  // first — this is the belt behind that brace.
  const runner = Object.hasOwn(RUNNERS, reportId) ? RUNNERS[reportId] : undefined;
  if (!definition || !runner) return null;
  if (!context.can(definition.permission as never)) return null;

  const from = new Date(`${params.from}T00:00:00`);
  // Inclusive: a range typed as "1 to 31 January" must contain the 31st.
  const to = new Date(`${params.to}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  const all = await runner(context, params, { from, to });
  const truncated = all.length > ROW_CAP;
  const rows = truncated ? all.slice(0, ROW_CAP) : all;

  /*
    No totals row on a truncated report.

    The runners stop reading at `ROW_CAP + 1`, so once a report is cut there is
    no honest total to publish: summing the rows that survived would print a
    figure labelled "Total" that is short by however much was left behind, and a
    bursar reading a partial takings figure as the day's takings is worse than
    reading no figure at all. The caption already says how many rows of how many
    are shown — the answer is to narrow the range, not to trust the sum. Same
    rule as the columns that decline a total because they would need weighting.
  */
  const totals: Record<string, number> = {};
  if (!truncated) {
    for (const column of definition.columns) {
      if (!column.total) continue;
      totals[column.key] = rows.reduce((sum, row) => {
        const value = row[column.key];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);
    }
  }

  return { rows, totals, rowCount: all.length, truncated };
}
