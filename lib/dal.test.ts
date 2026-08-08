import { beforeEach, describe, expect, it, vi } from "vitest";

import { credentialsStamp } from "@/lib/mobile-token";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * The Data Access Layer — where every authorization decision in the app is
 * actually made.
 *
 * Every other test file in this repo mocks `authorizeSchool` away, which is the
 * right thing for a module test and leaves exactly one function untested: the
 * one they all rely on. This file is that function, against a faked database.
 *
 * Four properties carry the whole permission system:
 *
 *   1. **The JWT holds nothing but a user id.** Everything else is re-read from
 *      the database on every request, which is what makes revoking a role take
 *      effect immediately instead of when a token expires.
 *   2. **A school you cannot see is a school you cannot act in**, whatever
 *      permission you hold elsewhere. `authorizeSchool` checks visibility *and*
 *      the code, and a request-supplied school id is never trusted for either.
 *   3. **Org-wide reach is the super-admin flag or an org role, and nothing
 *      else.** A school membership, however privileged, never widens the set of
 *      schools you can see.
 *   4. **A stale credential is not a credential.** A deactivated account, or a
 *      session that predates the account's last password change, resolves to no
 *      context at all.
 */

// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

let userRow: Row | null = null;
let orgSchools: Row[] = [];
let years: Row[] = [];
const calls: { model: string; op: string; args: unknown }[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async (args: unknown) => {
        calls.push({ model: "user", op: "findUnique", args });
        return userRow;
      },
      update: async (args: unknown) => {
        calls.push({ model: "user", op: "update", args });
        return {};
      },
    },
    school: {
      findMany: async (args: unknown) => {
        calls.push({ model: "school", op: "findMany", args });
        return orgSchools;
      },
    },
    schoolYear: {
      findMany: async (args: unknown) => {
        calls.push({ model: "schoolYear", op: "findMany", args });
        return years;
      },
    },
    schoolSettings: {
      findUnique: async () => null,
    },
  },
  auditClient: {},
}));

/** Who the session says is calling. Null stands for nobody signed in. */
let session: { id: string; credentialsStamp?: number } | null = null;
/** The Authorization header, for the bearer-token path. */
let authorization: string | null = null;

