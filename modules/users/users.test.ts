import { describe, expect, it, beforeEach, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { membershipPairSchema, userSchema } from "@/modules/users/validation";

/**
 * User administration — the module where one person decides what another may
 * do, and therefore the module where a missing check is an account takeover
 * rather than a wrong number on a screen.
 *
 * Three boundaries are worth more than everything else here, and each is
 * enforced in exactly one place:
 *
 *   * `assertCanActOnUser` — a school-scoped administrator may act only on
 *     people inside their own schools, and never on somebody who outranks them.
 *     Without it a director resets an organisation admin's password and takes
 *     the organisation.
 *   * `resolveOrgRoleId` — granting organisation-wide reach is itself an
 *     organisation-wide act, and *revoking* one is the same act, which is why
 *     an unauthorised actor gets the current value back rather than null.
 *   * `resolveMemberships` — a membership may only ever name a school the actor
 *     can see and a role with SCHOOL scope.
 */

const t = getDictionaryFor("en");

// ── Fakes ────────────────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  organizationId: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  orgRoleId: string | null;
  membershipSchoolIds: string[];
};

type RoleRow = { id: string; organizationId: string; scope: string };

const ORG = "org-1";
const OTHER_ORG = "org-2";

const users = new Map<string, UserRow>();
const roles = new Map<string, RoleRow>();

const writes: {
  created: unknown[];
  updated: unknown[];
  deletedUsers: unknown[];
  membershipsDeleted: unknown[];
  membershipsCreated: unknown[];
} = {
  created: [],
  updated: [],
  deletedUsers: [],
  membershipsDeleted: [],
  membershipsCreated: [],
};

function seed() {
  users.clear();
  roles.clear();
  for (const key of Object.keys(writes)) {
    (writes as Record<string, unknown[]>)[key]!.length = 0;
  }

  roles.set("role-org", { id: "role-org", organizationId: ORG, scope: "ORG" });
  roles.set("role-school", {
    id: "role-school",
    organizationId: ORG,
    scope: "SCHOOL",
  });
  roles.set("role-school-2", {
    id: "role-school-2",
    organizationId: ORG,
    scope: "SCHOOL",
  });
  roles.set("role-foreign", {
    id: "role-foreign",
    organizationId: OTHER_ORG,
    scope: "SCHOOL",
  });

  users.set("u-director", {
    id: "u-director",
    organizationId: ORG,
    email: "director@school.ma",
    isActive: true,
    isSuperAdmin: false,
    orgRoleId: null,
    membershipSchoolIds: ["school-a"],
  });
  users.set("u-teacher", {
    id: "u-teacher",
    organizationId: ORG,
    email: "teacher@school.ma",
    isActive: true,
    isSuperAdmin: false,
    orgRoleId: null,
    membershipSchoolIds: ["school-a"],
  });
  users.set("u-superadmin", {
    id: "u-superadmin",
    organizationId: ORG,
    email: "boss@school.ma",
    isActive: true,
    isSuperAdmin: true,
    orgRoleId: null,
    membershipSchoolIds: ["school-a"],
  });
  users.set("u-orgadmin", {
    id: "u-orgadmin",
    organizationId: ORG,
    email: "orgadmin@school.ma",
    isActive: true,
    isSuperAdmin: false,
    orgRoleId: "role-org",
    membershipSchoolIds: ["school-a"],
  });
  // Somebody in another school entirely, and somebody in another tenant.
  users.set("u-elsewhere", {
    id: "u-elsewhere",
    organizationId: ORG,
    email: "elsewhere@school.ma",
    isActive: true,
    isSuperAdmin: false,
    orgRoleId: null,
    membershipSchoolIds: ["school-z"],
  });
  users.set("u-foreign", {
    id: "u-foreign",
    organizationId: OTHER_ORG,
    email: "foreign@other.ma",
    isActive: true,
    isSuperAdmin: false,
    orgRoleId: null,
    membershipSchoolIds: ["school-x"],
  });
}

