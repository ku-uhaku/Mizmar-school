import { describe, expect, it, beforeEach, vi } from "vitest";

import { ALL_PERMISSION_CODES, PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";

/**
 * The three role-editing actions, against a faked database.
 *
 * What is worth pinning here is not that they write the right columns — the
 * schema says that — but the four refusals they are the only place to make:
 *
 *   * every one of them authorizes org-wide *before* reading anything,
 *   * a role id from the request is only ever matched together with the
 *     actor's own organisation, so a crafted id cannot reach another tenant,
 *   * a system role keeps its identity and cannot be deleted,
 *   * a role somebody still holds can neither be deleted nor re-scoped.
 */

const t = getDictionaryFor("en");

type RoleRow = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  scope: string;
  isSystem: boolean;
  memberships: number;
  orgUsers: number;
};

const roles = new Map<string, RoleRow>();
const created: unknown[] = [];
const updated: unknown[] = [];
const deleted: string[] = [];

const ORG = "org-1";
const OTHER_ORG = "org-2";

function seedRoles() {
  roles.clear();
  created.length = 0;
  updated.length = 0;
  deleted.length = 0;

  roles.set("role-admin", {
    id: "role-admin",
    organizationId: ORG,
    name: "Administrateur",
    description: null,
    scope: "ORG",
    isSystem: true,
    memberships: 0,
    orgUsers: 1,
  });
  roles.set("role-custom", {
    id: "role-custom",
    organizationId: ORG,
    name: "Surveillant",
    description: null,
    scope: "SCHOOL",
    isSystem: false,
    memberships: 0,
    orgUsers: 0,
  });
  roles.set("role-held", {
    id: "role-held",
    organizationId: ORG,
    name: "Surveillant général",
    description: null,
    scope: "SCHOOL",
    isSystem: false,
    memberships: 7,
    orgUsers: 0,
  });
  // Another tenant's role, present so a crafted id has something to reach.
  roles.set("role-foreign", {
    id: "role-foreign",
    organizationId: OTHER_ORG,
    name: "Étranger",
    description: null,
    scope: "SCHOOL",
    isSystem: false,
    memberships: 0,
    orgUsers: 0,
  });
}

const matches = (row: RoleRow, where: Record<string, unknown>): boolean => {
  if (where["id"] && where["id"] !== row.id) return false;
  if (
    where["organizationId"] &&
    where["organizationId"] !== row.organizationId
  ) {
    return false;
  }
  if (where["name"] && where["name"] !== row.name) return false;
  const not = where["NOT"] as { id?: string } | undefined;
  if (not?.id && not.id === row.id) return false;
  const composite = where["organizationId_name"] as
    | { organizationId: string; name: string }
    | undefined;
  if (composite) {
    if (composite.organizationId !== row.organizationId) return false;
    if (composite.name !== row.name) return false;
  }
  return true;
};

const findRole = (where: Record<string, unknown>) =>
  [...roles.values()].find((row) => matches(row, where)) ?? null;

const project = (row: RoleRow) => ({
  ...row,
  _count: { memberships: row.memberships, orgUsers: row.orgUsers },
});

vi.mock("@/lib/db", () => ({
  db: {
    role: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const row = findRole(where);
        return row ? project(row) : null;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = findRole(where);
        return row ? project(row) : null;
      },
      create: async (args: unknown) => {
        created.push(args);
        return { id: "new-role" };
      },
      update: async (args: { where: { id: string } }) => {
        updated.push(args);
        return { id: args.where.id };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id);
        roles.delete(where.id);
        return { id: where.id };
      },
    },
    rolePermission: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
    },
    permission: {
      findMany: async ({ where }: { where: { code: { in: string[] } } }) =>
        where.code.in.map((code) => ({ id: `perm-${code}` })),
    },
    // The update action batches its writes; running them is enough here.
    $transaction: async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
  },
  auditClient: {},
}));

// `withActionErrors` records every refusal in the trail. That it does so is the
// audit module's business, not this one's.
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

// Authorization itself is `lib/dal.ts`'s job and is tested there. What matters
// for these actions is only *that* they ask, and with which code — so the fake
// records the request and answers from a per-test permission set.
const granted = new Set<string>();
const asked: string[] = [];

class ForbiddenError extends Error {
  readonly permission?: string;
  constructor(permission?: string) {
    super(permission ? `Missing permission: ${permission}` : "Forbidden");
    this.permission = permission;
    this.name = "ForbiddenError";
  }
}

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  authorizeOrg: async (permission: string) => {
    asked.push(permission);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return { organization: { id: ORG } };
  },
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

const { createRoleAction, updateRoleAction, deleteRoleAction } = await import(
  "@/modules/access/actions"
);

function roleForm(overrides: Record<string, string | string[]> = {}) {
  const form = new FormData();
  form.set("name", "Surveillant");
  form.set("description", "Surveille la cour.");
  form.set("scope", "SCHOOL");
  form.append("permissions", PERMISSIONS.STUDENT_VIEW);

  for (const [key, value] of Object.entries(overrides)) {
    form.delete(key);
    if (Array.isArray(value)) for (const v of value) form.append(key, v);
    else form.set(key, value);
  }
  return form;
}

