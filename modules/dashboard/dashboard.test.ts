import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import type { AuthContext } from "@/lib/dal";

/**
 * The dashboard — the module `AGENTS.md` names as the reference for a
 * cross-module read.
 *
 * It owns no tables and no scoping: every figure is a count the owning module
 * already knows how to take, which is what keeps the number on a card equal to
 * the number on that module's list screen. The rule it states about itself is
 * the thing worth holding still:
 *
 *   > A section the reader may not open comes back `null` rather than zeroed: a
 *   > card reading "0 pupils" is a claim about the school, and the reader has
 *   > not earned it. The permission checked here is the same one that puts the
 *   > section in the sidebar, so the dashboard and the nav cannot disagree
 *   > about what the app contains.
 *
 * A count is not contents. It is still a claim, and the tests below are about
 * the dashboard making none it has not earned — including for the four
 * administrative tiles, which used to be taken unconditionally.
 */

// ─────────────────────────────────────────────────────────────────────────────

const asked: { name: string; args: unknown[] }[] = [];

const record =
  <T>(name: string, answer: T) =>
  async (...args: unknown[]) => {
    asked.push({ name, args });
    return answer;
  };

vi.mock("@/modules/schools/queries", () => ({
  countActiveSchools: record("countActiveSchools", 3),
}));
vi.mock("@/modules/users/queries", () => ({
  countUsers: record("countUsers", { total: 48, active: 42 }),
}));
vi.mock("@/modules/access/queries", () => ({
  countRoles: record("countRoles", 12),
}));
vi.mock("@/modules/school-years/queries", () => ({
  countSchoolYears: record("countSchoolYears", 4),
}));
let lifeSummary: {
  students: number;
  enrolled: number | null;
  unplaced: number | null;
} = { students: 234, enrolled: 214, unplaced: 3 };

vi.mock("@/modules/school-life/queries", () => ({
  loadSchoolLifeSummary: async (...args: unknown[]) => {
    asked.push({ name: "loadSchoolLifeSummary", args });
    return lifeSummary;
  },
}));
vi.mock("@/modules/treasury/queries", () => ({
  treasurySummary: record("treasurySummary", {
    collectedCentimes: 1_234_56,
    openRegisterCount: 2,
    chequesBouncedCount: 1,
  }),
  collectionsByMonth: record("collectionsByMonth", [
    { label: "2025-09", value: 100 },
  ]),
  schoolCollectionStanding: record("schoolCollectionStanding", {
    chargedCentimes: 100,
    paidCentimes: 60,
    outstandingCentimes: 40,
    overdueCentimes: 10,
  }),
}));
vi.mock("@/modules/transport/queries", () => ({
  transportSummary: record("transportSummary", {
    riderCount: 88,
    routeCount: 6,
    paperworkDue: 2,
  }),
}));
vi.mock("@/modules/hr/queries", () => ({
  hrSummary: record("hrSummary", {
    headcount: 40,
    pendingLeave: 3,
    unmarkedToday: 5,
  }),
}));

let levels: { label: string; levelCode: string; value: number }[] = [];
vi.mock("@/modules/enrolment/queries", () => ({
  countEnrolmentsByLevel: async (...args: unknown[]) => {
    asked.push({ name: "countEnrolmentsByLevel", args });
    return levels;
  },
}));

const { loadDashboardCharts, loadDashboardStats, loadSectionHeadlines } =
  await import("@/modules/dashboard/queries");

// ─────────────────────────────────────────────────────────────────────────────

function reader(...codes: string[]): AuthContext {
  const held = new Set(codes);
  return {
    organization: { id: "org-1" },
    currentSchool: { id: "school-1" },
    currentSchoolYear: { id: "year-1" },
    schools: [{ id: "school-1" }],
    user: { id: "user-1" },
    can: (code: string) => held.has(code),
    canOrg: (code: string) => held.has(code),
    canInSchool: (_school: string, code: string) => held.has(code),
  } as unknown as AuthContext;
}

const wasAsked = (name: string) => asked.some((call) => call.name === name);

const EVERYTHING = Object.values(PERMISSIONS) as string[];

beforeEach(() => {
  asked.length = 0;
  levels = [];
  lifeSummary = { students: 234, enrolled: 214, unplaced: 3 };
});

// ── The four administrative tiles ────────────────────────────────────────────

