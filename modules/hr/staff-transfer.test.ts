import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Moving an employee's file to another school.
 *
 * Two things are worth pinning here, and neither is the happy path.
 *
 * **What refuses to move.** A `Staff` row is identity and employment; everything
 * else about the person happened *inside a school* — a payslip came out of that
 * school's caisse, a register was taken against its calendar, a bus belongs to
 * its fleet. Re-pointing `schoolId` under any of those would leave rows whose
 * parents disagree about which school they belong to, and nothing would
 * reconcile afterwards. So each blocker gets a case: a silent transfer is worse
 * than a refused one.
 *
 * **The two halves are reached by two different ids.** What somebody is *paid*
 * hangs off the Staff row and what they *teach* hangs off their User — see the
 * note on Staff.userId. A transfer that looked only at the first would leave a
 * teacher holding classes in a school they no longer work at.
 */

type Call = { model: string; op: string; args: Record<string, unknown> };

const calls: Call[] = [];
let answers: Record<string, (args: Record<string, unknown>) => unknown> = {};

/** Records every statement and answers from `answers`, defaulting to null. */
const client = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_m, op: string) => async (args: Record<string, unknown> = {}) => {
            calls.push({ model, op, args });
            const answer = answers[`${model}.${op}`];
            return answer ? answer(args) : null;
          },
        },
      ),
  },
);

const db = new Proxy(
  {},
  {
    get: (_target, key: string) => {
      // The writes run inside one transaction, so the callback is handed the
      // same recorder — which is what lets the assertions below see them.
      if (key === "$transaction") {
        return async (run: (tx: unknown) => Promise<unknown>) => run(client);
      }
      return (client as Record<string, unknown>)[key];
    },
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/school-settings-server", () => ({
  loadSchoolSettings: async () => ({ staffCodeFormat: "P-{year}-{seq:4}" }),
}));
vi.mock("@/modules/notifications/service", () => ({
  dispatch: async () => {},
  notify: async () => {},
  staffAccount: async () => null,
}));
vi.mock("@/modules/treasury/service", () => ({
  recordDisbursement: async () => {},
  ReversalBlockedError: class extends Error {},
}));

const { transferStaff } = await import("@/modules/hr/service");

const ORG = "org-1";
const FROM = "school-from";
const TO = "school-to";

const NOTHING = {
  salaries: 0,
  advances: 0,
  paidOperations: 0,
  attendance: 0,
  leaveRequests: 0,
  vehiclesDriven: 0,
  vehiclesAttended: 0,
  fuelRequests: 0,
};

/** The employee as `transferStaff` reads them, with nothing hanging off. */
function person(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "staff-1",
    code: "P-2026-0001",
    userId: "user-1",
    school: { organizationId: ORG },
    _count: { ...NOTHING },
    ...overrides,
  };
}

/** Their login, likewise clean. */
function account(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    currentSchoolId: FROM,
    _count: { subjectsQualified: 0, teachingAssignments: 0 },
    cashRegisterHeld: null,
    memberships: [{ id: "membership-1", schoolId: FROM }],
    ...overrides,
  };
}

/**
 * Scripts the reads. `staff.findFirst` serves two questions — the employee, and
 * whether their matricule is free in the target school — told apart by which
 * school the `where` names, exactly as the code asks them.
 */
function scriptReads({
  staff = person(),
  user = account(),
  codeTaken = false,
  targetOrganizationId = ORG as string | null,
}: {
  staff?: unknown;
  user?: unknown;
  codeTaken?: boolean;
  targetOrganizationId?: string | null;
} = {}) {
  answers = {
    "staff.findFirst": (args) => {
      const where = args["where"] as { schoolId?: string };
      if (where.schoolId === TO) return codeTaken ? { id: "other-staff" } : null;
      return staff;
    },
    "user.findUnique": () => user,
    "school.findUnique": () =>
      targetOrganizationId === null
        ? null
        : { organizationId: targetOrganizationId },
    "staff.findMany": () => [],
    "staff.update": () => ({ id: "staff-1" }),
    "membership.update": () => ({ id: "membership-1" }),
    "membership.delete": () => ({ id: "membership-1" }),
    "user.update": () => ({ id: "user-1" }),
  };
}

const wrote = (model: string, op: string) =>
  calls.find((call) => call.model === model && call.op === op);

beforeEach(() => {
  calls.length = 0;
  scriptReads();
});

// ── What refuses to move ─────────────────────────────────────────────────────