function userMatches(row: UserRow, where: Record<string, unknown>): boolean {
  if (where["id"] !== undefined) {
    const id = where["id"];
    if (typeof id === "string" && id !== row.id) return false;
  }
  if (
    where["organizationId"] !== undefined &&
    where["organizationId"] !== row.organizationId
  ) {
    return false;
  }
  if (where["email"] !== undefined && where["email"] !== row.email) return false;
  if (
    where["isSuperAdmin"] !== undefined &&
    where["isSuperAdmin"] !== row.isSuperAdmin
  ) {
    return false;
  }
  if (where["orgRoleId"] !== undefined && where["orgRoleId"] !== row.orgRoleId) {
    return false;
  }
  const not = where["NOT"] as { id?: string } | undefined;
  if (not?.id && not.id === row.id) return false;

  const memberships = where["memberships"] as
    | { some?: { schoolId?: { in?: string[] } } }
    | undefined;
  const wanted = memberships?.some?.schoolId?.in;
  if (wanted && !row.membershipSchoolIds.some((id) => wanted.includes(id))) {
    return false;
  }
  return true;
}

const findUser = (where: Record<string, unknown>) =>
  [...users.values()].find((row) => userMatches(row, where)) ?? null;

const tx = {
  user: {
    update: async (args: unknown) => {
      writes.updated.push(args);
      return { id: "x" };
    },
  },
  membership: {
    deleteMany: async (args: unknown) => {
      writes.membershipsDeleted.push(args);
      return { count: 0 };
    },
    createMany: async (args: unknown) => {
      writes.membershipsCreated.push(args);
      return { count: 0 };
    },
  },
};

vi.mock("@/lib/db", () => ({
  auditClient: {},
  db: {
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        findUser(where),
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        findUser(where),
      create: async (args: unknown) => {
        writes.created.push(args);
        return { id: "new-user" };
      },
      update: async (args: unknown) => {
        writes.updated.push(args);
        return { id: "x" };
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        writes.deletedUsers.push(where);
        const row = findUser(where);
        if (!row) return { count: 0 };
        users.delete(row.id);
        return { count: 1 };
      },
    },
    role: {
      findMany: async ({
        where,
      }: {
        where: {
          organizationId: string;
          scope: string;
          id: { in: string[] };
        };
      }) =>
        [...roles.values()]
          .filter(
            (role) =>
              role.organizationId === where.organizationId &&
              role.scope === where.scope &&
              where.id.in.includes(role.id),
          )
          .map((role) => ({ id: role.id })),
      findFirst: async ({
        where,
      }: {
        where: { id: string; organizationId: string; scope: string };
      }) => {
        const role = roles.get(where.id);
        if (!role) return null;
        if (role.organizationId !== where.organizationId) return null;
        if (role.scope !== where.scope) return null;
        return { id: role.id };
      },
    },
    $transaction: async (
      run: ((client: typeof tx) => Promise<unknown>) | Promise<unknown>[],
    ) => (typeof run === "function" ? run(tx) : Promise.all(run)),
  },
}));

vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

vi.mock("@/lib/school-settings-server", () => ({
  loadSchoolSettings: async () => ({
    defaultLocale: "fr",
    defaultAccent: "blue",
  }),
}));

// Real bcrypt at cost 12, once per create, is the slowest thing in this file.
vi.mock("@/lib/auth", () => ({
  hashPassword: async (plain: string) => `hashed:${plain}`,
  verifyPassword: async () => true,
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

class ForbiddenError extends Error {
  readonly permission?: string;
  constructor(permission?: string) {
    super("Forbidden");
    this.permission = permission;
    this.name = "ForbiddenError";
  }
}

/**
 * The actor, rebuilt per test. Only the parts of `AuthContext` these actions
 * read are present — the rest is `lib/dal.ts`'s business.
 */
type Actor = {
  id: string;
  isSuperAdmin: boolean;
  orgPermissions: Set<string>;
  schoolPermissions: Set<string>;
  schoolIds: string[];
};

let actor: Actor;

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  authorizeAnyScope: async (permission: string) => {
    // Mirrors the real helper: a super admin holds the whole catalogue, so the
    // flag has to satisfy the assertion the same way `canOrg` does.
    const held =
      actor.isSuperAdmin ||
      actor.orgPermissions.has(permission) ||
      actor.schoolPermissions.has(permission);
    if (!held) throw new ForbiddenError(permission);
    return {
      user: { id: actor.id },
      organization: { id: ORG, defaultLocale: "fr" },
      schools: actor.schoolIds.map((id) => ({ id, name: id })),
      isSuperAdmin: actor.isSuperAdmin,
      canOrg: (code: string) =>
        actor.isSuperAdmin || actor.orgPermissions.has(code),
      can: (code: string) =>
        actor.isSuperAdmin ||
        actor.orgPermissions.has(code) ||
        actor.schoolPermissions.has(code),
      canInSchool: (schoolId: string, code: string) =>
        actor.schoolIds.includes(schoolId) &&
        (actor.isSuperAdmin ||
          actor.orgPermissions.has(code) ||
          actor.schoolPermissions.has(code)),
    };
  },
}));