const IDLE = { status: "idle" as const };

beforeEach(() => {
  seedRoles();
  granted.clear();
  asked.length = 0;
});

// ── Authorization ────────────────────────────────────────────────────────────

describe("authorization", () => {
  it("asks for the org-wide code before reading anything", async () => {
    await createRoleAction(IDLE, roleForm());
    expect(asked).toEqual([PERMISSIONS.ROLE_CREATE]);

    asked.length = 0;
    await updateRoleAction(IDLE, roleForm({ id: "role-custom" }));
    expect(asked).toEqual([PERMISSIONS.ROLE_UPDATE]);

    asked.length = 0;
    await deleteRoleAction("role-custom");
    expect(asked).toEqual([PERMISSIONS.ROLE_DELETE]);
  });

  it("refuses, and writes nothing, without the permission", async () => {
    expect(await createRoleAction(IDLE, roleForm())).toMatchObject({
      status: "error",
      message: t.errors.forbidden,
    });
    expect(created).toEqual([]);

    expect(
      await updateRoleAction(IDLE, roleForm({ id: "role-custom" })),
    ).toMatchObject({ status: "error" });
    expect(updated).toEqual([]);

    expect(await deleteRoleAction("role-custom")).toMatchObject({
      status: "error",
    });
    expect(deleted).toEqual([]);
  });

  it("does not let ROLE_CREATE stand in for ROLE_UPDATE or ROLE_DELETE", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    expect(
      await updateRoleAction(IDLE, roleForm({ id: "role-custom" })),
    ).toMatchObject({ status: "error" });
    expect(await deleteRoleAction("role-custom")).toMatchObject({
      status: "error",
    });
    expect(updated).toEqual([]);
    expect(deleted).toEqual([]);
  });
});

// ── Tenancy ──────────────────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("cannot update another organisation's role, however genuine the id", async () => {
    granted.add(PERMISSIONS.ROLE_UPDATE);

    const result = await updateRoleAction(
      IDLE,
      roleForm({ id: "role-foreign" }),
    );

    expect(result).toMatchObject({ status: "error", message: t.errors.notFound });
    expect(updated).toEqual([]);
  });

  it("cannot delete another organisation's role", async () => {
    granted.add(PERMISSIONS.ROLE_DELETE);

    const result = await deleteRoleAction("role-foreign");

    expect(result).toMatchObject({ status: "error", message: t.errors.notFound });
    expect(deleted).toEqual([]);
    expect(roles.has("role-foreign")).toBe(true);
  });

  it("creates into the actor's own organisation, never one named in the form", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    await createRoleAction(
      IDLE,
      roleForm({ name: "Nouveau", organizationId: OTHER_ORG }),
    );

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      data: { organizationId: ORG },
    });
  });

  it("answers 'not found' rather than 'forbidden' for a foreign id", async () => {
    // The two must not be distinguishable, or the error message confirms that a
    // role with that id exists somewhere in the deployment.
    granted.add(PERMISSIONS.ROLE_UPDATE);

    const foreign = await updateRoleAction(
      IDLE,
      roleForm({ id: "role-foreign" }),
    );
    const absent = await updateRoleAction(
      IDLE,
      roleForm({ id: "role-does-not-exist" }),
    );

    expect(foreign.message).toBe(absent.message);
  });
});

// ── System roles ─────────────────────────────────────────────────────────────

describe("system roles", () => {
  it("keeps its name and scope when the form tries to change them", async () => {
    granted.add(PERMISSIONS.ROLE_UPDATE);

    await updateRoleAction(
      IDLE,
      roleForm({ id: "role-admin", name: "Pwned", scope: "SCHOOL" }),
    );

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      where: { id: "role-admin" },
      data: { name: "Administrateur", scope: "ORG" },
    });
  });

  it("still allows its permission set to be tuned", async () => {
    granted.add(PERMISSIONS.ROLE_UPDATE);

    const result = await updateRoleAction(
      IDLE,
      roleForm({
        id: "role-admin",
        permissions: [PERMISSIONS.STUDENT_VIEW, PERMISSIONS.CLASS_VIEW],
      }),
    );

    expect(result.status).toBe("success");
  });

  it("cannot be deleted", async () => {
    granted.add(PERMISSIONS.ROLE_DELETE);

    const result = await deleteRoleAction("role-admin");

    expect(result).toMatchObject({
      status: "error",
      message: t.role.cannotDeleteSystem,
    });
    expect(deleted).toEqual([]);
  });
});

// ── Roles somebody still holds ───────────────────────────────────────────────

