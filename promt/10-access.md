# 10 — `access`

**Prereqs:** 09.
**Tables:** `Role`, `Permission`, `RolePermission`, `Membership`.
**Routes:** `/roles`, `/roles/new`, `/roles/[roleId]`.

---

Who may do what. The catalogue from prompt 01 becomes rows here.

**`Permission`** — `code @unique`, `group`, `description?`. **Seeded from
`ALL_PERMISSION_CODES`, never typed by a human.** Re-seeding after adding a
module upserts the new codes and leaves grants intact.

**`Role`** — `organizationId` (Cascade), `name`, `description?`,
`scope String @default("SCHOOL")` (`ORG | SCHOOL`), `isSystem Boolean`.
`@@unique([organizationId, name])`.

**`RolePermission`** — `@@id([roleId, permissionId])`, both Cascade.

**`Membership`** — `userId` (Cascade), `schoolId` (Cascade), `roleId`
(**Restrict** — deleting a role that people hold must fail, not silently strip
their access). `@@unique([userId, schoolId])`: one role per user per school.

**Role scope is not decoration.** An `ORG` role grants org-wide (via
`User.orgRoleId`); a `SCHOOL` role grants inside one school (via `Membership`).
`lib/dal.ts` already reads both — make sure the shapes line up.

**`modules/access/system-roles.ts`** — the roles every organisation starts with,
as data: `Administrateur` (the whole catalogue, automatically, derived — never a
hand-written list), `Directeur`, `Secrétaire`, `Caissier`, `Enseignant`,
`Chauffeur`. Product-facing names stay French; they are data, not translation
keys. Each later prompt adds its new codes to the appropriate roles here.

**Permissions:** `role.view|create|update|delete`, org-scoped only.

**Screens:** role list; role editor using the `transfer-list` component, grouped
by permission group with the group labels from the merged `permissions`
namespace. `isSystem` roles are visible but not deletable, and `Administrateur`'s
permission set is not editable.

**Invariants:** a role cannot be deleted while any `Membership` or `User.orgRoleId`
points at it — catch the `Restrict` and return a translated `failure()` naming
how many users hold it. Only codes in the catalogue can be granted; reject
anything else server-side even though the UI cannot produce it.

**Gate:** seed the permissions, create a Caissier role, assign it, sign in as
that user, confirm the sidebar shows only what they hold. Then revoke a
permission while they are signed in and confirm the **next request** already
reflects it — that is the point of re-deriving from the database.
