/**
 * Roles, permissions and memberships translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  role: {
    title: "Roles & permissions",
    subtitle: "Define what each kind of user is allowed to do.",
    newRole: "New role",
    editRole: "Edit role",
    createRole: "Create role",
    name: "Name",
    description: "Description",
    scope: "Scope",
    scopeHint: "Organisation roles apply everywhere; school roles apply only where assigned.",
    permissions: "Permissions",
    permissionsDescription: "Tick everything this role is allowed to do.",
    permissionsSelected: "{count} of {total} granted",
    systemRole: "System role",
    systemRoleHint: "Built-in role — permissions can be tuned, but it cannot be renamed or deleted.",
    usedBy: "Assigned to",
    usedByCount: "{count} users",
    created: "Role created.",
    updated: "Role updated.",
    deleted: "Role deleted.",
    deleteTitle: "Delete this role?",
    deleteBody: "“{name}” will be removed.",
    nameTaken: "A role with that name already exists.",
    inUse: "This role is still assigned to {count} users. Reassign them first.",
    cannotDeleteSystem: "System roles cannot be deleted.",
    noRoles: "No roles yet.",
    selectAll: "Select all",
    clearAll: "Clear all",
    scopes: {
      ORG: "Organisation",
      SCHOOL: "School",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  roles: "Roles & permissions",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    role: "Roles",
  },
  codes: {
    "role.view": "View roles",
    "role.create": "Create roles",
    "role.update": "Update roles",
    "role.delete": "Delete roles",
  },
} as const;

export default en;
