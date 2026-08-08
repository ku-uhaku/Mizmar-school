import { describe, expect, it, beforeEach, vi } from "vitest";

import { ALL_PERMISSION_CODES, PERMISSIONS, isPermissionCode } from "@/lib/permissions";
import { ROLE_SCOPES } from "@/modules/access/enums";
import { SYSTEM_ROLES } from "@/modules/access/system-roles";
import { getDictionaryFor } from "@/lib/i18n/server";
import { roleSchema } from "@/modules/access/validation";

/**
 * The access module decides what every other module is allowed to do, so its
 * tests are less about the code than about the *claims* the code makes:
 *
 *   * that a role can never hold a permission the app does not check,
 *   * that the built-in roles keep the separations their comments describe —
 *     the secretary who takes money but cannot pay it out, the teacher who
 *     marks a paper but does not release it,
 *   * that a role's `scope` is load-bearing rather than decorative, since it is
 *     what stops a school-scoped role being granted organisation-wide.
 *
 * Those are the sentences somebody will one day "tidy up" by adding a code to a
 * list. Each one is pinned here with the reason attached.
 */

const t = getDictionaryFor("en");

const roleNamed = (name: string) => {
  const role = SYSTEM_ROLES.find((entry) => entry.name === name);
  if (!role) throw new Error(`No system role named ${name}`);
  return role;
};

// ── The built-in roles ───────────────────────────────────────────────────────

