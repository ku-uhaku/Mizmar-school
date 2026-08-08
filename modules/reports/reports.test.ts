import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";
import { REPORTS, findReport } from "@/modules/reports/catalogue";
import { REPORT_PERMISSIONS } from "@/modules/reports/permissions";
import type { AuthContext } from "@/lib/dal";
import type { ReportParams } from "@/modules/reports/types";

/**
 * Les rapports: one screen, fifty queries, and a permission apiece.
 *
 * The module owns no figures — every report is a *reading* of another module's
 * rows — so the risk is not in the arithmetic but in the shape. A single generic
 * endpoint that takes a report id and a filter set out of the query string is
 * the same shape as `modules/configuration`'s generic CRUD, and it fails the
 * same three ways:
 *
 *   1. **The permission.** There is no "may run reports" code that opens the
 *      data. `report.view` opens the *screen*; each report carries the
 *      permission of what it reports on, re-checked in `runReport`. Without that
 *      split the reporting screen is the way round the whole permission system —
 *      grant somebody "reports" and they read the payroll.
 *   2. **The scope.** Every runner builds its own `where` from the working
 *      context. Nothing takes a school id from the request, so a crafted filter
 *      narrows a report and can never widen it.
 *   3. **The figure at the bottom.** A total is a number somebody acts on. One
 *      summed over a truncated read is wrong in the direction that matters.
 *
 * The sweeps below run all fifty against a recording stand-in for Prisma, so a
 * report added without a scope fails a test rather than shipping.
 */

// ─────────────────────────────────────────────────────────────────────────────
// A recording stand-in for Prisma.
// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: unknown };

const calls: Call[] = [];
let answers: Record<string, unknown> = {};

const EMPTY: Record<string, unknown> = {
  findMany: [],
  groupBy: [],
  count: 0,
  aggregate: { _sum: {}, _count: 0 },
  findFirst: null,
  findUnique: null,
};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op in EMPTY ? EMPTY[op] : null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

// Several runners translate a payment method or a status through the
// dictionary. Off a request there is no cookie to read the locale from, so the
// French one stands in — nothing here asserts on the wording.
vi.mock("@/lib/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n/server")>();
  return { ...actual, getDictionary: async () => actual.getDictionaryFor("fr") };
});

const { runReport } = await import("@/modules/reports/runners.server");

// ─────────────────────────────────────────────────────────────────────────────

/** The sentinel `lib/scope.ts` uses to mean "match nothing". */
const NO_MATCH = "__none__";

/** A reader holding exactly the codes named. */
function reader(
  codes: readonly string[],
  { schoolId = "school-1", yearId = "year-1" } = {},
): AuthContext {
  const held = new Set(codes);
  return {
    organization: { id: "org-1" },
    currentSchool: schoolId ? { id: schoolId } : null,
    currentSchoolYear: yearId ? { id: yearId } : null,
    user: { id: "user-1" },
    can: (code: string) => held.has(code),
    canOrg: (code: string) => held.has(code),
    canInSchool: (_school: string, code: string) => held.has(code),
  } as unknown as AuthContext;
}

/** Everything a reader could ever hold — the Administrateur. */
const EVERYTHING = Object.values(PERMISSIONS) as string[];

const RANGE: ReportParams = { from: "2026-01-01", to: "2026-01-31" };

