import { ALL_PERMISSION_CODES, PERMISSIONS, type PermissionCode } from "@/lib/permissions";

/**
 * The roles created for a fresh organisation, upserted by `prisma/seed.ts`.
 *
 * `isSystem` roles can have their permissions tuned in the UI but cannot be
 * renamed or deleted, so the org always keeps a usable set of access levels.
 * Re-running the seed resets them to exactly what is declared here, which is
 * how drift in the built-in roles gets repaired.
 *
 * Names are the French labels an administrator sees; they are data, not
 * translation keys, because an org may rename its own non-system roles freely.
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
    // Deliberately the whole catalogue: a new module's permissions are granted
    // to the administrator role on the next seed rather than silently omitted.
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