vi.mock("@/lib/auth", () => ({
  auth: async () => (session ? { user: session } : null),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => authorization }),
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirected to ${to}`);
  },
}));

// `cache` memoises per request; there is no request here, and a cached context
// would leak the first test's user into the second.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const {
  ForbiddenError,
  authorizeAnyScope,
  authorizeOrg,
  authorizeSchool,
  displayName,
  getAuthContext,
} = await import("@/lib/dal");

// ─────────────────────────────────────────────────────────────────────────────

const school = (id: string, name = id) => ({
  id,
  name,
  organizationId: "org-1",
});

const role = (...codes: string[]) => ({
  permissions: codes.map((code) => ({ permission: { code } })),
});

function signIn(user: Partial<Row> = {}) {
  userRow = {
    id: "user-1",
    isActive: true,
    isSuperAdmin: false,
    organizationId: "org-1",
    organization: { id: "org-1", name: "Groupe" },
    credentialsChangedAt: null,
    currentSchoolId: null,
    currentSchoolYearId: null,
    orgRoleId: null,
    orgRole: null,
    profile: null,
    memberships: [],
    ...user,
  };
  session = { id: "user-1", credentialsStamp: 0 };
}

/** A membership in one school, carrying one role. */
const member = (schoolId: string, ...codes: string[]) => ({
  schoolId,
  school: school(schoolId),
  role: role(...codes),
});

beforeEach(() => {
  calls.length = 0;
  userRow = null;
  orgSchools = [];
  years = [];
  session = null;
  authorization = null;
});

// ── Who is signed in ─────────────────────────────────────────────────────────

describe("resolving the caller", () => {
  it("answers nothing when nobody is signed in", async () => {
    expect(await getAuthContext()).toBeNull();
  });

  it("answers nothing for a session naming a user who is gone", async () => {
    session = { id: "user-1" };
    userRow = null;
    expect(await getAuthContext()).toBeNull();
  });

  it("cuts off an account deactivated mid-session", async () => {
    // On their very next request, not when the token expires.
    signIn({ isActive: false });
    expect(await getAuthContext()).toBeNull();
  });

  it("cuts off a session that predates the last password change", async () => {
    // Deactivating used to be the only way to evict somebody: a reset moved the
    // hash and nothing else, so a stolen cookie kept working until it expired
    // and a stolen refresh token kept renewing itself for sixty days.
    signIn({ credentialsChangedAt: new Date(2026, 0, 15) });
    session = { id: "user-1", credentialsStamp: 0 };
    expect(await getAuthContext()).toBeNull();
  });

  it("keeps a session issued after the change", async () => {
    const changedAt = new Date(2026, 0, 15);
    signIn({ credentialsChangedAt: changedAt });
    // Stamped from the same helper the sign-in uses, so the two cannot drift
    // about what unit this is measured in.
    session = { id: "user-1", credentialsStamp: credentialsStamp(changedAt) };
    expect(await getAuthContext()).not.toBeNull();
  });

  it("reads the user from the database, not from the token", async () => {
    // The JWT holds a user id and nothing else — which is what makes revoking a
    // role take effect on the next request.
    signIn();
    await getAuthContext();
    expect(calls[0]).toMatchObject({
      model: "user",
      op: "findUnique",
      args: { where: { id: "user-1" } },
    });
  });
});

// ── Which schools a user can see ─────────────────────────────────────────────

describe("the reachable schools", () => {
  it("gives a school-scoped user only the schools they hold a membership in", async () => {
    orgSchools = [school("school-1"), school("school-2"), school("school-3")];
    signIn({ memberships: [member("school-1", PERMISSIONS.STUDENT_VIEW)] });

    const context = await getAuthContext();
    expect(context!.schools.map((entry) => entry.id)).toEqual(["school-1"]);
    // And it never asks the database for the rest.
    expect(calls.some((call) => call.model === "school")).toBe(false);
  });

  it("gives an org-role holder every school in the organisation", async () => {
    orgSchools = [school("school-1"), school("school-2")];
    signIn({ orgRoleId: "role-org", orgRole: role(PERMISSIONS.SCHOOL_VIEW) });

    const context = await getAuthContext();
    expect(context!.schools.map((entry) => entry.id)).toEqual([
      "school-1",
      "school-2",
    ]);
  });

  it("gives a super admin every school", async () => {
    orgSchools = [school("school-1"), school("school-2")];
    signIn({ isSuperAdmin: true });

    const context = await getAuthContext();
    expect(context!.schools).toHaveLength(2);
  });

  it("confines the org-wide read to the user's own organisation", async () => {
    orgSchools = [school("school-1")];
    signIn({ isSuperAdmin: true });
    await getAuthContext();

    expect(calls.find((call) => call.model === "school")!.args).toMatchObject({
      where: { organizationId: "org-1" },
    });
  });

  it("never lets a school membership widen the set", async () => {
    // However privileged a school role is, it is a role *in* a school. Only the
    // super-admin flag and an org role reach across them.
    orgSchools = [school("school-1"), school("school-2")];
    signIn({
      memberships: [
        member("school-1", ...(Object.values(PERMISSIONS) as string[])),
      ],
    });

    const context = await getAuthContext();
    expect(context!.schools.map((entry) => entry.id)).toEqual(["school-1"]);
  });
});

// ── The working context ──────────────────────────────────────────────────────

describe("the school in context", () => {
  it("takes the one stored on the user", async () => {
    signIn({
      currentSchoolId: "school-2",
      memberships: [member("school-1"), member("school-2")],
    });
    const context = await getAuthContext();
    expect(context!.currentSchool!.id).toBe("school-2");
  });

  it("falls back when the stored school is no longer reachable", async () => {
    // A membership revoked between one request and the next.
    signIn({
      currentSchoolId: "school-9",
      memberships: [member("school-1")],
    });
    const context = await getAuthContext();
    expect(context!.currentSchool!.id).toBe("school-1");
  });

  it("does not write that fallback back", async () => {
    // Rendering a page must not write to the database — and leaving it unwritten
    // is what makes the revocation take effect again the moment it is undone.
    signIn({ currentSchoolId: "school-9", memberships: [member("school-1")] });
    await getAuthContext();
    expect(calls.some((call) => call.op === "update")).toBe(false);
  });

  it("answers no school at all for somebody with none", async () => {
    // The first login, or a user whose only membership was just revoked.
    signIn();
    const context = await getAuthContext();
    expect(context!.currentSchool).toBeNull();
    expect(context!.schoolYears).toEqual([]);
  });

  it("reads the years of the school in context, and no other", async () => {
    signIn({ memberships: [member("school-1")] });
    await getAuthContext();

    expect(calls.find((call) => call.model === "schoolYear")!.args).toMatchObject(
      { where: { schoolId: "school-1" } },
    );
  });
});

describe("the year in context", () => {
  const year = (id: string, extra: Row = {}) => ({
    id,
    schoolId: "school-1",
    isDefault: false,
    status: "CLOSED",
    startDate: new Date(2025, 8, 1),
    ...extra,
  });

  it("takes the one stored on the user", async () => {
    years = [year("year-1"), year("year-2")];
    signIn({
      currentSchoolYearId: "year-2",
      memberships: [member("school-1")],
    });
    expect((await getAuthContext())!.currentSchoolYear!.id).toBe("year-2");
  });

  it("falls back to the school's default", async () => {
    years = [year("year-1"), year("year-2", { isDefault: true })];
    signIn({ currentSchoolYearId: "gone", memberships: [member("school-1")] });
    expect((await getAuthContext())!.currentSchoolYear!.id).toBe("year-2");
  });

  it("then to the one that is running", async () => {
    years = [year("year-1"), year("year-2", { status: "ACTIVE" })];
    signIn({ memberships: [member("school-1")] });
    expect((await getAuthContext())!.currentSchoolYear!.id).toBe("year-2");
  });

  it("then to whichever is newest", async () => {
    years = [year("year-1"), year("year-2")];
    signIn({ memberships: [member("school-1")] });
    expect((await getAuthContext())!.currentSchoolYear!.id).toBe("year-1");
  });

  it("answers none for a school with no years yet", async () => {
    signIn({ memberships: [member("school-1")] });
    expect((await getAuthContext())!.currentSchoolYear).toBeNull();
  });
});

// ── What a user may do, and where ────────────────────────────────────────────

describe("the permission sets", () => {
  it("layers a school role on top of the org-wide one", async () => {
    signIn({
      orgRoleId: "role-org",
      orgRole: role(PERMISSIONS.SCHOOL_VIEW),
      memberships: [member("school-1", PERMISSIONS.STUDENT_VIEW)],
      currentSchoolId: "school-1",
    });
    orgSchools = [school("school-1")];

    const context = await getAuthContext();
    expect(context!.can(PERMISSIONS.STUDENT_VIEW)).toBe(true);
    expect(context!.can(PERMISSIONS.SCHOOL_VIEW)).toBe(true);
  });

  it("gives a super admin the whole catalogue org-wide", async () => {
    orgSchools = [school("school-1")];
    signIn({ isSuperAdmin: true });

    const context = await getAuthContext();
    for (const code of Object.values(PERMISSIONS)) {
      expect(context!.canOrg(code), code).toBe(true);
    }
  });

  it("does not make a school role org-wide", async () => {
    // `canOrg` is the super-admin flag or the org role only. A director of one
    // school holds nothing across the others.
    signIn({
      memberships: [member("school-1", PERMISSIONS.STUDENT_VIEW)],
      currentSchoolId: "school-1",
    });

    const context = await getAuthContext();
    expect(context!.can(PERMISSIONS.STUDENT_VIEW)).toBe(true);
    expect(context!.canOrg(PERMISSIONS.STUDENT_VIEW)).toBe(false);
  });

  it("answers only the org-wide set for a school with no membership", async () => {
    signIn({
      memberships: [member("school-1", PERMISSIONS.STUDENT_VIEW)],
      currentSchoolId: "school-1",
    });

    const context = await getAuthContext();
    expect(context!.canInSchool("school-1", PERMISSIONS.STUDENT_VIEW)).toBe(true);
    expect(context!.canInSchool("school-2", PERMISSIONS.STUDENT_VIEW)).toBe(
      false,
    );
  });

  it("falls back to the org-wide set with no school in context", async () => {
    signIn({ orgRoleId: "role-org", orgRole: role(PERMISSIONS.SCHOOL_VIEW) });
    orgSchools = [];

    const context = await getAuthContext();
    expect(context!.currentSchool).toBeNull();
    expect(context!.can(PERMISSIONS.SCHOOL_VIEW)).toBe(true);
  });
});

// ── The three gates ──────────────────────────────────────────────────────────

describe("authorizeSchool", () => {
  it("lets a member act in their own school", async () => {
    signIn({
      memberships: [member("school-1", PERMISSIONS.STUDENT_UPDATE)],
      currentSchoolId: "school-1",
    });
    await expect(
      authorizeSchool("school-1", PERMISSIONS.STUDENT_UPDATE),
    ).resolves.toBeDefined();
  });

  it("refuses a school a member holds nothing in", async () => {
    // A director of school A naming school B in a request. The code check alone
    // already refuses this — `canInSchool` falls back to the org-wide set,
    // which is empty for somebody with no org role — so this pins the fallback
    // rather than the visibility gate. What the *visibility* gate is for is two
    // tests down: an org-wide holder naming a school outside their own
    // organisation, where `canInSchool` would otherwise say yes.
    signIn({
      memberships: [member("school-1", PERMISSIONS.STUDENT_UPDATE)],
      currentSchoolId: "school-1",
    });
    await expect(
      authorizeSchool("school-2", PERMISSIONS.STUDENT_UPDATE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses a visible school where the code is not held", async () => {
    signIn({
      memberships: [member("school-1", PERMISSIONS.STUDENT_VIEW)],
      currentSchoolId: "school-1",
    });
    await expect(
      authorizeSchool("school-1", PERMISSIONS.STUDENT_UPDATE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("names the permission it refused for", async () => {
    signIn({ memberships: [member("school-1")] });
    await expect(
      authorizeSchool("school-1", PERMISSIONS.STUDENT_UPDATE),
    ).rejects.toMatchObject({ permission: PERMISSIONS.STUDENT_UPDATE });
  });

  it("lets an org-role holder act in any school of the organisation", async () => {
    orgSchools = [school("school-1"), school("school-2")];
    signIn({
      orgRoleId: "role-org",
      orgRole: role(PERMISSIONS.STUDENT_UPDATE),
    });

    await expect(
      authorizeSchool("school-2", PERMISSIONS.STUDENT_UPDATE),
    ).resolves.toBeDefined();
  });

  it("refuses a school of another organisation even for a super admin", async () => {
    // The org-wide read is scoped to their own organisation, so a school
    // outside it is not in `schools` and the visibility check refuses it.
    orgSchools = [school("school-1")];
    signIn({ isSuperAdmin: true });

    await expect(
      authorizeSchool("school-elsewhere", PERMISSIONS.STUDENT_UPDATE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("authorizeOrg", () => {
  it("refuses somebody who holds the code only in a school", async () => {
    signIn({
      memberships: [member("school-1", PERMISSIONS.ROLE_UPDATE)],
      currentSchoolId: "school-1",
    });
    await expect(
      authorizeOrg(PERMISSIONS.ROLE_UPDATE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("accepts an org-role holder", async () => {
    orgSchools = [school("school-1")];
    signIn({ orgRoleId: "role-org", orgRole: role(PERMISSIONS.ROLE_UPDATE) });
    await expect(authorizeOrg(PERMISSIONS.ROLE_UPDATE)).resolves.toBeDefined();
  });
});

describe("authorizeAnyScope", () => {
  it("accepts somebody holding the code in one of their schools", async () => {
    signIn({
      memberships: [
        member("school-1"),
        member("school-2", PERMISSIONS.USER_CREATE),
      ],
      currentSchoolId: "school-1",
    });
    await expect(
      authorizeAnyScope(PERMISSIONS.USER_CREATE),
    ).resolves.toBeDefined();
  });

  it("refuses somebody who holds it nowhere", async () => {
    signIn({
      memberships: [member("school-1", PERMISSIONS.STUDENT_VIEW)],
      currentSchoolId: "school-1",
    });
    await expect(
      authorizeAnyScope(PERMISSIONS.USER_CREATE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("accepts an org-wide holder with no school at all", async () => {
    signIn({ orgRoleId: "role-org", orgRole: role(PERMISSIONS.USER_CREATE) });
    orgSchools = [];
    await expect(
      authorizeAnyScope(PERMISSIONS.USER_CREATE),
    ).resolves.toBeDefined();
  });
});

// ── The bearer-token path ────────────────────────────────────────────────────

describe("the native app's token", () => {
  it("is not consulted while a session cookie answers", async () => {
    signIn({ memberships: [member("school-1")] });
    authorization = "Bearer nonsense";
    expect(await getAuthContext()).not.toBeNull();
  });

  it("answers nothing for a token that is not a token", async () => {
    session = null;
    authorization = "Bearer nonsense";
    expect(await getAuthContext()).toBeNull();
  });

  it("answers nothing with no header at all", async () => {
    session = null;
    authorization = null;
    expect(await getAuthContext()).toBeNull();
  });
});

// ── A small helper the shell leans on ────────────────────────────────────────

describe("displayName", () => {
  it("prefers the profile's name", () => {
    expect(
      displayName({
        profile: { firstName: "Karim", lastName: "Alaoui" },
        email: "k@school.ma",
      }),
    ).toBe("Karim Alaoui");
  });

  it("falls back to the address for an account with no profile yet", () => {
    expect(displayName({ profile: null, email: "k@school.ma" })).toBe(
      "k@school.ma",
    );
  });

  it("falls back when the profile is blank rather than printing a space", () => {
    expect(
      displayName({
        profile: { firstName: "", lastName: "" },
        email: "k@school.ma",
      }),
    ).toBe("k@school.ma");
  });
});
