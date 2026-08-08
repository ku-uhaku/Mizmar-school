import { describe, expect, it, beforeEach, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import type { AuthContext } from "@/lib/dal";

/**
 * What a colleague earns.
 *
 * `hr.view` opens the staff list; `hr.payroll` opens the salaries, and in most
 * schools exactly two people hold the second. The screens always drew that line,
 * but they drew it in the **rendering** — which put every salary in the payload
 * of a page a reader without the code could open, hidden on screen and one
 * devtools panel away.
 *
 * So the line is drawn in `queries.ts` instead, and these tests assert on what
 * actually leaves the server rather than on what the page displays. A secretary
 * holds `hr.view` and `hr.attendance`; that is the reader every case below is
 * about.
 */

const staffRows: Record<string, unknown>[] = [];
let staffRow: Record<string, unknown> | null = null;

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async () => {
            if (model === "staff" && op === "findMany") return staffRows;
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

const { findStaff, listStaff } = await import("@/modules/hr/queries");

/** A reader holding exactly the codes named, in the school in context. */
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

const SECRETARY = () =>
  reader(PERMISSIONS.HR_VIEW, PERMISSIONS.HR_ATTENDANCE);
const BURSAR = () =>
  reader(PERMISSIONS.HR_VIEW, PERMISSIONS.HR_PAYROLL);

const CONTRACT = {
  id: "contract-1",
  kind: "CDI",
  status: "ACTIVE",
  startsOn: new Date(2024, 8, 1),
  endsOn: null,
  trialEndsOn: null,
  baseSalaryCentimes: 1_200_000,
  weeklyHours: 40,
  notes: null,
};

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
  cnssNumber: "1234567",
  bankRib: "011780000012345678901234",
  jobRole: "TEACHER",
  jobTitle: "Professeur",
  status: "ACTIVE",
  phone: "0661234567",
  email: "amine@school.ma",
  address: null,
  hiredOn: new Date(2024, 8, 1),
  leftOn: null,
  notes: null,
  user: { id: "user-1", email: "amine@school.ma" },
  contracts: [CONTRACT],
  salaries: [],
  leaveRequests: [],
  attendance: [],
};

beforeEach(() => {
  staffRows.length = 0;
  staffRows.push({ ...PERSON, contracts: [CONTRACT] });
  staffRow = { ...PERSON, contracts: [CONTRACT] };
});

// ── The list ─────────────────────────────────────────────────────────────────

describe("listStaff", () => {
  it("shows the person to a reader with hr.view", async () => {
    const [row] = await listStaff(SECRETARY());
    expect(row).toMatchObject({ code: "P-001", fullName: "Amine Benali" });
  });

  it("withholds the salary from a reader without hr.payroll", async () => {
    const [row] = await listStaff(SECRETARY());
    expect(row!.baseSalaryCentimes).toBeNull();
  });

  it("gives the salary to a reader with hr.payroll", async () => {
    const [row] = await listStaff(BURSAR());
    expect(row!.baseSalaryCentimes).toBe(1_200_000);
  });

  it("still says whether a contract is signed, without disclosing the figure", async () => {
    // The "no contract signed" warning has to work for the secretary who chases
    // it, and it must not become a way to read the salary.
    const [row] = await listStaff(SECRETARY());
    expect(row!.hasLiveContract).toBe(true);
    expect(row!.baseSalaryCentimes).toBeNull();
  });

  it("says no contract is signed when none is live, for either reader", async () => {
    staffRows[0] = { ...PERSON, contracts: [] };
    for (const who of [SECRETARY(), BURSAR()]) {
      const [row] = await listStaff(who);
      expect(row!.hasLiveContract).toBe(false);
      expect(row!.baseSalaryCentimes).toBeNull();
    }
  });

  it("puts no salary anywhere in the payload it sends", async () => {
    // The assertion that would have caught the original bug: not "is the field
    // null" but "is the figure anywhere in what crosses the wire".
    const rows = await listStaff(SECRETARY());
    expect(JSON.stringify(rows)).not.toContain("1200000");
  });
});

// ── One person's file ────────────────────────────────────────────────────────

describe("findStaff", () => {
  it("scopes the lookup by school, so a staff id alone reaches nothing", async () => {
    // A staff id from another school must not resolve, which is why this is one
    // function rather than a page assembling its own reads.
    staffRow = null;
    expect(await findStaff(SECRETARY(), "staff-from-another-school")).toBeNull();
  });

  it("gives the whole file to a reader with hr.payroll", async () => {
    const detail = await findStaff(BURSAR(), "staff-1");
    expect(detail!.baseSalaryCentimes).toBe(1_200_000);
    expect(detail!.contracts).toHaveLength(1);
    expect(detail!.bankRib).toBe("011780000012345678901234");
  });

  it("withholds the contracts from a reader without hr.payroll", async () => {
    // A contract is a salary written down, so the list is emptied rather than
    // handed over for the screen to hide.
    const detail = await findStaff(SECRETARY(), "staff-1");
    expect(detail!.contracts).toEqual([]);
  });

  it("withholds the bank details, which are a payroll matter", async () => {
    const detail = await findStaff(SECRETARY(), "staff-1");
    expect(detail!.bankRib).toBeNull();
  });

  it("withholds the salary from the summary too", async () => {
    const detail = await findStaff(SECRETARY(), "staff-1");
    expect(detail!.baseSalaryCentimes).toBeNull();
  });

  it("puts no salary and no RIB anywhere in the payload", async () => {
    const detail = await findStaff(SECRETARY(), "staff-1");
    const wire = JSON.stringify(detail);

    expect(wire).not.toContain("1200000");
    expect(wire).not.toContain("011780000012345678901234");
  });

  it("still shows what a secretary legitimately needs", async () => {
    // The point is not to blind the reader — it is to withhold the money. A
    // secretary marks this person's register and chases their papers.
    const detail = await findStaff(SECRETARY(), "staff-1");

    expect(detail!.fullName).toBe("Amine Benali");
    expect(detail!.phone).toBe("0661234567");
    expect(detail!.status).toBe("ACTIVE");
    expect(detail!.contractKind).toBe("CDI");
    expect(detail!.hasLiveContract).toBe(true);
  });

  it("answers null for somebody who is not there", async () => {
    staffRow = null;
    expect(await findStaff(BURSAR(), "nobody")).toBeNull();
  });
});

// ── The boundary itself ──────────────────────────────────────────────────────

describe("the payroll boundary", () => {
  it("is decided by hr.payroll alone, not by hr.manage or hr.delete", async () => {
    // Managing the staff file is not the same as seeing what they are paid, and
    // neither is being able to delete one.
    for (const codes of [
      [PERMISSIONS.HR_VIEW, PERMISSIONS.HR_MANAGE],
      [PERMISSIONS.HR_VIEW, PERMISSIONS.HR_DELETE],
      [PERMISSIONS.HR_VIEW, PERMISSIONS.HR_ATTENDANCE],
    ]) {
      const detail = await findStaff(reader(...codes), "staff-1");
      expect(detail!.baseSalaryCentimes, codes.join("+")).toBeNull();
      expect(detail!.contracts, codes.join("+")).toEqual([]);
    }
  });

  it("is decided in the school in context, not org-wide", async () => {
    // `withPayroll` asks `can`, which is the current school's effective set — a
    // bursar in one school does not read another school's payroll by switching
    // the header.
    const elsewhere = {
      organization: { id: "org-1" },
      currentSchool: { id: "school-1" },
      currentSchoolYear: { id: "year-1" },
      can: () => false,
      canOrg: (code: string) => code === PERMISSIONS.HR_PAYROLL,
      canInSchool: () => false,
    } as unknown as AuthContext;

    const detail = await findStaff(elsewhere, "staff-1");
    expect(detail!.baseSalaryCentimes).toBeNull();
  });
});