/** Every string appearing anywhere in a nested argument object. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value instanceof Date) return [];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The catalogue ────────────────────────────────────────────────────────────

describe("the report catalogue", () => {
  it("gives every report a distinct id", () => {
    const ids = REPORTS.map((report) => report.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every report a URL-safe id", () => {
    // The id is a path segment. Anything else and the report is unreachable.
    for (const report of REPORTS) {
      expect(report.id, report.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("resolves every declared id and nothing else", () => {
    for (const report of REPORTS) {
      expect(findReport(report.id)?.id).toBe(report.id);
    }
    for (const nonsense of [
      "",
      "__proto__",
      "constructor",
      "toString",
      "../users",
      "paie ",
      "PAIE",
    ]) {
      expect(findReport(nonsense), nonsense).toBeUndefined();
    }
  });

  it("carries a permission that exists in the catalogue", () => {
    // A report whose permission is not a real code could never be granted, so
    // it would be dead — or, worse, checked against nothing.
    const known = new Set(EVERYTHING);
    for (const report of REPORTS) {
      expect(known.has(report.permission), `${report.id}: ${report.permission}`).toBe(
        true,
      );
    }
  });

  it("never carries report.view as the data's own permission", () => {
    // The whole design of this module in one assertion. `report.view` opens the
    // screen; a report that also *gated* on it would be readable by everybody
    // who can see the index, and the reporting screen would become the way round
    // the permission system.
    for (const report of REPORTS) {
      expect(report.permission, report.id).not.toBe(
        REPORT_PERMISSIONS.REPORT_VIEW,
      );
    }
  });

  it("puts the payroll behind hr.payroll and the caisse behind the treasury's codes", () => {
    // Spot checks with teeth: these are the two sets somebody would most like to
    // reach sideways.
    expect(findReport("paie")?.permission).toBe(PERMISSIONS.HR_PAYROLL);
    expect(findReport("avances")?.permission).toBe(PERMISSIONS.HR_PAYROLL);
    for (const id of ["encaissements", "decaissements", "releve-caisse"]) {
      expect(findReport(id)?.permission, id).toMatch(/^treasury\./);
    }
  });

  it("names each column once per report", () => {
    for (const report of REPORTS) {
      const keys = report.columns.map((column) => column.key);
      expect(new Set(keys).size, report.id).toBe(keys.length);
    }
  });

  it("gives every report at least one column", () => {
    for (const report of REPORTS) {
      expect(report.columns.length, report.id).toBeGreaterThan(0);
    }
  });

  it("totals only what can be added up", () => {
    // Averaging an average across rows of different sizes is the classic way to
    // publish a wrong figure, so only money and counts declare a total.
    for (const report of REPORTS) {
      for (const column of report.columns) {
        if (!column.total) continue;
        expect(
          ["money", "number"],
          `${report.id}.${column.key} is ${column.kind}`,
        ).toContain(column.kind);
      }
    }
  });

  it("never totals the first column, which the view overwrites with a label", () => {
    // The totals row puts the word "Total" in cell one. A figure declared there
    // would be silently replaced by it.
    for (const report of REPORTS) {
      expect(report.columns[0]!.total, report.id).toBeFalsy();
    }
  });

  it("asks for each filter at most once", () => {
    for (const report of REPORTS) {
      expect(new Set(report.filters).size, report.id).toBe(report.filters.length);
    }
  });

  it("translates every title, hint and column in all three languages", () => {
    // English is canonical and the other two are checked against it by the
    // compiler, but a *missing key* inside a namespace is only a runtime shrug —
    // the view falls back to printing the key itself.
    for (const locale of ["en", "fr", "ar"] as const) {
      const t = getDictionaryFor(locale).report;
      for (const report of REPORTS) {
        expect(t.reports[report.labelKey as keyof typeof t.reports], `${locale} ${report.id}`)
          .toBeTruthy();
        expect(t.hints[report.hintKey as keyof typeof t.hints], `${locale} ${report.id}`)
          .toBeTruthy();
        for (const column of report.columns) {
          expect(
            t.columns[column.labelKey as keyof typeof t.columns],
            `${locale} ${report.id}.${column.labelKey}`,
          ).toBeTruthy();
        }
      }
    }
  });
});

// ── Authorization ────────────────────────────────────────────────────────────

describe("runReport authorization", () => {
  it("runs every report for a reader who holds its permission", async () => {
    // Also the proof that all fifty runners execute — a catalogue entry with no
    // runner behind it answers null and fails here.
    for (const report of REPORTS) {
      calls.length = 0;
      const result = await runReport(
        reader([report.permission]),
        report.id,
        RANGE,
      );
      expect(result, report.id).not.toBeNull();
    }
  });

  it("refuses every report to a reader who holds everything except its permission", async () => {
    // The sweep that matters. Holding forty-nine other codes — including
    // `report.view` — must not open the fiftieth.
    for (const report of REPORTS) {
      calls.length = 0;
      const codes = EVERYTHING.filter((code) => code !== report.permission);
      expect(await runReport(reader(codes), report.id, RANGE), report.id).toBeNull();
    }
  });

  it("touches the database only after the permission holds", async () => {
    // A refusal that had already run the query would have leaked the rows into
    // memory and, on a slow report, leaked its existence through the clock.
    for (const report of REPORTS) {
      calls.length = 0;
      await runReport(reader([]), report.id, RANGE);
      expect(calls, report.id).toEqual([]);
    }
  });

  it("opens nothing on report.view alone", async () => {
    for (const report of REPORTS) {
      expect(
        await runReport(reader([REPORT_PERMISSIONS.REPORT_VIEW]), report.id, RANGE),
        report.id,
      ).toBeNull();
    }
  });

  it("refuses an id nobody declared", async () => {
    for (const nonsense of ["", "unknown", "../paie", "paie "]) {
      expect(await runReport(reader(EVERYTHING), nonsense, RANGE), nonsense).toBeNull();
    }
    expect(calls).toEqual([]);
  });

  it("refuses an id that only resolves through the prototype chain", async () => {
    // `RUNNERS` is a plain object, so a bare lookup of "constructor" answers a
    // function — which would sail past a truthiness check.
    for (const key of ["__proto__", "constructor", "toString", "valueOf"]) {
      expect(await runReport(reader(EVERYTHING), key, RANGE), key).toBeNull();
    }
  });

  it("refuses a date it cannot read, before running anything", async () => {
    for (const range of [
      { from: "", to: "2026-01-31" },
      { from: "2026-01-01", to: "" },
      { from: "not-a-date", to: "2026-01-31" },
      { from: "2026-13-45", to: "2026-01-31" },
    ]) {
      calls.length = 0;
      expect(
        await runReport(reader(EVERYTHING), "inscriptions", range),
        JSON.stringify(range),
      ).toBeNull();
      expect(calls).toEqual([]);
    }
  });
});

// ── The date range ───────────────────────────────────────────────────────────

describe("the date range", () => {
  /** The `enrolledOn` clause `inscriptions` builds from the range. */
  async function rangeOf(params: ReportParams) {
    calls.length = 0;
    await runReport(reader(EVERYTHING), "inscriptions", params);
    const where = (calls[0]!.args as { where: { enrolledOn: { gte: Date; lte: Date } } })
      .where;
    return where.enrolledOn;
  }

  it("includes the whole of the last day", async () => {
    // A range typed as "1 to 31 January" that silently dropped the 31st is the
    // bug every reporting screen ships with once.
    const { gte, lte } = await rangeOf(RANGE);

    expect(gte.getHours()).toBe(0);
    expect(gte.getDate()).toBe(1);
    expect(lte.getDate()).toBe(31);
    expect(lte.getHours()).toBe(23);
    expect(lte.getMinutes()).toBe(59);
    expect(lte.getMilliseconds()).toBe(999);
  });

  it("reads both ends in local time, so neither slips a day", async () => {
    // Morocco is ahead of UTC. Parsing "2026-01-01" bare would give UTC
    // midnight, which is the previous evening locally — a payment taken on the
    // 1st would fall outside a report for January.
    const { gte } = await rangeOf(RANGE);
    expect(gte.getFullYear()).toBe(2026);
    expect(gte.getMonth()).toBe(0);
  });

  it("accepts a single day as a range of one day", async () => {
    const { gte, lte } = await rangeOf({ from: "2026-01-15", to: "2026-01-15" });
    expect(gte.getDate()).toBe(15);
    expect(lte.getDate()).toBe(15);
    expect(lte.getTime()).toBeGreaterThan(gte.getTime());
  });

  it("answers an empty report for a range that runs backwards", async () => {
    // Not an error: somebody typed the dates the wrong way round, and a report
    // with no rows says so more clearly than a stack trace.
    const result = await runReport(reader(EVERYTHING), "inscriptions", {
      from: "2026-01-31",
      to: "2026-01-01",
    });
    expect(result).not.toBeNull();
    expect(result!.rows).toEqual([]);
  });
});