describe("a role people still hold", () => {
  it("cannot be deleted, and says how many hold it", async () => {
    granted.add(PERMISSIONS.ROLE_DELETE);

    const result = await deleteRoleAction("role-held");

    expect(result.status).toBe("error");
    expect(result.message).toContain("7");
    expect(deleted).toEqual([]);
  });

  it("cannot be re-scoped", async () => {
    // Regression. `scope` decides where a role may be assigned at all — a
    // membership takes only a SCHOOL role, `User.orgRoleId` only an ORG one.
    // Flipping a role seven people hold left those rows pointing at a role that
    // no longer qualified, and the user form replaces memberships wholesale, so
    // the next unrelated save of any of those users dropped their membership
    // with a success message.
    granted.add(PERMISSIONS.ROLE_UPDATE);

    const result = await updateRoleAction(
      IDLE,
      roleForm({ id: "role-held", name: "Surveillant général", scope: "ORG" }),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("7");
    expect(updated).toEqual([]);
  });

  it("can still be renamed and have its permissions changed", async () => {
    granted.add(PERMISSIONS.ROLE_UPDATE);

    const result = await updateRoleAction(
      IDLE,
      roleForm({
        id: "role-held",
        name: "Surveillant en chef",
        scope: "SCHOOL",
        permissions: [PERMISSIONS.STUDENT_VIEW, PERMISSIONS.CLASS_VIEW],
      }),
    );

    expect(result.status).toBe("success");
    expect(updated).toHaveLength(1);
  });

  it("may be re-scoped once nobody holds it", async () => {
    granted.add(PERMISSIONS.ROLE_UPDATE);

    const result = await updateRoleAction(
      IDLE,
      roleForm({ id: "role-custom", name: "Surveillant", scope: "ORG" }),
    );

    expect(result.status).toBe("success");
    expect(updated[0]).toMatchObject({ data: { scope: "ORG" } });
  });
});

// ── Names and permissions ────────────────────────────────────────────────────

describe("validation and the permission set", () => {
  it("refuses a duplicate name inside the organisation", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    const result = await createRoleAction(
      IDLE,
      roleForm({ name: "Surveillant" }),
    );

    expect(result).toMatchObject({ status: "error", message: t.role.nameTaken });
    expect(created).toEqual([]);
  });

  it("allows a name another organisation already uses", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    const result = await createRoleAction(IDLE, roleForm({ name: "Étranger" }));

    expect(result.status).toBe("success");
  });

  it("refuses to rename a role onto another role's name", async () => {
    granted.add(PERMISSIONS.ROLE_UPDATE);

    const result = await updateRoleAction(
      IDLE,
      roleForm({ id: "role-custom", name: "Surveillant général" }),
    );

    expect(result).toMatchObject({ status: "error", message: t.role.nameTaken });
    expect(updated).toEqual([]);
  });

  it("lets a role keep its own name on save", async () => {
    granted.add(PERMISSIONS.ROLE_UPDATE);

    const result = await updateRoleAction(
      IDLE,
      roleForm({ id: "role-custom", name: "Surveillant" }),
    );

    expect(result.status).toBe("success");
  });

  it("drops codes outside the catalogue instead of storing them", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    await createRoleAction(
      IDLE,
      roleForm({
        name: "Nouveau",
        permissions: [PERMISSIONS.STUDENT_VIEW, "admin.everything", "*"],
      }),
    );

    expect(created[0]).toMatchObject({
      data: {
        permissions: {
          create: [{ permissionId: `perm-${PERMISSIONS.STUDENT_VIEW}` }],
        },
      },
    });
  });

  it("accepts a role with no permissions at all", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    const result = await createRoleAction(
      IDLE,
      roleForm({ name: "Sans droits", permissions: [] }),
    );

    expect(result.status).toBe("success");
    expect(created[0]).toMatchObject({
      data: { permissions: { create: [] } },
    });
  });

  it("never marks a role created through the form as a system role", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    await createRoleAction(IDLE, roleForm({ name: "Nouveau", isSystem: "on" }));

    expect(created[0]).toMatchObject({ data: { isSystem: false } });
  });

  it("rejects an unknown scope rather than defaulting it", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    const result = await createRoleAction(
      IDLE,
      roleForm({ name: "Nouveau", scope: "GLOBAL" }),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.["scope"]).toBeTruthy();
    expect(created).toEqual([]);
  });

  it("echoes the submission back so a rejected form redraws", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    const result = await createRoleAction(
      IDLE,
      roleForm({ name: "", description: "Surveille la cour." }),
    );

    expect(result.status).toBe("error");
    expect(result.values?.["description"]).toBe("Surveille la cour.");
  });

  it("can grant the whole catalogue in one submission", async () => {
    granted.add(PERMISSIONS.ROLE_CREATE);

    const result = await createRoleAction(
      IDLE,
      roleForm({ name: "Tout", permissions: [...ALL_PERMISSION_CODES] }),
    );

    expect(result.status).toBe("success");
    const data = (created[0] as { data: { permissions: { create: unknown[] } } })
      .data;
    expect(data.permissions.create).toHaveLength(ALL_PERMISSION_CODES.length);
  });
});