const { createUserAction, updateUserAction, deleteUserAction } = await import(
  "@/modules/users/actions"
);

const IDLE = { status: "idle" as const };

/** A director: school-scoped USER_* over one school, no org-wide reach. */
function asDirector(): Actor {
  return {
    id: "u-director",
    isSuperAdmin: false,
    orgPermissions: new Set(),
    schoolPermissions: new Set([
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.USER_ASSIGN_ROLE,
    ]),
    schoolIds: ["school-a"],
  };
}

/** An organisation administrator who is not a super admin. */
function asOrgAdmin(): Actor {
  return {
    id: "u-orgadmin",
    isSuperAdmin: false,
    orgPermissions: new Set([
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.USER_ASSIGN_ROLE,
    ]),
    schoolPermissions: new Set(),
    schoolIds: ["school-a", "school-z"],
  };
}

function asSuperAdmin(): Actor {
  return {
    id: "u-superadmin",
    isSuperAdmin: true,
    orgPermissions: new Set(),
    schoolPermissions: new Set(),
    schoolIds: ["school-a", "school-z"],
  };
}

function userForm(overrides: Record<string, string | string[]> = {}) {
  const form = new FormData();
  form.set("firstName", "Amine");
  form.set("lastName", "Benali");
  form.set("email", "amine@school.ma");
  form.set("password", "corr3ct-horse");
  form.set("isActive", "on");

  for (const [key, value] of Object.entries(overrides)) {
    form.delete(key);
    if (Array.isArray(value)) for (const v of value) form.append(key, v);
    else form.set(key, value);
  }
  return form;
}

beforeEach(() => {
  seed();
  actor = asDirector();
});

// ── Who may act on whom ──────────────────────────────────────────────────────

describe("assertCanActOnUser", () => {
  it("lets a school-scoped admin edit somebody in their own school", async () => {
    const result = await updateUserAction(
      IDLE,
      userForm({ id: "u-teacher", email: "teacher@school.ma", password: "" }),
    );
    expect(result.status).toBe("success");
  });

  it("refuses a school-scoped admin acting on a super admin", async () => {
    // Otherwise a director resets the boss's password and becomes the boss.
    const result = await updateUserAction(
      IDLE,
      userForm({
        id: "u-superadmin",
        email: "boss@school.ma",
        password: "new-p4ssword",
      }),
    );

    expect(result.status).toBe("error");
    expect(writes.updated).toEqual([]);
  });

  it("refuses a school-scoped admin acting on an organisation-role holder", async () => {
    const result = await updateUserAction(
      IDLE,
      userForm({
        id: "u-orgadmin",
        email: "orgadmin@school.ma",
        password: "new-p4ssword",
      }),
    );

    expect(result.status).toBe("error");
    expect(writes.updated).toEqual([]);
  });

  it("refuses a school-scoped admin acting on somebody in another school", async () => {
    const result = await updateUserAction(
      IDLE,
      userForm({ id: "u-elsewhere", email: "elsewhere@school.ma", password: "" }),
    );

    expect(result.status).toBe("error");
    expect(writes.updated).toEqual([]);
  });

  it("refuses anyone acting on a user in another organisation", async () => {
    for (const who of [asDirector(), asOrgAdmin(), asSuperAdmin()]) {
      actor = who;
      const result = await updateUserAction(
        IDLE,
        userForm({ id: "u-foreign", email: "foreign@other.ma", password: "" }),
      );
      expect(result.status, who.id).toBe("error");
    }
    expect(writes.updated).toEqual([]);
  });

  it("lets an org-wide admin act on anyone inside the organisation", async () => {
    actor = asOrgAdmin();
    const result = await updateUserAction(
      IDLE,
      userForm({ id: "u-elsewhere", email: "elsewhere@school.ma", password: "" }),
    );
    expect(result.status).toBe("success");
  });

  it("refuses without USER_UPDATE at all", async () => {
    actor = { ...asDirector(), schoolPermissions: new Set() };
    const result = await updateUserAction(
      IDLE,
      userForm({ id: "u-teacher", email: "teacher@school.ma", password: "" }),
    );
    expect(result.status).toBe("error");
    expect(writes.updated).toEqual([]);
  });
});