describe("system roles", () => {
  it("grant only codes the app actually checks", () => {
    for (const role of SYSTEM_ROLES) {
      for (const code of role.permissions) {
        expect(isPermissionCode(code), `${role.name} → ${code}`).toBe(true);
      }
    }
  });

  it("declare a scope the schema allows", () => {
    for (const role of SYSTEM_ROLES) {
      expect(ROLE_SCOPES).toContain(role.scope);
    }
  });

  it("have distinct names, since the org unique constraint is on the name", () => {
    const names = SYSTEM_ROLES.map((role) => role.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("list no permission twice", () => {
    for (const role of SYSTEM_ROLES) {
      const codes = role.permissions;
      expect(new Set(codes).size, role.name).toBe(codes.length);
    }
  });

  it("give the administrator the whole catalogue, so a new module is not silently omitted", () => {
    const admin = roleNamed("Administrateur");
    expect([...admin.permissions].sort()).toEqual(
      [...ALL_PERMISSION_CODES].sort(),
    );
  });

  it("keeps role editing to the administrator alone", () => {
    // Load-bearing, and the reason it is asserted rather than assumed: anyone
    // who can edit a role can grant themselves every code in the catalogue, so
    // `role.update` is transitively the whole catalogue. Handing it to a
    // narrower role would silently make that role an administrator.
    const editing = [
      PERMISSIONS.ROLE_CREATE,
      PERMISSIONS.ROLE_UPDATE,
      PERMISSIONS.ROLE_DELETE,
    ];

    for (const role of SYSTEM_ROLES) {
      if (role.name === "Administrateur") continue;
      for (const code of editing) {
        expect(role.permissions, `${role.name} must not hold ${code}`).not.toContain(
          code,
        );
      }
    }
  });

  it("keeps organisation-wide role assignment out of school-scoped roles", () => {
    // A SCHOOL-scoped role holding USER_ASSIGN_ROLE only ever assigns within a
    // school, because `resolveOrgRoleId` additionally requires the code
    // org-wide. This pins the school roles that do hold it, so the pairing is
    // deliberate rather than accidental.
    const holders = SYSTEM_ROLES.filter((role) =>
      role.permissions.includes(PERMISSIONS.USER_ASSIGN_ROLE),
    ).map((role) => `${role.name}/${role.scope}`);

    expect(holders).toEqual(["Administrateur/ORG", "Directeur d'école/SCHOOL"]);
  });

  describe("separation of duties", () => {
    it("lets the secretary take money but not pay it out, move it, or cancel a receipt", () => {
      const secretary = roleNamed("Secrétaire");
      expect(secretary.permissions).toContain(PERMISSIONS.TREASURY_COLLECT);
      expect(secretary.permissions).not.toContain(PERMISSIONS.TREASURY_DISBURSE);
      expect(secretary.permissions).not.toContain(PERMISSIONS.TREASURY_TRANSFER);
      expect(secretary.permissions).not.toContain(PERMISSIONS.TREASURY_CANCEL);
    });

    it("keeps payroll away from the desk", () => {
      expect(roleNamed("Secrétaire").permissions).not.toContain(
        PERMISSIONS.HR_PAYROLL,
      );
      expect(roleNamed("Responsable pédagogique").permissions).not.toContain(
        PERMISSIONS.HR_PAYROLL,
      );
    });

    it("keeps what a family is charged away from the desk", () => {
      expect(roleNamed("Secrétaire").permissions).not.toContain(
        PERMISSIONS.ENROLMENT_FEES,
      );
    });

    it("keeps recording a spend apart from agreeing to it", () => {
      for (const name of ["Secrétaire", "Chauffeur"]) {
        const role = roleNamed(name);
        expect(role.permissions, name).toContain(PERMISSIONS.TRANSPORT_FUEL);
        expect(role.permissions, name).not.toContain(
          PERMISSIONS.TRANSPORT_FUEL_APPROVE,
        );
      }
    });

    it("lets a teacher mark a paper but not plan or release the round", () => {
      const teacher = roleNamed("Enseignant");
      expect(teacher.permissions).toContain(PERMISSIONS.ASSESSMENT_GRADE);
      expect(teacher.permissions).not.toContain(PERMISSIONS.ASSESSMENT_MANAGE);
      expect(teacher.permissions).not.toContain(PERMISSIONS.ASSESSMENT_PUBLISH);
      expect(teacher.permissions).not.toContain(PERMISSIONS.ASSESSMENT_DELETE);
    });

    it("lets a teacher record an absence but not excuse it", () => {
      const teacher = roleNamed("Enseignant");
      expect(teacher.permissions).toContain(
        PERMISSIONS.CLASSROOM_ATTENDANCE_MARK,
      );
      expect(teacher.permissions).not.toContain(
        PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY,
      );
    });

    it("lets a teacher write a concern but not send it to the family", () => {
      const teacher = roleNamed("Enseignant");
      expect(teacher.permissions).toContain(PERMISSIONS.CLASSROOM_REMARK_WRITE);
      expect(teacher.permissions).not.toContain(
        PERMISSIONS.CLASSROOM_REMARK_PUBLISH,
      );
    });

    it("lets a teacher draft a supply list but not release it", () => {
      const teacher = roleNamed("Enseignant");
      expect(teacher.permissions).toContain(PERMISSIONS.SUPPLY_WRITE);
      expect(teacher.permissions).not.toContain(PERMISSIONS.SUPPLY_REVIEW);
    });

    it("keeps a teacher away from money and from dossiers familiaux", () => {
      const teacher = roleNamed("Enseignant");
      for (const code of ALL_PERMISSION_CODES) {
        if (code.startsWith("treasury.") || code.startsWith("family.")) {
          expect(teacher.permissions, code).not.toContain(code);
        }
      }
    });

    it("lets a driver drive the line but not draw it or seat a child on it", () => {
      const driver = roleNamed("Chauffeur");
      expect(driver.permissions).toContain(PERMISSIONS.TRANSPORT_ATTENDANCE);
      expect(driver.permissions).not.toContain(PERMISSIONS.TRANSPORT_MANAGE);
      expect(driver.permissions).not.toContain(PERMISSIONS.TRANSPORT_SUBSCRIBE);
      expect(driver.permissions).not.toContain(PERMISSIONS.TRANSPORT_DELETE);
    });

    it("gives the driver enough context to resolve their own runs", () => {
      // A driver with no membership resolves no school year, and so sees an
      // empty day rather than their circuit.
      const driver = roleNamed("Chauffeur");
      expect(driver.permissions).toContain(PERMISSIONS.SCHOOL_VIEW);
      expect(driver.permissions).toContain(PERMISSIONS.SCHOOL_YEAR_VIEW);
    });

    it("keeps the driver's reach to transport and its context", () => {
      const driver = roleNamed("Chauffeur");
      const allowedPrefixes = ["transport.", "school.", "schoolYear."];
      for (const code of driver.permissions) {
        expect(
          allowedPrefixes.some((prefix) => code.startsWith(prefix)),
          `Chauffeur should not reach ${code}`,
        ).toBe(true);
      }
    });

    it("keeps the head of studies out of marking and out of the ministry's records", () => {
      const lead = roleNamed("Responsable pédagogique");
      expect(lead.permissions).toContain(PERMISSIONS.ASSESSMENT_PUBLISH);
      expect(lead.permissions).not.toContain(PERMISSIONS.ASSESSMENT_GRADE);
      expect(lead.permissions).not.toContain(PERMISSIONS.MASSAR_IMPORT);
      expect(lead.permissions).not.toContain(PERMISSIONS.MASSAR_MAP);
    });

    it("keeps who-tried-to-sign-in to the administrator", () => {
      for (const role of SYSTEM_ROLES) {
        if (role.name === "Administrateur") continue;
        expect(role.permissions, role.name).not.toContain(
          PERMISSIONS.AUDIT_SECURITY,
        );
      }
    });

    it("gives no non-administrator role a code that deletes across the school", () => {
      // A sweep rather than a list, so a new `*.delete` code cannot be added to
      // a narrow role without this failing and somebody deciding on purpose.
      const allowedDeleters = new Map<string, string[]>([
        ["Administrateur", ALL_PERMISSION_CODES.filter((c) => c.endsWith(".delete"))],
        [
          "Directeur d'école",
          [
            PERMISSIONS.SCHOOL_YEAR_DELETE,
            PERMISSIONS.EVENT_DELETE,
            PERMISSIONS.FAMILY_DELETE,
            PERMISSIONS.STUDENT_DELETE,
            PERMISSIONS.ENROLMENT_DELETE,
            PERMISSIONS.ASSESSMENT_DELETE,
            PERMISSIONS.SUPPLY_DELETE,
            PERMISSIONS.HR_DELETE,
            PERMISSIONS.TRANSPORT_DELETE,
          ],
        ],
      ]);

      for (const role of SYSTEM_ROLES) {
        const deleters = role.permissions.filter((code) =>
          code.endsWith(".delete"),
        );
        expect([...deleters].sort(), role.name).toEqual(
          [...(allowedDeleters.get(role.name) ?? [])].sort(),
        );
      }
    });
  });
});

// ── Mapping submitted codes onto the catalogue ───────────────────────────────

const permissionRows = new Map<string, string>(
  ALL_PERMISSION_CODES.map((code) => [code, `perm-${code}`]),
);

vi.mock("@/lib/db", () => ({
  db: {
    permission: {
      findMany: async ({
        where,
      }: {
        where: { code: { in: string[] } };
      }) =>
        where.code.in
          .filter((code) => permissionRows.has(code))
          .map((code) => ({ id: permissionRows.get(code) })),
    },
  },
}));

const { resolvePermissionIds } = await import("@/modules/access/queries");

describe("resolvePermissionIds", () => {
  it("maps known codes to their ids", async () => {
    const ids = await resolvePermissionIds([
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.CLASS_VIEW,
    ]);
    expect(ids).toEqual([
      permissionRows.get(PERMISSIONS.STUDENT_VIEW),
      permissionRows.get(PERMISSIONS.CLASS_VIEW),
    ]);
  });

  it("drops anything outside the catalogue, so a role cannot hold an unchecked code", async () => {
    // The form posts a plain string array — this is the only gate between a
    // crafted POST and a `role_permissions` row for a code nothing checks.
    const ids = await resolvePermissionIds([
      PERMISSIONS.STUDENT_VIEW,
      "student.*",
      "admin.everything",
      "__proto__",
      "constructor",
      "",
      "TREASURY_DISBURSE",
    ]);
    expect(ids).toEqual([permissionRows.get(PERMISSIONS.STUDENT_VIEW)]);
  });

  it("answers empty for an empty or wholly invalid submission", async () => {
    expect(await resolvePermissionIds([])).toEqual([]);
    expect(await resolvePermissionIds(["nope", "also-nope"])).toEqual([]);
  });

  it("does not hit the database when nothing survives the filter", async () => {
    // Cheap, but it is also what keeps a POST of ten thousand junk codes from
    // becoming a ten-thousand-item `IN` clause.
    const { db } = (await import("@/lib/db")) as unknown as {
      db: { permission: { findMany: (args: unknown) => Promise<unknown> } };
    };
    const spy = vi.spyOn(db.permission, "findMany");
    await resolvePermissionIds(Array.from({ length: 1000 }, (_, i) => `junk-${i}`));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ── The role form's schema ───────────────────────────────────────────────────

describe("roleSchema", () => {
  const valid = {
    name: "Surveillant",
    description: "Surveille la cour.",
    scope: "SCHOOL",
    permissions: [PERMISSIONS.STUDENT_VIEW],
  };

  it("accepts a well-formed role", () => {
    const parsed = roleSchema(t).safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("requires a name", () => {
    expect(roleSchema(t).safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(roleSchema(t).safeParse({ ...valid, name: "   " }).success).toBe(
      false,
    );
  });

  it("caps the name at 80 characters", () => {
    expect(
      roleSchema(t).safeParse({ ...valid, name: "a".repeat(80) }).success,
    ).toBe(true);
    expect(
      roleSchema(t).safeParse({ ...valid, name: "a".repeat(81) }).success,
    ).toBe(false);
  });

  it("accepts only the two scopes the schema knows", () => {
    for (const scope of ROLE_SCOPES) {
      expect(roleSchema(t).safeParse({ ...valid, scope }).success, scope).toBe(
        true,
      );
    }
    for (const scope of ["ORGANISATION", "org", "GLOBAL", ""]) {
      expect(
        roleSchema(t).safeParse({ ...valid, scope }).success,
        scope,
      ).toBe(false);
    }
  });

  it("normalises an empty description to null rather than an empty string", () => {
    const parsed = roleSchema(t).safeParse({ ...valid, description: "  " });
    expect(parsed.success && parsed.data.description).toBeNull();
  });

  it("takes permissions as bare strings, leaving the catalogue check to the action", () => {
    const parsed = roleSchema(t).safeParse({
      ...valid,
      permissions: ["anything", "at", "all"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a permissions value that is not an array", () => {
    expect(
      roleSchema(t).safeParse({ ...valid, permissions: "student.view" }).success,
    ).toBe(false);
  });
});

// ── Dictionary coverage ──────────────────────────────────────────────────────

describe("permission labels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("names every code in the catalogue, in every language", async () => {
    // A missing label renders as a blank row in the permission matrix, which
    // reads as "this grants nothing" — the worst possible way to be wrong about
    // a permission.
    for (const locale of ["en", "fr", "ar"] as const) {
      const dictionary = getDictionaryFor(locale);
      const codes = dictionary.permissions.codes as Record<string, string>;
      for (const code of ALL_PERMISSION_CODES) {
        expect(codes[code], `${locale} is missing ${code}`).toBeTruthy();
      }
    }
  });

  it("names every permission group, in every language", () => {
    for (const locale of ["en", "fr", "ar"] as const) {
      const dictionary = getDictionaryFor(locale);
      const groups = dictionary.permissions.groups as Record<string, string>;
      const groupKeys = new Set(
        ALL_PERMISSION_CODES.map((code) => code.split(".")[0]),
      );
      for (const key of groupKeys) {
        expect(groups[key], `${locale} is missing group ${key}`).toBeTruthy();
      }
    }
  });
});
