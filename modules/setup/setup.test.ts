import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { levelSubjectScopeKey } from "@/modules/academics/enums";
import {
  CYCLE_CATALOGUE,
  MOROCCAN_CURSUS,
  SUBJECTS,
  WEEKLY_TEACHING_MINUTES,
} from "@/modules/academics/presets";
import { feeRateScopeKey } from "@/modules/billing/enums";
import { offeringScopeKey } from "@/modules/classes/enums";
import { MOROCCAN_NEIGHBOURHOODS } from "@/modules/geography/presets";
import {
  REFERENCE_SIZES,
  classCodesFor,
  levelByCode,
  levelsFor,
  nomenclatureOf,
  programmeFor,
  suggestedFeeAmount,
  suggestedRooms,
} from "@/modules/setup/catalogue";
import { slotsForBell, weeklyTeachingMinutes } from "@/modules/setup/bell";

/**
 * The setup wizard: one submit, thirty-odd tables, one transaction.
 *
 * Four things here are not checkable by types and are the whole reason this
 * file exists. The parallel arrays the programme step posts must zip by index
 * or every coefficient lands on the wrong subject. The denormalised `schoolId`
 * and the three `scopeKey`s must come from the transaction and their helpers,
 * never from the form. Every write must have upsert semantics — `upsertMany`
 * now, rather than one upsert per row — because the wizard is re-runnable on a
 * school somebody has already started editing. And the
 * reference lists must land whatever was ticked, without undoing the two
 * things a school edits in place — its appréciation scale and who holds a till.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: Record<string, unknown> }[] = [];
let answers: Record<string, unknown> = {};

/** Ids the fake client hands back, so the applier's own maps are exercised. */
let nextId = 0;

/**
 * What `createMany` has laid down, so `findMany` hands it back.
 *
 * The applier writes in bulk — read the table, `createMany` what is missing,
 * read back for the ids (see `bulk.ts`) — so a client that answered every
 * `findMany` with `[]` would hand it an empty id map and the whole cursus below
 * a level would silently write nothing. The double therefore has to remember.
 * The `where` is ignored: scoping is a query concern and these tests are about
 * what gets written.
 */
const stored: Record<string, Record<string, unknown>[]> = {};

const client = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: Record<string, unknown>) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            if (op === "findMany") return stored[model] ?? [];
            if (op === "count") return (stored[model] ?? []).length;
            if (op === "findFirst" || op === "findUnique") return null;
            if (op === "updateMany") return { count: 0 };
            if (op === "createMany") {
              const rows = (args.data as Record<string, unknown>[]) ?? [];
              const table = (stored[model] ??= []);
              for (const row of rows) {
                nextId += 1;
                table.push({ ...row, id: `${model}-${nextId}` });
              }
              return { count: rows.length };
            }
            nextId += 1;
            return { id: `${model}-${nextId}` };
          },
        },
      ),
  },
);

const db = new Proxy(
  {},
  {
    get: (_target, prop: string) => {
      if (prop === "$transaction") {
        return async (run: (tx: unknown) => Promise<unknown>) => run(client);
      }
      return (client as Record<string, unknown>)[prop];
    },
  },
);

/*
  The same recorder under both names. `applySetup` opens its transaction on
  `auditClient` — the client without the audit extension, because a thousand
  audited writes do not fit in any transaction budget — and records the one
  event itself, which `recordedEvents` collects below.
*/
vi.mock("@/lib/db", () => ({ db, auditClient: db }));

const recordedEvents: Record<string, unknown>[] = [];
vi.mock("@/lib/audit", () => ({
  recordEvent: async (event: Record<string, unknown>) => {
    recordedEvents.push(event);
  },
}));

const granted = new Set<string>();
const askedOrg: string[] = [];
const askedSchool: string[] = [];

class ForbiddenError extends Error {
  readonly permission?: string;
  constructor(permission?: string) {
    super("Forbidden");
    this.permission = permission;
    this.name = "ForbiddenError";
  }
}

const context = {
  user: { id: "user-1" },
  organization: { id: "org-1" },
  currentSchool: null,
};

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  authorizeOrg: async (permission: string) => {
    askedOrg.push(permission);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return context;
  },
  authorizeSchool: async (_schoolId: string, permission: string) => {
    askedSchool.push(permission);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return context;
  },
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

/** `redirect` throws in Next; the action's success path ends in one. */
class RedirectError extends Error {
  readonly digest: string;
  constructor(readonly to: string) {
    super("redirect");
    this.digest = `NEXT_REDIRECT;${to}`;
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));