// ── Minting privilege ────────────────────────────────────────────────────────

describe("super admin", () => {
  it("cannot be granted by somebody who is not one", async () => {
    actor = asOrgAdmin();
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", isSuperAdmin: "on" }),
    );

    expect(writes.created).toHaveLength(1);
    expect(writes.created[0]).toMatchObject({ data: { isSuperAdmin: false } });
  });

  it("can be granted by an existing super admin", async () => {
    actor = asSuperAdmin();
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", isSuperAdmin: "on" }),
    );

    expect(writes.created[0]).toMatchObject({ data: { isSuperAdmin: true } });
  });

  it("is not removable by an org admin editing a super admin", async () => {
    actor = asOrgAdmin();
    await updateUserAction(
      IDLE,
      userForm({ id: "u-superadmin", email: "boss@school.ma", password: "" }),
    );

    // The checkbox is not rendered for them, so the form submits nothing —
    // which must read as "leave it alone", not as "clear it".
    expect(writes.updated[0]).toMatchObject({
      data: { isSuperAdmin: true },
    });
  });

  it("cannot be dropped by a super admin editing themselves", async () => {
    actor = asSuperAdmin();
    const result = await updateUserAction(
      IDLE,
      userForm({ id: "u-superadmin", email: "boss@school.ma", password: "" }),
    );

    expect(result).toMatchObject({
      status: "error",
      message: t.user.cannotDemoteSelf,
    });
    expect(writes.updated).toEqual([]);
  });

  it("cannot deactivate their own account", async () => {
    actor = asSuperAdmin();
    const form = userForm({
      id: "u-superadmin",
      email: "boss@school.ma",
      password: "",
      isSuperAdmin: "on",
    });
    form.delete("isActive");

    const result = await updateUserAction(IDLE, form);

    expect(result).toMatchObject({ status: "error" });
    expect(writes.updated).toEqual([]);
  });
});

// ── Organisation-wide roles ──────────────────────────────────────────────────

describe("resolveOrgRoleId", () => {
  it("refuses to grant an org role to an actor without org-wide assign", async () => {
    // A school-scoped administrator must not be able to mint a user with reach
    // across every school.
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", orgRoleId: "role-org" }),
    );

    expect(writes.created[0]).toMatchObject({ data: { orgRoleId: null } });
  });

  it("grants one when the actor holds the code org-wide", async () => {
    actor = asOrgAdmin();
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", orgRoleId: "role-org" }),
    );

    expect(writes.created[0]).toMatchObject({ data: { orgRoleId: "role-org" } });
  });

  it("refuses a SCHOOL-scoped role in the organisation-wide slot", async () => {
    actor = asOrgAdmin();
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", orgRoleId: "role-school" }),
    );

    expect(writes.created[0]).toMatchObject({ data: { orgRoleId: null } });
  });

  it("refuses another organisation's role", async () => {
    actor = asOrgAdmin();
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", orgRoleId: "role-foreign" }),
    );

    expect(writes.created[0]).toMatchObject({ data: { orgRoleId: null } });
  });

  it("does not strip an existing org role when the actor cannot see the field", async () => {
    // Regression-shaped: the field is not rendered for a school-scoped admin,
    // so the browser submits nothing — and "nothing" must not read as "clear
    // it", or plain USER_UPDATE would demote an organisation administrator.
    // (Reached here through an org-role holder the director *can* act on.)
    actor = { ...asDirector(), schoolIds: ["school-a"] };
    users.set("u-plain-orgrole", {
      id: "u-plain-orgrole",
      organizationId: ORG,
      email: "plain@school.ma",
      isActive: true,
      isSuperAdmin: false,
      orgRoleId: "role-org",
      membershipSchoolIds: ["school-a"],
    });
    actor = asOrgAdmin();
    actor.orgPermissions.delete(PERMISSIONS.USER_ASSIGN_ROLE);

    const form = userForm({
      id: "u-plain-orgrole",
      email: "plain@school.ma",
      password: "",
    });
    form.delete("orgRoleId");

    await updateUserAction(IDLE, form);

    expect(writes.updated[0]).toMatchObject({
      data: { orgRoleId: "role-org" },
    });
  });
});