// ── Scoping: every runner, every query ───────────────────────────────────────

describe("every runner scopes itself", () => {
  it("matches nothing at all when there is no school in context", async () => {
    // The first login, or a membership just revoked. Every query a report issues
    // must carry the sentinel somewhere — a runner that forgot would read the
    // whole deployment instead of an empty school.
    const context = reader(EVERYTHING, { schoolId: "", yearId: "" });

    for (const report of REPORTS) {
      calls.length = 0;
      await runReport(context, report.id, RANGE);

      expect(calls.length, `${report.id} issued no query`).toBeGreaterThan(0);
      for (const call of calls) {
        expect(
          stringsIn(call.args),
          `${report.id} → ${call.model}.${call.op} is unscoped`,
        ).toContain(NO_MATCH);
      }
    }
  });

  it("names the school or the year in context on every query", async () => {
    const context = reader(EVERYTHING);

    for (const report of REPORTS) {
      calls.length = 0;
      await runReport(context, report.id, RANGE);

      for (const call of calls) {
        const values = stringsIn(call.args);
        expect(
          values.includes("school-1") || values.includes("year-1"),
          `${report.id} → ${call.model}.${call.op} ignores the working context`,
        ).toBe(true);
      }
    }
  });

  it("asks a different question when the school changes", async () => {
    // Which is what makes switching school in the header genuinely change what
    // a report answers.
    for (const report of REPORTS) {
      calls.length = 0;
      await runReport(reader(EVERYTHING), report.id, RANGE);
      const here = JSON.stringify(calls);

      calls.length = 0;
      await runReport(
        reader(EVERYTHING, { schoolId: "school-2", yearId: "year-2" }),
        report.id,
        RANGE,
      );
      const there = JSON.stringify(calls);

      expect(here, `${report.id} ignores the school`).not.toBe(there);
    }
  });

  it("never lets a filter out of the query string widen a report", async () => {
    // A crafted level, class, cycle, staff or fee type is ANDed onto the scope,
    // never substituted for it. So an id belonging to another school narrows the
    // report to nothing rather than reaching across.
    const crafted: ReportParams = {
      ...RANGE,
      levelOfferingId: "level-from-another-school",
      schoolClassId: "class-from-another-school",
      cycle: "PRIMAIRE",
      staffId: "staff-from-another-school",
      feeTypeId: "fee-from-another-school",
    };

    for (const report of REPORTS) {
      calls.length = 0;
      await runReport(reader(EVERYTHING), report.id, crafted);

      for (const call of calls) {
        const values = stringsIn(call.args);
        expect(
          values.includes("school-1") || values.includes("year-1"),
          `${report.id} → ${call.model}.${call.op} lost its scope to a filter`,
        ).toBe(true);
      }
    }
  });

  it("carries the crafted filter alongside the scope, not instead of it", async () => {
    calls.length = 0;
    await runReport(reader(EVERYTHING), "inscriptions", {
      ...RANGE,
      schoolClassId: "class-from-another-school",
    });

    expect(calls[0]!.args).toMatchObject({
      where: {
        schoolYearId: "year-1",
        student: { schoolId: "school-1" },
        schoolClassId: "class-from-another-school",
      },
    });
  });

  it("leaves an absent filter out rather than matching on null", async () => {
    // `schoolClassId: null` is a real clause — it means "not seated in a class"
    // — so an unset filter must be omitted, not passed through as null.
    calls.length = 0;
    await runReport(reader(EVERYTHING), "inscriptions", RANGE);

    const where = (calls[0]!.args as { where: Record<string, unknown> }).where;
    expect(where).not.toHaveProperty("schoolClassId");
    expect(where).not.toHaveProperty("levelOfferingId");
  });
});

