import { describe, expect, it } from "vitest";

import { MOBILE_ONLY_ROLES, SYSTEM_ROLES } from "@/modules/access/system-roles";
import { hasWebAccess } from "@/modules/access/web-access";

/**
 * Who the web dashboard opens for.
 *
 * The rule is small and load-bearing: it is the only thing standing between a
 * teacher's account and the office's screens, and it has to hold without taking
 * a single permission away — the espace enseignant on the phone runs on the
 * very codes the Enseignant role keeps.
 */

const teacher = { role: { name: "Enseignant" } };
const secretary = { role: { name: "Secrétaire" } };

describe("mobile-only roles", () => {
  it("is exactly the roles marked mobileOnly, and holds the teacher", () => {
    expect(MOBILE_ONLY_ROLES).toContain("Enseignant");
    expect(MOBILE_ONLY_ROLES).toEqual(
      SYSTEM_ROLES.filter((role) => role.mobileOnly).map((role) => role.name),
    );
  });

  it("leaves the teacher's permissions alone — the phone runs on them", () => {
    const role = SYSTEM_ROLES.find((entry) => entry.name === "Enseignant");
    expect(role?.permissions).toContain("classroom.workspace");
    expect(role?.permissions).toContain("assessment.grade");
  });
});

describe("hasWebAccess", () => {
  it("refuses an account that only teaches", () => {
    expect(
      hasWebAccess({
        isSuperAdmin: false,
        orgRoleId: null,
        memberships: [teacher],
      }),
    ).toBe(false);
  });

  it("refuses one that teaches in several schools", () => {
    expect(
      hasWebAccess({
        isSuperAdmin: false,
        orgRoleId: null,
        memberships: [teacher, teacher],
      }),
    ).toBe(false);
  });

  it("admits a teacher who keeps a desk in another school", () => {
    expect(
      hasWebAccess({
        isSuperAdmin: false,
        orgRoleId: null,
        memberships: [teacher, secretary],
      }),
    ).toBe(true);
  });

  it("admits org-wide reach, however the account is seated", () => {
    expect(
      hasWebAccess({
        isSuperAdmin: false,
        orgRoleId: "role-1",
        memberships: [teacher],
      }),
    ).toBe(true);

    expect(
      hasWebAccess({
        isSuperAdmin: true,
        orgRoleId: null,
        memberships: [teacher],
      }),
    ).toBe(true);
  });

  it("leaves an account with no membership exactly as it was", () => {
    // A guardian's portal login. It already reaches nothing on the web, and
    // this rule is about roles that grant real work elsewhere.
    expect(
      hasWebAccess({ isSuperAdmin: false, orgRoleId: null, memberships: [] }),
    ).toBe(true);
  });
});