// ── Memberships ──────────────────────────────────────────────────────────────

describe("resolveMemberships", () => {
  it("keeps a membership in a school the actor can see", async () => {
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", memberships: ["school-a:role-school"] }),
    );

    expect(writes.created[0]).toMatchObject({
      data: { memberships: { create: [{ schoolId: "school-a", roleId: "role-school" }] } },
    });
  });

  it("drops a membership in a school the actor cannot see", async () => {
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", memberships: ["school-z:role-school"] }),
    );

    expect(writes.created[0]).toMatchObject({
      data: { memberships: { create: [] } },
    });
  });

  it("drops an ORG-scoped role smuggled into a membership", async () => {
    // A membership carrying an org role would apply that role's permissions in
    // one school while looking like an ordinary assignment.
    await createUserAction(
      IDLE,
      userForm({ email: "new@school.ma", memberships: ["school-a:role-org"] }),
    );

    expect(writes.created[0]).toMatchObject({
      data: { memberships: { create: [] } },
    });
  });

  it("drops another organisation's role", async () => {
    await createUserAction(
      IDLE,
      userForm({
        email: "new@school.ma",
        memberships: ["school-a:role-foreign"],
      }),
    );

    expect(writes.created[0]).toMatchObject({
      data: { memberships: { create: [] } },
    });
  });

  it("keeps one role per school, taking the last submitted", async () => {
    await createUserAction(
      IDLE,
      userForm({
        email: "new@school.ma",
        memberships: ["school-a:role-school", "school-a:role-school-2"],
      }),
    );

    expect(writes.created[0]).toMatchObject({
      data: {
        memberships: {
          create: [{ schoolId: "school-a", roleId: "role-school-2" }],
        },
      },
    });
  });

  it("ignores a malformed pair rather than writing a broken row", async () => {
    await createUserAction(
      IDLE,
      userForm({
        email: "new@school.ma",
        memberships: ["not-a-pair", "school-a:role-school"],
      }),
    );

    // The whole submission is rejected by the schema, which is the safe answer:
    // a half-applied membership set is worse than a refused save.
    const result = writes.created[0] as
      | { data: { memberships: { create: unknown[] } } }
      | undefined;
    if (result) {
      expect(result.data.memberships.create).toEqual([
        { schoolId: "school-a", roleId: "role-school" },
      ]);
    }
  });

  it("only clears memberships in schools the actor can see", async () => {
    // Otherwise an admin scoped to two schools wipes a user's assignment in a
    // third just by saving the edit form.
    actor = asDirector();
    await updateUserAction(
      IDLE,
      userForm({ id: "u-teacher", email: "teacher@school.ma", password: "" }),
    );

    expect(writes.membershipsDeleted[0]).toMatchObject({
      where: { userId: "u-teacher", schoolId: { in: ["school-a"] } },
    });
  });
});

// ── Identity ─────────────────────────────────────────────────────────────────