// ── Totals and truncation ────────────────────────────────────────────────────

describe("totals", () => {
  /** `effectifs` rows: one class, four pupils. */
  const classRow = (code: string, boys: number, girls: number) => ({
    code,
    levelOffering: { level: { name: "3AP" } },
    enrollments: [
      ...Array.from({ length: boys }, () => ({ student: { gender: "MALE" } })),
      ...Array.from({ length: girls }, () => ({ student: { gender: "FEMALE" } })),
    ],
  });

  it("sums only the columns that asked for a total", async () => {
    answers = {
      "schoolClass.findMany": [classRow("3AP-A", 12, 8), classRow("3AP-B", 9, 11)],
    };

    const result = await runReport(reader(EVERYTHING), "effectifs", RANGE);
    expect(result!.totals).toEqual({ boys: 21, girls: 19, total: 40 });
  });

  it("declares no total for a column that did not ask for one", async () => {
    answers = { "schoolClass.findMany": [classRow("3AP-A", 1, 1)] };
    const result = await runReport(reader(EVERYTHING), "effectifs", RANGE);

    expect(result!.totals).not.toHaveProperty("class");
    expect(result!.totals).not.toHaveProperty("level");
  });

  it("counts a null as nothing rather than as NaN", async () => {
    // One poisoned cell would otherwise turn the whole totals row into "NaN",
    // which is how a report stops being read at all.
    answers = {
      "schoolClass.findMany": [
        { code: "3AP-A", levelOffering: { level: { name: "3AP" } }, enrollments: [] },
      ],
    };
    const result = await runReport(reader(EVERYTHING), "effectifs", RANGE);
    expect(result!.totals).toEqual({ boys: 0, girls: 0, total: 0 });
  });

  it("reports the row count it actually returned", async () => {
    answers = {
      "schoolClass.findMany": [classRow("3AP-A", 1, 1), classRow("3AP-B", 1, 1)],
    };
    const result = await runReport(reader(EVERYTHING), "effectifs", RANGE);

    expect(result!.rowCount).toBe(2);
    expect(result!.truncated).toBe(false);
    expect(result!.rows).toHaveLength(2);
  });
});

