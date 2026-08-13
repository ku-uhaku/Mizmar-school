import { describe, expect, it, beforeEach, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import type { AuthContext } from "@/lib/dal";

/**
 * The employee file's *service* half: what somebody is assigned to do.
 *
 * The money half is asserted in `payroll-visibility.test.ts` beside this one.
 * What is worth pinning here is the join, because it is not the obvious one: a
 * teaching assignment names a **User** and a bus names a **Staff** row, so the
 * same file reaches its two halves by two different ids. Getting that wrong
 * either shows a colleague somebody else's classes or silently shows none.
 */

const asked: { name: string; args: unknown[] }[] = [];

const record =
  <T>(name: string, answer: T) =>
  async (...args: unknown[]) => {
    asked.push({ name, args });
    return answer;
  };

let staffRow: Record<string, unknown> | null = null;

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async () => {
            if (model === "staff" && op === "findFirst") return staffRow;
            if (op === "aggregate") return { _sum: { dayCount: 0 } };
            if (op === "count") return 0;
            if (op === "findMany") return [];
            return null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const DUTY = {
  id: "assignment-1",
  schoolClassId: "class-1",
  classCode: "3AP-A",
  levelLabel: "3AP",
  subjectId: "subject-1",
  subjectCode: "MATH",
  subjectName: "Mathématiques",
  groupLabel: null,
  weeklyMinutes: 300,
  isPrimary: true,
  enrolled: 28,
};

const BUS = {
  id: "vehicle-1",
  registration: "12345-A-6",
  label: "Toyota Coaster",
  seatCount: 30,
  status: "ACTIVE",
  duty: "DRIVER",
  insuranceExpiresOn: null,
  inspectionExpiresOn: null,
  routes: [
    {
      id: "route-1",
      code: "L1",
      name: "Ligne Nord",
      direction: "BOTH",
      isActive: true,
      stopCount: 7,
      taken: 24,
    },
  ],
};

vi.mock("@/modules/classes/queries", () => ({
  listTeacherDuties: record("listTeacherDuties", [
    DUTY,
    { ...DUTY, id: "a-2" },
  ]),
}));

vi.mock("@/modules/transport/queries", () => ({
  listStaffVehicles: record("listStaffVehicles", [BUS]),
}));

const { findStaff } = await import("@/modules/hr/queries");

function reader(...codes: string[]): AuthContext {
  const held = new Set(codes);
  return {
    organization: { id: "org-1" },
    currentSchool: { id: "school-1" },
    currentSchoolYear: { id: "year-1" },
    can: (code: string) => held.has(code),
    canOrg: (code: string) => held.has(code),
    canInSchool: (_schoolId: string, code: string) => held.has(code),
  } as unknown as AuthContext;
}

const SECRETARY = () => reader(PERMISSIONS.HR_VIEW, PERMISSIONS.HR_ATTENDANCE);

const PERSON = {
  id: "staff-1",
  code: "P-001",
  firstName: "Amine",
  lastName: "Benali",
  firstNameAr: null,
  lastNameAr: null,
  gender: "MALE",
  birthDate: null,
  birthPlace: null,
  nationalId: "AB123456",
  cnssNumber: null,
  bankRib: null,
  jobRole: "TEACHER",
  jobTitle: "Professeur",
  status: "ACTIVE",
  phone: "0661234567",
  email: null,
  address: null,
  maxWeeklyMinutes: 1_440,
  hiredOn: null,
  leftOn: null,
  notes: null,
  user: { id: "user-1", email: "amine@school.ma" },
  contracts: [],
  salaries: [],
  leaveRequests: [],
  attendance: [],
};

beforeEach(() => {
  asked.length = 0;
  staffRow = { ...PERSON };
});

describe("findStaff — the service half", () => {
  it("asks each owning module rather than reaching into its tables", async () => {
    await findStaff(SECRETARY(), "staff-1");
    expect(asked.map((call) => call.name).sort()).toEqual([
      "listStaffVehicles",
      "listTeacherDuties",
    ]);
  });

  it("reaches the classes by the login account and the buses by the staff row", async () => {
    // The join that is easy to get wrong: an assignment names a User, a vehicle
    // names a Staff. Passing one id where the other belongs resolves to
    // somebody else's service or to nothing at all.
    await findStaff(SECRETARY(), "staff-1");

    const teaching = asked.find((call) => call.name === "listTeacherDuties");
    const fleet = asked.find((call) => call.name === "listStaffVehicles");
    expect(teaching!.args[1]).toBe("user-1");
    expect(fleet!.args[1]).toBe("staff-1");
  });

  it("asks for no teaching at all when the employee has no login", async () => {
    // Most of the payroll never signs in. Asking with a null id would either
    // throw or match every assignment with none.
    staffRow = { ...PERSON, user: null };
    const detail = await findStaff(SECRETARY(), "staff-1");

    expect(detail!.teaching).toEqual([]);
    expect(detail!.teachingMinutes).toBe(0);
    expect(asked.some((call) => call.name === "listTeacherDuties")).toBe(false);
  });

  it("totals the week's load from the assignments", async () => {
    const detail = await findStaff(SECRETARY(), "staff-1");
    expect(detail!.teachingMinutes).toBe(600);
    expect(detail!.maxWeeklyMinutes).toBe(1_440);
  });

  it("counts an assignment with no contracted load as nothing, not as null", async () => {
    // `weeklyMinutes` is nullable — a subject shared between two teachers may
    // carry no figure of its own, and adding null to a total yields NaN.
    const { listTeacherDuties } = await import("@/modules/classes/queries");
    const original = listTeacherDuties;
    (await import("@/modules/classes/queries")).listTeacherDuties =
      (async () => [
        { ...DUTY, weeklyMinutes: null },
      ]) as typeof listTeacherDuties;

    const detail = await findStaff(SECRETARY(), "staff-1");
    expect(detail!.teachingMinutes).toBe(0);

    (await import("@/modules/classes/queries")).listTeacherDuties = original;
  });

  it("hands the fleet through without a permission of its own", async () => {
    // A driver's line is not confidential the way a salary is: anybody who may
    // open the file may see which bus they run.
    const detail = await findStaff(SECRETARY(), "staff-1");
    expect(detail!.vehicles).toEqual([BUS]);
  });

  it("gives both halves the reader's own context to scope with", async () => {
    const context = SECRETARY();
    await findStaff(context, "staff-1");
    for (const call of asked) {
      expect(call.args[0], call.name).toBe(context);
    }
  });
});