describe("what keeps somebody where they are", () => {
  it("refuses the school they already work at", async () => {
    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: FROM,
    });

    expect(result).toEqual({ ok: false, reason: "same-school" });
    // Refused before anything was read, let alone written.
    expect(calls).toEqual([]);
  });

  it("refuses a school in another organisation", async () => {
    // The tenant boundary. Nothing above this function would have caught it:
    // the caller only ever authorized inside one organisation's schools.
    scriptReads({ targetOrganizationId: "org-2" });

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result).toEqual({ ok: false, reason: "other-organisation" });
    expect(wrote("staff", "update")).toBeUndefined();
  });

  it("refuses an employee of another school", async () => {
    // The id came in a request; the read is scoped by the session's school, so
    // somebody else's employee reads as absent.
    scriptReads({ staff: null });

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it.each([
    ["payroll", { salaries: 2 }],
    ["payroll", { advances: 1 }],
    ["payroll", { paidOperations: 1 }],
    ["register", { attendance: 30 }],
    ["register", { leaveRequests: 1 }],
    ["transport", { vehiclesDriven: 1 }],
    ["transport", { vehiclesAttended: 1 }],
    ["transport", { fuelRequests: 4 }],
  ])("refuses with %s when %o hangs off the file", async (blocker, held) => {
    scriptReads({ staff: person({ _count: { ...NOTHING, ...held } }) });

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result).toMatchObject({ ok: false, reason: "blocked" });
    expect(result.ok === false && "blockers" in result && result.blockers).toContain(
      blocker,
    );
    expect(wrote("staff", "update")).toBeUndefined();
  });

  it("refuses a teacher who holds classes or qualifications here", async () => {
    // Reached through the User, not the Staff row — the join this module gets
    // wrong most easily.
    scriptReads({
      user: account({
        _count: { subjectsQualified: 0, teachingAssignments: 3 },
      }),
    });

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result).toMatchObject({ ok: false, reason: "blocked" });
    expect(result.ok === false && "blockers" in result && result.blockers).toEqual([
      "teaching",
    ]);
  });

  it("refuses somebody holding a till in the school they are leaving", async () => {
    scriptReads({ user: account({ cashRegisterHeld: { schoolId: FROM } }) });

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result.ok === false && "blockers" in result && result.blockers).toEqual([
      "caisse",
    ]);
  });

  it("does not mind a till they hold in the school they are moving to", async () => {
    // Somebody given the new school's drawer before their file caught up is
    // exactly the state this is here to repair, not a reason to refuse.
    scriptReads({ user: account({ cashRegisterHeld: { schoolId: TO } }) });

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result.ok).toBe(true);
  });

  it("names every blocker at once, not the first", async () => {
    // One round trip to the office rather than four.
    scriptReads({
      staff: person({
        _count: { ...NOTHING, salaries: 1, attendance: 1, fuelRequests: 1 },
      }),
    });

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result.ok === false && "blockers" in result && result.blockers).toEqual([
      "payroll",
      "register",
      "transport",
    ]);
  });
});

// ── What moves with them ─────────────────────────────────────────────────────

describe("moving a clean file", () => {
  it("re-points the staff row and keeps a matricule that is free", async () => {
    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result).toMatchObject({ ok: true, code: "P-2026-0001", recoded: false });
    expect(wrote("staff", "update")?.args).toMatchObject({
      where: { id: "staff-1" },
      data: { schoolId: TO, code: "P-2026-0001" },
    });
  });

  it("reissues the matricule when the new school already used it", async () => {
    // Unique per school, and the number is on a contract — so it is reissued
    // from the target school's own sequence and reported, never changed quietly.
    scriptReads({ codeTaken: true });
    // What that school has already issued, which is what the allocator reads.
    answers["staff.findMany"] = () => [{ code: "P-2026-0007" }];

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result).toMatchObject({ ok: true, code: "P-2026-0008", recoded: true });
    expect(wrote("staff", "update")?.args).toMatchObject({
      data: { schoolId: TO, code: "P-2026-0008" },
    });
  });

  it("moves the login's membership rather than dropping their reach", async () => {
    // A role is organisation-wide with a SCHOOL scope, so the same row applies
    // in the new school and only the school on the membership changes.
    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result).toMatchObject({ ok: true, membershipMoved: true });
    expect(wrote("membership", "update")?.args).toMatchObject({
      where: { id: "membership-1" },
      data: { schoolId: TO },
    });
    expect(wrote("membership", "delete")).toBeUndefined();
  });

  it("drops the old membership when they already hold one where they are going", async () => {
    // The unique on [userId, schoolId] would refuse a second one, and a person
    // already a member there has the reach anyway.
    scriptReads({
      user: account({
        memberships: [
          { id: "membership-1", schoolId: FROM },
          { id: "membership-2", schoolId: TO },
        ],
      }),
    });

    await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(wrote("membership", "delete")?.args).toMatchObject({
      where: { id: "membership-1" },
    });
    expect(wrote("membership", "update")).toBeUndefined();
  });

  it("carries the working context over and forgets the year with it", async () => {
    // A school year belongs to a school, so the one they had selected does not
    // exist where they are going. Null is what getAuthContext already handles.
    await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(wrote("user", "update")?.args).toMatchObject({
      where: { id: "user-1" },
      data: { currentSchoolId: TO, currentSchoolYearId: null },
    });
  });

  it("leaves a context that was pointing somewhere else alone", async () => {
    scriptReads({ user: account({ currentSchoolId: "school-third" }) });

    await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(wrote("user", "update")).toBeUndefined();
  });

  it("moves somebody who has no login at all", async () => {
    // Most of a payroll never signs in — the gardien, the femme de ménage — so
    // this is the common case and not an edge one.
    scriptReads({ staff: person({ userId: null }) });

    const result = await transferStaff({
      staffId: "staff-1",
      fromSchoolId: FROM,
      toSchoolId: TO,
    });

    expect(result).toMatchObject({ ok: true, membershipMoved: false });
    expect(wrote("staff", "update")?.args).toMatchObject({
      data: { schoolId: TO },
    });
    expect(wrote("user", "update")).toBeUndefined();
  });
});