describe("truncation", () => {
  /** More rows than one run may return. */
  const enrolments = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      enrolledOn: new Date(2026, 0, 15),
      status: "ACTIVE",
      student: { code: `E-${index}`, firstName: "Amine", lastName: "Benali" },
      schoolClass: { code: "3AP-A" },
      levelOffering: { level: { name: "3AP" } },
    }));

  it("cuts the rows at the cap and says so", async () => {
    answers = { "enrollment.findMany": enrolments(5001) };
    const result = await runReport(reader(EVERYTHING), "inscriptions", RANGE);

    expect(result!.truncated).toBe(true);
    expect(result!.rows).toHaveLength(5000);
    expect(result!.rowCount).toBe(5001);
  });

  it("does not cut a report that fits", async () => {
    answers = { "enrollment.findMany": enrolments(5000) };
    const result = await runReport(reader(EVERYTHING), "inscriptions", RANGE);

    expect(result!.truncated).toBe(false);
    expect(result!.rows).toHaveLength(5000);
  });

  it("publishes no total for a report that was cut", async () => {
    // The runners stop reading at the cap, so once a report is truncated there
    // is no honest total to print: a figure labelled "Total" that is short by
    // however much was left behind is worse than no figure, because somebody
    // takes it to an accountant. Withheld rather than guessed — the view drops
    // the row entirely, and the caption already says how much is missing.
    const rows = Array.from({ length: 5001 }, () => ({
      code: "3AP-A",
      levelOffering: { level: { name: "3AP" } },
      enrollments: [{ student: { gender: "MALE" } }],
    }));
    answers = { "schoolClass.findMany": rows };

    const result = await runReport(reader(EVERYTHING), "effectifs", RANGE);
    expect(result!.truncated).toBe(true);
    expect(result!.totals).toEqual({});
  });

  it("still totals a report that was not cut", async () => {
    answers = {
      "schoolClass.findMany": [
        { code: "3AP-A", levelOffering: { level: { name: "3AP" } }, enrollments: [{ student: { gender: "MALE" } }] },
      ],
    };
    const result = await runReport(reader(EVERYTHING), "effectifs", RANGE);
    expect(result!.totals).toEqual({ boys: 1, girls: 0, total: 1 });
  });
});

