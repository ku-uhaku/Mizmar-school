/**
 * Roles, permissions and memberships translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  role: {
    title: "Rôles et permissions",
    subtitle: "Définissez ce que chaque type d'utilisateur peut faire.",
    newRole: "Nouveau rôle",
    editRole: "Modifier le rôle",
    createRole: "Créer le rôle",
    name: "Nom",
    description: "Description",
    scope: "Portée",
    scopeHint: "Les rôles d'organisation s'appliquent partout ; les rôles d'école uniquement là où ils sont attribués.",
    permissions: "Permissions",
    permissionsDescription: "Cochez tout ce que ce rôle est autorisé à faire.",
    permissionsSelected: "{count} sur {total} accordées",
    systemRole: "Rôle système",
    systemRoleHint: "Rôle intégré — ses permissions sont modifiables, mais il ne peut être renommé ni supprimé.",
    usedBy: "Attribué à",
    usedByCount: "{count} utilisateurs",
    created: "Rôle créé.",
    updated: "Rôle mis à jour.",
    deleted: "Rôle supprimé.",
    deleteTitle: "Supprimer ce rôle ?",
    deleteBody: "« {name} » sera supprimé.",
    nameTaken: "Un rôle portant ce nom existe déjà.",
    inUse: "Ce rôle est encore attribué à {count} utilisateurs. Réaffectez-les d'abord.",
    cannotDeleteSystem: "Les rôles système ne peuvent pas être supprimés.",
    noRoles: "Aucun rôle pour le moment.",
    selectAll: "Tout sélectionner",
    clearAll: "Tout décocher",
    scopes: {
      ORG: "Organisation",
      SCHOOL: "École",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  roles: "Rôles et permissions",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    role: "Rôles",
  },
  codes: {
    "role.view": "Consulter les rôles",
    "role.create": "Créer des rôles",
    "role.update": "Modifier les rôles",
    "role.delete": "Supprimer des rôles",
  },
};

export default fr;
