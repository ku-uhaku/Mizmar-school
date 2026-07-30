/**
 * The fixed permission catalogue. `prisma/seed.ts` upserts these into the
 * Permission table, and the roles UI renders the matrix from PERMISSION_GROUPS.
 *
 * Codes are `<group>.<action>`. Anything not listed here simply cannot be
 * granted, which keeps role editing from inventing permissions the code never
 * checks.
 */

export const PERMISSIONS = {
  ORGANIZATION_VIEW: "organization.view",
  ORGANIZATION_UPDATE: "organization.update",

  SCHOOL_VIEW: "school.view",
  SCHOOL_CREATE: "school.create",
  SCHOOL_UPDATE: "school.update",
  SCHOOL_DELETE: "school.delete",

  SCHOOL_YEAR_VIEW: "schoolYear.view",
  SCHOOL_YEAR_CREATE: "schoolYear.create",
  SCHOOL_YEAR_UPDATE: "schoolYear.update",
  SCHOOL_YEAR_DELETE: "schoolYear.delete",

  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  /// Assign / revoke a user's school-scoped roles.
  USER_ASSIGN_ROLE: "user.assignRole",

  ROLE_VIEW: "role.view",
  ROLE_CREATE: "role.create",
  ROLE_UPDATE: "role.update",
  ROLE_DELETE: "role.delete",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_CODES = Object.values(
  PERMISSIONS,
) as PermissionCode[];

/** Drives both the seed and the layout of the permission matrix UI. */
export const PERMISSION_GROUPS: {
  group: string;
  codes: PermissionCode[];
}[] = [
  {
    group: "organization",
    codes: [PERMISSIONS.ORGANIZATION_VIEW, PERMISSIONS.ORGANIZATION_UPDATE],
  },
  {
    group: "school",
    codes: [
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_CREATE,
      PERMISSIONS.SCHOOL_UPDATE,
      PERMISSIONS.SCHOOL_DELETE,
    ],
  },
  {
    group: "schoolYear",
    codes: [
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      PERMISSIONS.SCHOOL_YEAR_CREATE,
      PERMISSIONS.SCHOOL_YEAR_UPDATE,
      PERMISSIONS.SCHOOL_YEAR_DELETE,
    ],
  },
  {
    group: "user",
    codes: [
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.USER_ASSIGN_ROLE,
    ],
  },
  {
    group: "role",
    codes: [
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.ROLE_CREATE,
      PERMISSIONS.ROLE_UPDATE,
      PERMISSIONS.ROLE_DELETE,
    ],
  },
];

/**
 * Roles created for a fresh organisation. `isSystem` roles can have their
 * permissions tuned but cannot be renamed or deleted.
 */
export const SYSTEM_ROLES: {
  name: string;
  description: string;
  scope: "ORG" | "SCHOOL";
  permissions: PermissionCode[];
}[] = [
  {
    name: "Administrateur",
    description:
      "Accès complet à l'organisation, aux écoles, aux utilisateurs et aux rôles.",
    scope: "ORG",
    permissions: ALL_PERMISSION_CODES,
  },
  {
    name: "Responsable pédagogique",
    description:
      "Consulte l'organisation et gère les écoles et les années scolaires.",
    scope: "ORG",
    permissions: [
      PERMISSIONS.ORGANIZATION_VIEW,
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_UPDATE,
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      PERMISSIONS.SCHOOL_YEAR_CREATE,
      PERMISSIONS.SCHOOL_YEAR_UPDATE,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.ROLE_VIEW,
    ],
  },
  {
    name: "Directeur d'école",
    description:
      "Gère son école : années scolaires, utilisateurs et affectations.",
    scope: "SCHOOL",
    permissions: [
      PERMISSIONS.ORGANIZATION_VIEW,
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_UPDATE,
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      PERMISSIONS.SCHOOL_YEAR_CREATE,
      PERMISSIONS.SCHOOL_YEAR_UPDATE,
      PERMISSIONS.SCHOOL_YEAR_DELETE,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_ASSIGN_ROLE,
      PERMISSIONS.ROLE_VIEW,
    ],
  },
  {
    name: "Secrétaire",
    description: "Consulte et met à jour les données courantes de son école.",
    scope: "SCHOOL",
    permissions: [
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      PERMISSIONS.USER_VIEW,
    ],
  },
  {
    name: "Enseignant",
    description: "Accès en lecture seule à son école.",
    scope: "SCHOOL",
    permissions: [PERMISSIONS.SCHOOL_VIEW, PERMISSIONS.SCHOOL_YEAR_VIEW],
  },
];