describe("loadDashboardStats", () => {
  it("gives an administrator all four figures", async () => {
    const stats = await loadDashboardStats(reader(...EVERYTHING));

    expect(stats.activeSchools).toBe(3);
    expect(stats.users).toEqual({ total: 48, active: 42 });
    expect(stats.roleCount).toBe(12);
    expect(stats.yearCount).toBe(4);
  });

  it("answers nothing for a figure the reader may not have", async () => {
    // The bug this closes. These four used to be taken unconditionally, so a
    // teacher's dashboard carried the headcount of every account in their
    // school and the number of roles in the organisation — with no way to open
    // either, because the page used the very same permissions to decide whether
    // the tile was a link.
    const teacher = await loadDashboardStats(reader(PERMISSIONS.STUDENT_VIEW));

    expect(teacher.users).toBeNull();
    expect(teacher.roleCount).toBeNull();
    expect(teacher.yearCount).toBeNull();
  });

  it("does not even take a count it may not show", async () => {
    await loadDashboardStats(reader(PERMISSIONS.STUDENT_VIEW));

    expect(wasAsked("countUsers")).toBe(false);
    expect(wasAsked("countRoles")).toBe(false);
    expect(wasAsked("countSchoolYears")).toBe(false);
  });

  it("gates each figure on the code that opens the screen behind it", async () => {
    for (const [code, read] of [
      [PERMISSIONS.USER_VIEW, "countUsers"],
      [PERMISSIONS.ROLE_VIEW, "countRoles"],
      [PERMISSIONS.SCHOOL_YEAR_VIEW, "countSchoolYears"],
    ] as const) {
      asked.length = 0;
      await loadDashboardStats(reader(code));
      expect(wasAsked(read), code).toBe(true);
    }
  });

  it("asks for roles org-wide, because a role is an organisation-level thing", async () => {
    // `countRoles` is scoped to the tenant and to nothing else — it was the one
    // figure here not narrowed to the reader's own reach at all, so the
    // permission has to be the org-wide one.
    const inSchoolOnly = {
      ...reader(PERMISSIONS.ROLE_VIEW),
      canOrg: () => false,
    } as unknown as AuthContext;

    expect((await loadDashboardStats(inSchoolOnly)).roleCount).toBeNull();
    expect(wasAsked("countRoles")).toBe(false);
  });

  it("always answers the school count, which is the reader's own reach", async () => {
    // `countActiveSchools` counts `context.schools`, so it cannot say anything
    // the reader could not already see in the header.
    const stats = await loadDashboardStats(reader());
    expect(stats.activeSchools).toBe(3);
  });

  it("passes the reader's own context to every count", async () => {
    const context = reader(...EVERYTHING);
    await loadDashboardStats(context);

    for (const call of asked) {
      expect(call.args[0], call.name).toBe(context);
    }
  });
});

// ── One headline per section ─────────────────────────────────────────────────

describe("loadSectionHeadlines", () => {
  it("gives a reader who holds everything all four cards", async () => {
    const headlines = await loadSectionHeadlines(reader(...EVERYTHING));

    expect(headlines.vieScolaire).toEqual({
      value: 234,
      detail: 214,
      attention: 3,
    });
    expect(headlines.logistique).toEqual({ value: 88, detail: 6, attention: 2 });
    expect(headlines.rh).toEqual({ value: 40, detail: 3, attention: 5 });
  });

  it("omits a section rather than zeroing it", async () => {
    const headlines = await loadSectionHeadlines(reader());

    expect(headlines.vieScolaire).toBeNull();
    expect(headlines.finance).toBeNull();
    expect(headlines.logistique).toBeNull();
    expect(headlines.rh).toBeNull();
    expect(asked).toEqual([]);
  });

  it("checks the same code that puts the section in the sidebar", async () => {
    // So the dashboard and the nav cannot disagree about what the app contains.
    for (const [code, read] of [
      [PERMISSIONS.SCHOOL_LIFE_VIEW, "loadSchoolLifeSummary"],
      [PERMISSIONS.TREASURY_VIEW, "treasurySummary"],
      [PERMISSIONS.TRANSPORT_VIEW, "transportSummary"],
      [PERMISSIONS.HR_VIEW, "hrSummary"],
    ] as const) {
      asked.length = 0;
      await loadSectionHeadlines(reader(code));
      expect(wasAsked(read), code).toBe(true);
    }
  });

  it("carries a missing figure through as missing, not as zero", async () => {
    // A reader may hold `schoolLife.view` and `student.view` without
    // `enrolment.view`. The summary answers null for the two figures it may not
    // give, and the card has to drop the line rather than print "0 inscrits" —
    // a zero here is a claim about the school the reader has not earned.
    lifeSummary = { students: 234, enrolled: null, unplaced: null };

    const headlines = await loadSectionHeadlines(reader(...EVERYTHING));

    expect(headlines.vieScolaire).toEqual({
      value: 234,
      detail: null,
      attention: null,
    });
  });

  it("rounds money to dirhams once, at the source", async () => {
    // The card prints it as money, and rounding here stops every caller
    // re-deciding the same thing.
    const headlines = await loadSectionHeadlines(reader(PERMISSIONS.TREASURY_VIEW));
    expect(headlines.finance!.value).toBe(1235);
    expect(Number.isInteger(headlines.finance!.value)).toBe(true);
  });

  it("asks the payroll for the month it is actually in", async () => {
    await loadSectionHeadlines(reader(PERMISSIONS.HR_VIEW));
    const call = asked.find((entry) => entry.name === "hrSummary")!;
    const now = new Date();

    expect(call.args[1]).toBe(now.getFullYear());
    expect(call.args[2]).toBe(now.getMonth() + 1);
  });
});