const { applySetup } = await import("@/modules/setup/service");
const { runSetupAction } = await import("@/modules/setup/actions");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

/** Every row `createMany` was handed for a table, in the order it was written. */
const created = (model: string): Record<string, unknown>[] =>
  of(model, "createMany").flatMap((call) => (call.args.data as Record<string, unknown>[]) ?? []);

const IDLE = { status: "idle" } as never;

beforeEach(() => {
  calls.length = 0;
  recordedEvents.length = 0;
  askedOrg.length = 0;
  askedSchool.length = 0;
  answers = {};
  granted.clear();
  nextId = 0;
  for (const model of Object.keys(stored)) delete stored[model];
});

// ── The catalogue is the only source of truth ────────────────────────────────

describe("the cursus preset", () => {
  it("still lays down the demonstration's cursus, préscolaire excluded", () => {
    // The extraction into presets.ts derives Level.position and
    // LevelSubject.position from these array lengths and orders, so a change
    // here silently renumbers every seeded school.
    expect(MOROCCAN_CURSUS.cycles).toHaveLength(3);
    expect(MOROCCAN_CURSUS.levels).toHaveLength(12);
    expect(MOROCCAN_CURSUS.tracks).toHaveLength(10);
    expect(MOROCCAN_CURSUS.subjects).toHaveLength(23);
    expect(MOROCCAN_CURSUS.programme).toHaveLength(223);

    expect(MOROCCAN_CURSUS.cycles.map((cycle) => cycle.cycle)).not.toContain("PRESCHOOL");
    expect(MOROCCAN_CURSUS.levels.map((level) => level.code)).toEqual([
      "1AP", "2AP", "3AP", "4AP", "5AP", "6AP",
      "1AC", "2AC", "3AC",
      "TC", "1BAC", "2BAC",
    ]);
  });

  it("offers préscolaire to the wizard even though the seed skips it", () => {
    expect(CYCLE_CATALOGUE.PRESCHOOL.levels.map((level) => level.code)).toEqual(["PS", "GS"]);
    expect(CYCLE_CATALOGUE.PRESCHOOL.tracks).toHaveLength(0);
    expect(CYCLE_CATALOGUE.PRESCHOOL.programme.length).toBeGreaterThan(0);
  });

  it("keeps every component after its parent", () => {
    for (const [index, subject] of SUBJECTS.entries()) {
      if (!subject.parent) continue;
      const parentIndex = SUBJECTS.findIndex((item) => item.code === subject.parent);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    }
  });

  it("drops programme rows of a filière the school did not take", () => {
    const withTrack = programmeFor(["2BAC"], ["2B-SVT"]);
    expect(withTrack.some((row) => row.trackCode === "2B-SVT")).toBe(true);
    expect(withTrack.some((row) => row.trackCode === "2B-PC")).toBe(false);

    // The common rows survive either way — that is what makes unticking a
    // filière cost the school nothing it still teaches.
    expect(withTrack.some((row) => row.trackCode === null)).toBe(true);
  });

  it("offers a lab only when the programme needs one", () => {
    const withScience = suggestedRooms({
      cycles: ["SECONDARY_QUALIFYING"],
      classCountByCycle: { SECONDARY_QUALIFYING: 2 },
      subjectCodes: ["SVT", "PC"],
    });
    expect(withScience.some((room) => room.kind === "LAB_SCIENCE")).toBe(true);
    expect(withScience.some((room) => room.kind === "LAB_COMPUTER")).toBe(false);

    const preschool = suggestedRooms({
      cycles: ["PRESCHOOL"],
      classCountByCycle: { PRESCHOOL: 2 },
      subjectCodes: ["AR", "FR"],
    });
    expect(preschool.some((room) => room.kind === "LAB_SCIENCE")).toBe(false);
    expect(preschool.filter((room) => room.kind === "CLASSROOM")).toHaveLength(2);
  });

  /*
    The two namings of the primaire.

    A school "qui travaille en CE" runs the Ministry's six years under French
    labels, so the danger is not the labels but everything keyed by the level
    code underneath them: the programme, the price list and the MASSAR export
    all have to follow the rename or the school comes out configured wrongly in
    a way nothing on screen shows.
  */
  it("renames the six primary years without changing the cursus", () => {
    const moroccan = levelsFor(["PRIMARY"], "MOROCCAN");
    const french = levelsFor(["PRIMARY"], "FRENCH");

    expect(moroccan.map((level) => level.code)).toEqual([
      "1AP", "2AP", "3AP", "4AP", "5AP", "6AP",
    ]);
    expect(french.map((level) => level.code)).toEqual([
      "CP", "CE1", "CE2", "CM1", "CM2", "6EME",
    ]);

    // Same years, same rank, and the Ministry's codes unchanged — a mark export
    // filed under "CE2" would be rejected.
    expect(french.map((level) => level.gradeYear)).toEqual(
      moroccan.map((level) => level.gradeYear),
    );
    expect(french.map((level) => level.massarCode)).toEqual(
      moroccan.map((level) => level.massarCode),
    );
  });

  it("gives the renamed years the same programme", () => {
    const moroccan = programmeFor(["3AP"], [], "MOROCCAN");
    const french = programmeFor(["CE2"], [], "FRENCH");

    expect(french).toHaveLength(moroccan.length);
    expect(french.map((row) => row.subjectCode)).toEqual(
      moroccan.map((row) => row.subjectCode),
    );
    expect(french.map((row) => row.coefficient)).toEqual(
      moroccan.map((row) => row.coefficient),
    );
    expect(french.every((row) => row.levelCode === "CE2")).toBe(true);
  });

  it("charges a renamed year the price its Ministry year carries", () => {
    expect(suggestedFeeAmount("SCOLARITE", "CE2")).toBe(
      suggestedFeeAmount("SCOLARITE", "3AP"),
    );
    // Not the flat fallback, which is what a missed translation would give.
    expect(suggestedFeeAmount("SCOLARITE", "CE2")).not.toBeNull();
    expect(suggestedFeeAmount("ASSURANCE", "CM1")).toBe(150);
  });

  it("resolves a posted code under either naming, and tells them apart", () => {
    expect(levelByCode("CE2")?.gradeYear).toBe(3);
    expect(levelByCode("3AP")?.gradeYear).toBe(3);
    expect(levelByCode("CE7")).toBeUndefined();

    expect(nomenclatureOf(["CP", "CE1", "1AC"])).toBe("FRENCH");
    expect(nomenclatureOf(["1AP", "2AP"])).toBe("MOROCCAN");
    // A plan naming the same year twice is refused rather than half applied.
    expect(nomenclatureOf(["3AP", "CE2"])).toBeNull();
    expect(nomenclatureOf(["TC", "1BAC"])).toBeNull();
  });

  it("names classes the way seedClasses does", () => {
    expect(classCodesFor("3AP", null, 2)).toEqual(["3AP-A", "3AP-B"]);
    expect(classCodesFor("2BAC", "2B-SVT", 1)).toEqual(["2BAC-2B-SVT-A"]);
    expect(classCodesFor("3AP", null, 0)).toEqual([]);
    // And under the French naming, from the same function.
    expect(classCodesFor("CE2", null, 2)).toEqual(["CE2-A", "CE2-B"]);
  });
});

