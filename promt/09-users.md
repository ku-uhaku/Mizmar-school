# 09 — `users`

**Prereqs:** 07, 08.
**Tables:** `User`, `Profile`. **Routes:** `/users`, `/users/new`, `/users/[userId]`.

---

**`User`** — `organizationId` (Cascade), `email @unique`, `passwordHash`,
`isActive`, `isSuperAdmin`, `orgRoleId?` (→ `Role`, SetNull — set in prompt 10),
`currentSchoolId?` (→ `School`, **SetNull**), `currentSchoolYearId?` (→
`SchoolYear`, **SetNull**), `lastLoginAt?`, timestamps.

The two `current*` columns are the **context**: what school and year this user is
looking at right now. `SetNull` because deleting a school must not delete the
people who were looking at it. Comment that.

**`Profile`** — `userId @unique` (Cascade), `firstName`, `lastName`, `phone?`,
`avatarUrl?`, `jobTitle?`, `bio?`, `birthDate?`, plus the appearance columns:
`locale @default("fr")`, `themeMode @default("system")`, `accent @default("blue")`,
`fontFamily @default("geist")`, `fontSize @default("md")`, `radius @default("md")`.

One row per user, created in the same transaction as the user. Never lazily.

**Permissions:** `user.view|create|update|delete`, org-scoped.

**Nav:** `/users`, icon `users`, `administration`, order 20.

**Screens:**
- list — data-table with faceted filters on active / role / school
- create — identity, email, a generated or typed password, org role, and
  **memberships** (school + role rows). The membership rows are edited here even
  though `access` owns the table; note that in a comment and go through
  `access`'s service, not a raw `db` call.
- detail — same form, plus last login, plus deactivate/reactivate.

**Invariants:** you cannot deactivate or delete the last active user holding
`role.update` org-wide — that locks everyone out of the app permanently. Enforce
in `service.ts` with a clear translated error. You cannot change your own
`isSuperAdmin`. Password changes go through bcrypt cost 12 and never round-trip
the hash to the client.

**Gate:** create a user, sign in as them, confirm they see only what their role
allows. Then try to delete the last administrator and show me the refusal.