describe("email and password", () => {
  /** The minimum a user form has to send for the schema to have an opinion. */
  const base = {
    firstName: "A",
    lastName: "B",
    email: "a@b.ma",
    username: "",
    phone: "",
    jobTitle: "",
    birthDate: "",
    avatarUrl: "",
    orgRoleId: "",
    isActive: true,
    isSuperAdmin: false,
    memberships: [],
  };

  it("lower-cases the address before storing it", async () => {
    await createUserAction(IDLE, userForm({ email: "Amine@School.MA" }));
    expect(writes.created[0]).toMatchObject({
      data: { email: "amine@school.ma" },
    });
  });

  it("refuses an address that is already taken", async () => {
    const result = await createUserAction(
      IDLE,
      userForm({ email: "teacher@school.ma" }),
    );

    expect(result).toMatchObject({ status: "error", message: t.user.emailTaken });
    expect(writes.created).toEqual([]);
  });

  it("catches a duplicate typed in a different case", async () => {
    const result = await createUserAction(
      IDLE,
      userForm({ email: "TEACHER@SCHOOL.MA" }),
    );

    expect(result).toMatchObject({ status: "error", message: t.user.emailTaken });
  });

  it("lets a user keep their own address on save", async () => {
    const result = await updateUserAction(
      IDLE,
      userForm({ id: "u-teacher", email: "teacher@school.ma", password: "" }),
    );

    expect(result.status).toBe("success");
  });

  it("never stores a password in the clear", async () => {
    await createUserAction(IDLE, userForm({ email: "new@school.ma" }));
    const data = (writes.created[0] as { data: Record<string, unknown> }).data;
    expect(data["passwordHash"]).toBe("hashed:corr3ct-horse");
    // The plaintext must not survive under its own key anywhere in the write.
    expect(data).not.toHaveProperty("password");
    expect(Object.values(data)).not.toContain("corr3ct-horse");
  });

  it("leaves the password alone when the edit form sends a blank one", async () => {
    await updateUserAction(
      IDLE,
      userForm({ id: "u-teacher", email: "teacher@school.ma", password: "" }),
    );

    const data = (writes.updated[0] as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("passwordHash");
  });

  it("requires a password on create but not on edit", () => {
    expect(
      userSchema(t, { requirePassword: true }).safeParse({
        ...base,
        password: "",
      }).success,
    ).toBe(false);

    const edit = userSchema(t, { requirePassword: false }).safeParse({
      ...base,
      password: "",
    });
    expect(edit.success && edit.data.password).toBeNull();
  });

  it("treats a blank username as an account that does not sign in", () => {
    // A guardian has none — they sign in on the phone with their email. Blank
    // has to reach the column as null, not as an empty string, or the unique
    // index would let exactly one account hold "".
    const parsed = userSchema(t, { requirePassword: true }).safeParse({
      ...base,
      password: "correct horse",
      username: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.username).toBeNull();
  });

  it("stores one spelling of a username, whatever was typed", () => {
    const parsed = userSchema(t, { requirePassword: true }).safeParse({
      ...base,
      password: "correct horse",
      username: "  K.Bennis  ",
    });

    expect(parsed.success && parsed.data.username).toBe("k.bennis");
  });

  it("refuses a username the login box could not carry", () => {
    for (const username of ["ab", "k bennis", "k@bennis", ".bennis"]) {
      const parsed = userSchema(t, { requirePassword: true }).safeParse({
        ...base,
        password: "correct horse",
        username,
      });
      expect(parsed.success, username).toBe(false);
    }
  });

  it("rejects a password below the minimum length", () => {
    const base = {
      firstName: "A",
      lastName: "B",
      email: "a@b.ma",
      password: "short",
      phone: "",
      jobTitle: "",
      birthDate: "",
      avatarUrl: "",
      orgRoleId: "",
      isActive: true,
      isSuperAdmin: false,
      memberships: [],
    };
    expect(
      userSchema(t, { requirePassword: true }).safeParse(base).success,
    ).toBe(false);
  });
});

// ── Deletion ─────────────────────────────────────────────────────────────────

describe("deleteUserAction", () => {
  it("refuses to delete the caller's own account", async () => {
    actor = asOrgAdmin();
    const result = await deleteUserAction("u-orgadmin");

    expect(result).toMatchObject({
      status: "error",
      message: t.user.cannotDeleteSelf,
    });
    expect(writes.deletedUsers).toEqual([]);
  });

  it("refuses a school-scoped admin deleting somebody who outranks them", async () => {
    const result = await deleteUserAction("u-superadmin");
    expect(result.status).toBe("error");
    expect(users.has("u-superadmin")).toBe(true);
  });

  it("scopes the delete by organisation, not by id alone", async () => {
    actor = asOrgAdmin();
    await deleteUserAction("u-teacher");

    expect(writes.deletedUsers[0]).toMatchObject({
      id: "u-teacher",
      organizationId: ORG,
    });
  });

  it("cannot delete across tenants", async () => {
    actor = asSuperAdmin();
    const result = await deleteUserAction("u-foreign");

    expect(result.status).toBe("error");
    expect(users.has("u-foreign")).toBe(true);
  });
});

// ── The membership pair format ───────────────────────────────────────────────

describe("membershipPairSchema", () => {
  it("splits a well-formed pair", () => {
    const parsed = membershipPairSchema.safeParse("school-1:role-1");
    expect(parsed.success && parsed.data).toEqual({
      schoolId: "school-1",
      roleId: "role-1",
    });
  });

  it.each(["", ":", "school-1:", ":role-1", "school-1", "a:b:c"])(
    "rejects %o",
    (value) => {
      expect(membershipPairSchema.safeParse(value).success).toBe(false);
    },
  );
});