// ── The rows themselves ──────────────────────────────────────────────────────

describe("what a runner returns", () => {
  it("returns raw values, never formatted ones", async () => {
    // The view formats money and dates against the reader's locale and the
    // school's currency. A runner that formatted would hard-code one of each,
    // and the CSV would carry text a spreadsheet cannot sort.
    answers = {
      "enrollment.findMany": [
        {
          enrolledOn: new Date(2026, 0, 15),
          status: "ACTIVE",
          student: { code: "E-1", firstName: "Amine", lastName: "Benali" },
          schoolClass: { code: "3AP-A" },
          levelOffering: { level: { name: "3AP" } },
        },
      ],
    };

    const result = await runReport(reader(EVERYTHING), "inscriptions", RANGE);
    const row = result!.rows[0]!;

    expect(typeof row.enrolledOn).toBe("string");
    expect(row.enrolledOn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row.pupil).toBe("Benali Amine");
  });

  it("alphabetises on the surname, the way a Moroccan school list is read", async () => {
    answers = {
      "enrollment.findMany": [
        {
          enrolledOn: new Date(2026, 0, 15),
          status: "ACTIVE",
          student: { code: "E-1", firstName: "Amine", lastName: "Benali" },
          schoolClass: null,
          levelOffering: { level: { name: "3AP" } },
        },
      ],
    };
    const result = await runReport(reader(EVERYTHING), "inscriptions", RANGE);
    expect(result!.rows[0]!.pupil).toBe("Benali Amine");
    expect(result!.rows[0]!.class).toBeNull();
  });

  it("gives every row exactly the keys the catalogue declared", async () => {
    // The view reads `row[column.key]`. A runner that named a column differently
    // would print an em dash for ever, and nobody would know which half was
    // wrong.
    answers = {
      "schoolClass.findMany": [
        { code: "3AP-A", levelOffering: { level: { name: "3AP" } }, enrollments: [] },
      ],
    };

    const report = findReport("effectifs")!;
    const result = await runReport(reader(EVERYTHING), "effectifs", RANGE);
    const declared = new Set(report.columns.map((column) => column.key));

    for (const key of Object.keys(result!.rows[0]!)) {
      expect(declared.has(key), `effectifs returns an undeclared ${key}`).toBe(true);
    }
    for (const key of declared) {
      expect(result!.rows[0], key).toHaveProperty(key);
    }
  });

  it("answers an empty report rather than throwing when a school holds nothing", async () => {
    // The state every school is in on its first day, and the one a report is
    // most likely to be opened in by somebody evaluating the app.
    for (const report of REPORTS) {
      calls.length = 0;
      const result = await runReport(reader(EVERYTHING), report.id, RANGE);
      expect(result, report.id).not.toBeNull();
      expect(result!.rows, report.id).toEqual([]);
      expect(result!.rowCount, report.id).toBe(0);
      expect(result!.truncated, report.id).toBe(false);
    }
  });
});