// ── The charts ───────────────────────────────────────────────────────────────

describe("loadDashboardCharts", () => {
  it("charts nothing for a reader who may open neither section", async () => {
    // An empty chart says "nothing to show"; a zeroed one makes a claim.
    const charts = await loadDashboardCharts(reader());

    expect(charts.enrolmentByLevel).toEqual([]);
    expect(charts.collectionsByMonth).toEqual([]);
    expect(charts.collection).toBeNull();
    expect(asked).toEqual([]);
  });

  it("charts the enrolment without the money, and the money without the enrolment", async () => {
    levels = [{ label: "1AP", levelCode: "1AP", value: 40 }];

    const secretary = await loadDashboardCharts(reader(PERMISSIONS.ENROLMENT_VIEW));
    expect(secretary.enrolmentByLevel).toHaveLength(1);
    expect(secretary.collection).toBeNull();

    asked.length = 0;
    const bursar = await loadDashboardCharts(reader(PERMISSIONS.TREASURY_VIEW));
    expect(bursar.enrolmentByLevel).toEqual([]);
    expect(bursar.collection).not.toBeNull();
  });

  // ── Folding the filières back into their level ─────────────────────────────

  it("sums a level's filières into one column", async () => {
    // The enrolment query splits by *offering*, so a qualifying cycle comes back
    // as four columns for one level — eighteen columns for twelve levels, on a
    // chart 220 pixels tall whose axis labels then collide.
    levels = [
      { label: "2BAC 2B-SM", levelCode: "2BAC", value: 30 },
      { label: "2BAC 2B-PC", levelCode: "2BAC", value: 25 },
      { label: "2BAC 2B-L", levelCode: "2BAC", value: 20 },
    ];

    const charts = await loadDashboardCharts(reader(PERMISSIONS.ENROLMENT_VIEW));
    expect(charts.enrolmentByLevel).toEqual([{ label: "2BAC", value: 75 }]);
  });

  it("keeps the order the source gave, which is by year of study", async () => {
    // So the axis still reads 1AP through 2BAC rather than alphabetically.
    levels = [
      { label: "1AP", levelCode: "1AP", value: 40 },
      { label: "2BAC 2B-SM", levelCode: "2BAC", value: 30 },
      { label: "6AP", levelCode: "6AP", value: 35 },
      { label: "2BAC 2B-PC", levelCode: "2BAC", value: 25 },
    ];

    const charts = await loadDashboardCharts(reader(PERMISSIONS.ENROLMENT_VIEW));
    expect(charts.enrolmentByLevel.map((row) => row.label)).toEqual([
      "1AP",
      "2BAC",
      "6AP",
    ]);
  });

  it("puts a level's total in the place its first filière held", async () => {
    levels = [
      { label: "2BAC 2B-SM", levelCode: "2BAC", value: 30 },
      { label: "1AP", levelCode: "1AP", value: 40 },
      { label: "2BAC 2B-PC", levelCode: "2BAC", value: 25 },
    ];

    const charts = await loadDashboardCharts(reader(PERMISSIONS.ENROLMENT_VIEW));
    expect(charts.enrolmentByLevel[0]).toEqual({ label: "2BAC", value: 55 });
  });

  it("leaves a level with no filières exactly as it was", async () => {
    levels = [
      { label: "1AP", levelCode: "1AP", value: 40 },
      { label: "2AP", levelCode: "2AP", value: 38 },
    ];

    const charts = await loadDashboardCharts(reader(PERMISSIONS.ENROLMENT_VIEW));
    expect(charts.enrolmentByLevel).toEqual([
      { label: "1AP", value: 40 },
      { label: "2AP", value: 38 },
    ]);
  });

  it("labels by the level's code, not by the offering's", async () => {
    // "2BAC" is what a reader glancing at an axis needs; "2BAC 2B-SM-A" is the
    // classes screen's question, where there is room to answer it.
    levels = [{ label: "2BAC 2B-SM-A", levelCode: "2BAC", value: 30 }];

    const charts = await loadDashboardCharts(reader(PERMISSIONS.ENROLMENT_VIEW));
    expect(charts.enrolmentByLevel[0]!.label).toBe("2BAC");
  });

  it("charts nothing for a school with nobody enrolled", async () => {
    levels = [];
    const charts = await loadDashboardCharts(reader(PERMISSIONS.ENROLMENT_VIEW));
    expect(charts.enrolmentByLevel).toEqual([]);
  });
});