// ── The bell ─────────────────────────────────────────────────────────────────

describe("the bell schedule", () => {
  const bell = {
    teachingDays: [1, 2, 3, 4, 5, 6],
    dayStartsAt: "08:00",
    afternoonStartsAt: "14:00",
    periodMinutes: 60,
    morningPeriods: 4,
    afternoonPeriods: 4,
    periodsBeforeBreak: 2,
    breakMinutes: 15,
    // Saturday stops at noon — which is now the school's own tick rather than
    // a `saturdayMorningOnly` rule about the sixth day.
    freeAfternoonDays: [6],
    withRamadan: false,
    ramadanStartsAt: "09:00",
    ramadanPeriods: 0,
  };

  it("lays a break after the period it is asked for", () => {
    const monday = slotsForBell(bell).filter(
      (slot) => slot.dayOfWeek === 1 && slot.session === "MORNING",
    );
    expect(monday.map((slot) => slot.startTime)).toEqual([
      "08:00", "09:00", "10:00", "10:15", "11:15",
    ]);
    expect(monday.filter((slot) => slot.isBreak)).toHaveLength(1);
    expect(monday.map((slot) => slot.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("continues the day's numbering into the afternoon", () => {
    const monday = slotsForBell(bell).filter((slot) => slot.dayOfWeek === 1);
    // Five in the morning (four periods and a break), five in the afternoon.
    expect(monday.map((slot) => slot.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("gives Saturday a morning and no afternoon", () => {
    const saturday = slotsForBell(bell).filter((slot) => slot.dayOfWeek === 6);
    expect(saturday.every((slot) => slot.session === "MORNING")).toBe(true);
    expect(saturday.length).toBeGreaterThan(0);
  });

  it("lays no break when none is asked for", () => {
    const slots = slotsForBell({ ...bell, periodsBeforeBreak: 0 });
    expect(slots.some((slot) => slot.isBreak)).toBe(false);
  });

  it("adds the Ramadan grid only when asked", () => {
    expect(slotsForBell(bell).some((slot) => slot.scheduleKind === "RAMADAN")).toBe(false);
    const withRamadan = slotsForBell({ ...bell, withRamadan: true, ramadanPeriods: 4 });
    expect(withRamadan.some((slot) => slot.scheduleKind === "RAMADAN")).toBe(true);
  });

  it("takes the afternoon off the free half-day and keeps its morning", () => {
    const slots = slotsForBell({ ...bell, freeAfternoonDays: [3] });
    const wednesday = slots.filter((slot) => slot.dayOfWeek === 3);
    expect(wednesday.every((slot) => slot.session === "MORNING")).toBe(true);
    expect(wednesday.length).toBeGreaterThan(0);
    // Every other teaching day keeps both halves — Saturday's afternoon comes
    // back, because nothing here is a rule about a named day.
    expect(slots.some((slot) => slot.dayOfWeek === 2 && slot.session === "AFTERNOON")).toBe(true);
    expect(slots.some((slot) => slot.dayOfWeek === 6 && slot.session === "AFTERNOON")).toBe(true);
  });

  it("takes off as many half-days as the school asks for", () => {
    // Friday afternoon for the prière and a Saturday that stops at noon — the
    // pair a single free afternoon beside a Saturday switch could not express.
    const slots = slotsForBell({ ...bell, freeAfternoonDays: [5, 6] });
    const afternoons = new Set(
      slots.filter((slot) => slot.session === "AFTERNOON").map((slot) => slot.dayOfWeek),
    );
    expect([...afternoons].sort()).toEqual([1, 2, 3, 4]);
    // Both keep their mornings.
    expect(slots.some((slot) => slot.dayOfWeek === 5)).toBe(true);
    expect(slots.some((slot) => slot.dayOfWeek === 6)).toBe(true);
  });

  it("counts the week the preset lays as thirty-six hours", () => {
    // Monday to Friday, 08h00–12h00 and 14h00–18h00 with Wednesday afternoon
    // off — the grid `WEEKLY_TEACHING_MINUTES` sizes every programme against.
    const week = weeklyTeachingMinutes({
      ...bell,
      teachingDays: [1, 2, 3, 4, 5],
      freeAfternoonDays: [3],
    });
    expect(week).toBe(WEEKLY_TEACHING_MINUTES);
    expect(week).toBe(36 * 60);
  });

  it("leaves the breaks out of the week it counts", () => {
    // Four periods plus a quarter-hour récréation is 4h15 on the clock and four
    // hours of lessons. The programme is sized against the second figure.
    expect(
      weeklyTeachingMinutes({
        ...bell,
        teachingDays: [1],
        freeAfternoonDays: [],
        afternoonPeriods: 0,
      }),
    ).toBe(240);
  });
});

// ── Every level's week is full ───────────────────────────────────────────────

describe("the programme fills the week", () => {
  /*
    The one arithmetic nobody adds up by hand, and the one that was wrong.

    A programme is a column of plausible weekly minutes; only the total says
    whether a class has a full timetable or a third of one sitting empty. Every
    level, and every filière of a level that has them, must come to exactly the
    grid — see `WEEKLY_TEACHING_MINUTES`.
  */
  for (const [cycle, entry] of Object.entries(CYCLE_CATALOGUE)) {
    for (const level of entry.levels) {
      const levelTracks = entry.tracks.filter((track) => track.levelCode === level.code);
      const targets: (string | null)[] =
        levelTracks.length > 0 ? levelTracks.map((track) => track.code) : [null];

      for (const trackCode of targets) {
        const label = [cycle, level.code, trackCode].filter(Boolean).join(" · ");

        it(`seats a full week — ${label}`, () => {
          const rows = entry.programme.filter(
            (row) =>
              row.levelCode === level.code &&
              (row.trackCode === null || row.trackCode === trackCode),
          );

          const total = rows.reduce((sum, row) => sum + (row.weeklyMinutes ?? 0), 0);
          expect(total).toBe(WEEKLY_TEACHING_MINUTES);

          /*
            And no subject counted twice. A row under the level and a second
            under one of its filières would write two `LevelSubject` rows for
            the same subject, so the class would carry the sum of the two with
            nothing on screen to say where the extra hours came from.
          */
          const timetabled = rows
            .filter((row) => row.weeklyMinutes)
            .map((row) => row.subjectCode);
          expect(new Set(timetabled).size).toBe(timetabled.length);
        });
      }
    }
  }

  it("names every subject the catalogue knows", () => {
    const known = new Set(SUBJECTS.map((subject) => subject.code));
    for (const row of MOROCCAN_CURSUS.programme) {
      expect(known.has(row.subjectCode)).toBe(true);
    }
  });
});

// ── The form contract ────────────────────────────────────────────────────────

function baseForm(extra: Record<string, string | string[]> = {}): FormData {
  const form = new FormData();
  form.set("mode", "new");
  form.set("code", "TEST");
  form.set("name", "École de test");
  form.set("level", "GROUP");
  form.set("country", "MA");
  form.set("isActive", "on");
  for (const [name, value] of Object.entries(extra)) {
    if (Array.isArray(value)) for (const item of value) form.append(name, item);
    else form.set(name, value);
  }
  return form;
}

/** A three-row programme table, posted as six aligned arrays. */
function programmeForm(rows: { level: string; subject: string; coef: string; included: string }[]) {
  return {
    cycle: ["PRIMARY"],
    levelCode: ["1AP"],
    subjectCode: ["AR", "MATH", "FR"],
    progLevelCode: rows.map((row) => row.level),
    progTrackCode: rows.map(() => ""),
    progSubjectCode: rows.map((row) => row.subject),
    progCoefficient: rows.map((row) => row.coef),
    progWeeklyMinutes: rows.map(() => ""),
    progIncluded: rows.map((row) => row.included),
  };
}

describe("the posted form", () => {
  beforeEach(() => {
    granted.add("school.create");
    granted.add("schoolYear.create");
    granted.add("configuration.manage");
  });

  it("zips the programme arrays by index", async () => {
    const form = baseForm(
      programmeForm([
        { level: "1AP", subject: "AR", coef: "6", included: "1" },
        { level: "1AP", subject: "MATH", coef: "5", included: "1" },
        { level: "1AP", subject: "FR", coef: "4", included: "1" },
      ]),
    );

    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    expect(created("levelSubject").map((row) => row.coefficient)).toEqual([6, 5, 4]);
  });

  it("refuses a ragged table rather than shifting every coefficient", async () => {
    const form = baseForm({
      cycle: ["PRIMARY"],
      levelCode: ["1AP"],
      subjectCode: ["AR", "MATH"],
      progLevelCode: ["1AP", "1AP"],
      progTrackCode: ["", ""],
      progSubjectCode: ["AR", "MATH"],
      // One coefficient short — the row that follows would take the wrong one.
      progCoefficient: ["6"],
      progWeeklyMinutes: ["", ""],
      progIncluded: ["1", "1"],
    });

    const result = await runSetupAction(IDLE, form);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.programme).toBe(t.setup.rowsMisaligned);
    expect(created("levelSubject")).toHaveLength(0);
  });

  it("drops an unticked row but keeps its slot", async () => {
    const form = baseForm(
      programmeForm([
        { level: "1AP", subject: "AR", coef: "6", included: "1" },
        { level: "1AP", subject: "MATH", coef: "5", included: "0" },
        { level: "1AP", subject: "FR", coef: "4", included: "1" },
      ]),
    );

    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    // The dropped row did not take the next row's coefficient with it.
    expect(created("levelSubject").map((row) => row.coefficient)).toEqual([6, 4]);
  });

  it("ignores a code the catalogue does not know", async () => {
    const form = baseForm({
      cycle: ["PRIMARY", "NOT_A_CYCLE"],
      levelCode: ["1AP", "FORGED"],
      subjectCode: ["AR", "FORGED-SUBJECT"],
    });

    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    expect(created("level").map((row) => row.code)).toEqual(["1AP"]);
    expect(created("educationLevel")).toHaveLength(1);
  });

  it("takes a level's name from the catalogue, never from the form", async () => {
    const form = baseForm({ cycle: ["PRIMARY"], levelCode: ["1AP"], name: "École de test" });
    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    const level = created("level")[0]!;
    expect(level.name).toBe("1ère année primaire");
    expect(level.massarCode).toBe("P1");
  });

  it("gives a hand-typed level no MASSAR code", async () => {
    const form = baseForm({
      cycle: ["PRIMARY"],
      levelCode: [],
      customLevelCycle: ["PRIMARY"],
      customLevelCode: ["7AP"],
      customLevelName: ["7ème année"],
      customLevelNameAr: [""],
      customLevelGradeYear: ["7"],
    });
    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    const level = created("level")[0]!;
    expect(level.code).toBe("7AP");
    // Nullable-unique on (school, massarCode): a typed code is how two levels
    // collide, so an invented level carries none.
    expect(level.massarCode).toBeNull();
  });
});

// ── Authorization ────────────────────────────────────────────────────────────

describe("authorization", () => {
  it("refuses a new school without school.create", async () => {
    const result = await runSetupAction(IDLE, baseForm());
    expect(result.status).toBe("error");
    expect(of("school", "create")).toHaveLength(0);
  });

  it("asks for configuration.manage only when it writes configuration", async () => {
    granted.add("school.create");
    granted.add("configuration.manage");

    await expect(runSetupAction(IDLE, baseForm())).rejects.toBeInstanceOf(RedirectError);
    expect(askedOrg).toEqual(["school.create"]);

    askedOrg.length = 0;
    calls.length = 0;
    await expect(
      runSetupAction(IDLE, baseForm({ cycle: ["PRIMARY"], levelCode: ["1AP"] })),
    ).rejects.toBeInstanceOf(RedirectError);
    expect(askedOrg).toEqual(["school.create", "configuration.manage"]);
  });

  it("scopes an existing school to itself and never to the organisation", async () => {
    granted.add("configuration.manage");
    granted.add("schoolYear.create");
    answers["school.findFirst"] = { id: "school-9" };

    const form = baseForm({ mode: "existing", schoolId: "school-9", cycle: ["PRIMARY"] });
    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    expect(askedOrg).toEqual([]);
    expect(askedSchool).toEqual(["configuration.manage"]);
    expect(of("school", "create")).toHaveLength(0);
  });
});

// ── The applier ──────────────────────────────────────────────────────────────

const EMPTY_PLAN = {
  settings: {},
  year: null,
  cycles: [],
  levels: [],
  tracks: [],
  subjects: [],
  programme: [],
  rooms: [],
  bell: null,
  offerings: [],
  groupsPerClass: 0,
  groupPurpose: "OTHER",
  feeTypes: [],
  feeRates: [],
  discounts: [],
};

const FULL_PLAN = {
  ...EMPTY_PLAN,
  year: {
    name: "2026-2027",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2027-06-30"),
    status: "ACTIVE",
    isDefault: true,
    terms: [
      {
        number: 1,
        name: "Semestre 1",
        nameAr: null,
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-01-15"),
      },
    ],
    holidays: [],
  },
  cycles: [{ cycle: "PRIMARY", name: "Primaire", nameAr: "ابتدائي", position: 2 }],
  levels: [
    {
      cycle: "PRIMARY",
      code: "1AP",
      name: "1ère année primaire",
      nameAr: null,
      gradeYear: 1,
      massarCode: "P1",
    },
  ],
  subjects: [
    {
      code: "MATH",
      name: "Mathématiques",
      nameAr: null,
      shortName: null,
      massarCode: null,
      parent: null,
      colorHex: null,
      isLanguage: false,
      requiresLab: false,
    },
  ],
  programme: [
    {
      levelCode: "1AP",
      trackCode: null,
      subjectCode: "MATH",
      coefficient: 5,
      weeklyMinutes: 300,
    },
  ],
  rooms: [
    { code: "A001", name: "Salle A001", kind: "CLASSROOM", building: null, floor: 0, capacity: 30 },
  ],
  offerings: [
    { levelCode: "1AP", trackCode: null, classCount: 2, capacity: 30, classCodes: ["1AP-A", "1AP-B"] },
  ],
  groupsPerClass: 2,
  groupPurpose: "LAB",
  feeTypes: [
    {
      code: "SCOLARITE",
      name: "Scolarité",
      nameAr: null,
      kind: "TUITION",
      billingCycle: "MONTHLY",
      isMandatory: true,
    },
  ],
  feeRates: [{ feeCode: "SCOLARITE", levelCode: "1AP", amountCentimes: 1500000 }],
  discounts: [],
};

describe("applySetup", () => {
  it("writes in an order the foreign keys allow", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    const order = calls
      .filter((call) => call.op === "createMany" || call.op === "upsert" || call.op === "create")
      .map((call) => call.model);

    const first = (model: string) => order.indexOf(model);
    expect(first("school")).toBeLessThan(first("schoolSettings"));
    expect(first("schoolSettings")).toBeLessThan(first("schoolYear"));
    expect(first("schoolYear")).toBeLessThan(first("term"));
    expect(first("term")).toBeLessThan(first("educationLevel"));
    expect(first("educationLevel")).toBeLessThan(first("level"));
    expect(first("level")).toBeLessThan(first("subject"));
    expect(first("subject")).toBeLessThan(first("levelSubject"));
    expect(first("levelSubject")).toBeLessThan(first("room"));
    expect(first("room")).toBeLessThan(first("feeType"));
    expect(first("feeType")).toBeLessThan(first("schoolWeek"));
    expect(first("schoolWeek")).toBeLessThan(first("feeRate"));
    expect(first("feeRate")).toBeLessThan(first("levelOffering"));
    expect(first("levelOffering")).toBeLessThan(first("schoolClass"));
    expect(first("schoolClass")).toBeLessThan(first("classGroup"));
  });

  it("derives every denormalised schoolId from the school it just wrote", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    // Whatever id the School row came back with — never anything from the plan.
    const schoolId = "school-1";
    expect(of("school", "create")).toHaveLength(1);

    for (const row of [...created("level"), ...created("schoolClass")]) {
      expect(row.schoolId).toBe(schoolId);
    }
  });

  it("puts every scopeKey through its own helper", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    expect(created("levelSubject")[0]!.scopeKey).toBe(levelSubjectScopeKey(null));
    expect(created("levelOffering")[0]!.scopeKey).toBe(offeringScopeKey(null));

    const rate = created("feeRate")[0]!;
    expect(rate.scopeKey).toBe(feeRateScopeKey(rate.levelId as string));
  });

  it("never lays a second copy of a row it already wrote", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    // Only the School row is a bare create; everything else goes through
    // `upsertMany`, which reads first.
    const bare = calls.filter((call) => call.op === "create").map((call) => call.model);
    expect([...new Set(bare)]).toEqual(["school"]);

    // And the second run writes nothing at all, because the double remembers
    // what the first one laid down — which is the whole idempotency claim.
    calls.length = 0;
    answers["school.findFirst"] = { id: "school-1", city: null };
    await applySetup("org-1", {
      school: { mode: "existing", id: "school-1" },
      ...FULL_PLAN,
    } as never);

    expect(calls.filter((call) => call.op === "createMany")).toHaveLength(0);
    expect(calls.filter((call) => call.op === "update")).toHaveLength(0);
  });

  it("never clears a class's room or titulaire on a re-run", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    // The school has since staffed and seated the class, and changed its size.
    const schoolClass = stored.schoolClass![0]!;
    schoolClass.roomId = "room-9";
    schoolClass.mainTeacherId = "staff-9";
    schoolClass.capacity = 99;

    calls.length = 0;
    answers["school.findFirst"] = { id: "school-1", city: null };
    await applySetup("org-1", {
      school: { mode: "existing", id: "school-1" },
      ...FULL_PLAN,
    } as never);

    // The capacity is corrected back to the plan's; the two the school decided
    // are not in the statement at all.
    const update = of("schoolClass", "update")[0]!.args.data as Record<string, unknown>;
    expect(update).toEqual({ capacity: 30 });
  });

  it("writes nothing year-scoped when the year step was skipped", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
      year: null,
    } as never);

    for (const model of ["term", "timeSlot", "schoolWeek", "feeRate", "levelOffering", "schoolClass", "classGroup"]) {
      expect(created(model), model).toHaveLength(0);
    }
    expect(of("schoolYear", "upsert")).toHaveLength(0);
    // The school, its settings and its cursus still land.
    expect(of("school", "create")).toHaveLength(1);
    expect(of("schoolSettings", "upsert")).toHaveLength(1);
    expect(created("level")).toHaveLength(1);
    expect(created("feeType")).toHaveLength(1);
  });

  /*
    ── One trail entry, not a thousand ───────────────────────────────────────
    The transaction runs on the client *without* the audit extension, because
    that extension costs a "before" read and an `activity_logs` insert per row
    and a school is about a thousand rows: audited, this write expired at both
    60 s and 120 s and the wizard could not save at all. The trail still hears
    about it — once, for the act that was actually performed.
  */
  it("records the setup as one event and not one per row", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T", name: "École T" } as never },
      ...FULL_PLAN,
    } as never);

    expect(recordedEvents).toHaveLength(1);
    expect(recordedEvents[0]).toMatchObject({
      action: "CREATE",
      entity: "School",
      entityLabel: "École T",
    });
    // And it says what was written, so the entry is worth reading.
    expect(recordedEvents[0]!.metadata).toMatchObject({ setupWizard: true });
  });

  it("records an existing school's configuration as an update", async () => {
    answers["school.findFirst"] = { id: "school-9" };
    await applySetup("org-1", {
      school: { mode: "existing", id: "school-9" },
      ...EMPTY_PLAN,
    } as never);

    expect(recordedEvents).toHaveLength(1);
    expect(recordedEvents[0]).toMatchObject({ action: "UPDATE", entity: "School" });
  });

  it("leaves no trail entry when the school could not be reached", async () => {
    answers["school.findFirst"] = null;
    await applySetup("org-1", {
      school: { mode: "existing", id: "elsewhere" },
      ...EMPTY_PLAN,
    } as never);

    // Nothing was written, so nothing is recorded as having been.
    expect(recordedEvents).toHaveLength(0);
  });

  it("refuses an existing school that is not in the organisation", async () => {
    answers["school.findFirst"] = null;
    const result = await applySetup("org-1", {
      school: { mode: "existing", id: "elsewhere" },
      ...EMPTY_PLAN,
    } as never);

    expect(result).toBeNull();
    expect(of("schoolSettings", "upsert")).toHaveLength(0);
  });

  /*
    ── The lists a school refers to rather than decides ──────────────────────
    They are written on every run, whatever was ticked, because a school with
    no town, no dossier, no kind of contrôle and no rubrique cannot enrol a
    pupil, mark a paper or take a dirham — see modules/setup/reference.ts.
    Before this, only `db:seed:config` wrote them, so a school opened through
    the wizard and a school opened by the seed were two different schools.
  */
  it("writes the reference lists even when every step is skipped", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...EMPTY_PLAN,
    } as never);

    expect(created("city")).toHaveLength(REFERENCE_SIZES.cities);
    expect(created("documentType")).toHaveLength(REFERENCE_SIZES.documentTypes);
    expect(created("documentRequestType")).toHaveLength(REFERENCE_SIZES.requestTypes);
    expect(created("assessmentType")).toHaveLength(REFERENCE_SIZES.assessmentTypes);
    expect(created("supplyArticle")).toHaveLength(REFERENCE_SIZES.supplyArticles);
    expect(created("cashRegister")).toHaveLength(REFERENCE_SIZES.registers);
    expect(created("operationCategory")).toHaveLength(REFERENCE_SIZES.categories);
    expect(created("operationSubcategory")).toHaveLength(REFERENCE_SIZES.subcategories);
    expect(created("operationMotif")).toHaveLength(REFERENCE_SIZES.motifs);
    expect(created("supplier")).toHaveLength(REFERENCE_SIZES.suppliers);
    expect(created("bank")).toHaveLength(REFERENCE_SIZES.banks);
    expect(of("appreciationBand", "createMany")).toHaveLength(1);

    // And the two hundred rows above cost a handful of statements, not two per
    // row — which is what the 120 s transaction kept expiring on.
    expect(calls.filter((call) => call.op === "createMany").length).toBeLessThan(30);
  });

  it("lays down only the quartiers of the town the school typed", async () => {
    // The town comes back from the row that was just written, never from the
    // plan: `School.city` is free text and the quartiers are matched on it.
    answers["school.create"] = { id: "school-1", city: "Oujda" };

    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...EMPTY_PLAN,
    } as never);

    const codes = created("neighbourhood").map((row) => row.code);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const quartier = MOROCCAN_NEIGHBOURHOODS.find((row) => row.code === code);
      expect(quartier?.cityCode).toBe("OUJDA");
    }
  });

  it("lays down no quartier for a town outside the starting list", async () => {
    answers["school.create"] = { id: "school-1", city: "Berkane" };

    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...EMPTY_PLAN,
    } as never);

    expect(created("neighbourhood")).toHaveLength(0);
    // The towns themselves are still laid in full — a birthplace is anywhere.
    expect(created("city")).toHaveLength(REFERENCE_SIZES.cities);
  });

  it("never rewrites an appreciation scale the school has edited", async () => {
    answers["appreciationBand.count"] = 3;

    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...EMPTY_PLAN,
    } as never);

    // The wording is the whole point of that table: a re-run must not put
    // "Assez bien" back over what the school wrote on its own bulletins.
    expect(of("appreciationBand", "createMany")).toHaveLength(0);
  });

  it("never takes a till back off the cashier holding it", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...EMPTY_PLAN,
    } as never);

    // The coffre has since been handed to a cashier, and renamed.
    const till = stored.cashRegister![0]!;
    till.holderId = "staff-9";
    till.name = "Caisse du directeur";

    calls.length = 0;
    answers["school.findFirst"] = { id: "school-1", city: null };
    await applySetup("org-1", {
      school: { mode: "existing", id: "school-1" },
      ...EMPTY_PLAN,
    } as never);

    const update = of("cashRegister", "update")[0]!.args.data as Record<string, unknown>;
    expect(update).not.toHaveProperty("holderId");
    expect(update).toHaveProperty("name");
  });

  it("opens one class per section and the groups under it", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    expect(created("schoolClass").map((row) => row.code)).toEqual(["1AP-A", "1AP-B"]);
    // Two groups each.
    expect(created("classGroup")).toHaveLength(4);
  });
});
