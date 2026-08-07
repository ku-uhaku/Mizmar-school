# 01 — The module system

**Prereqs:** 00.
**Owns:** `lib/module.ts`, `lib/permissions.ts`, `lib/nav.ts`, `modules/registry.ts`.

---

Build the spine that every one of the ~30 modules plugs into. No domain tables
yet — this prompt is pure infrastructure and must compile with an empty registry.

**`lib/module.ts`** — pure data, importable from client components. No `db`, no
`server-only`, no React.

- `type NavIcon` — a string union of icon names. Start with
  `dashboard | organization | schools | schoolYears | users | roles |
  configuration | reports | audit | profile | appearance`. Every later module
  adds its own names here. Icons cross the server/client boundary as **names**,
  never as components.
- `const NAV_SECTIONS = ["main","vieScolaire","finance","rh","logistique",
  "enseignant","administration","account"] as const` and `type NavSection`.
- `type NavEntry = { href; icon: NavIcon; section: NavSection; labelKey: string;
  order: number; orgPermission?: PermissionCode; schoolPermission?: PermissionCode }`.
  Two separate optional permission fields, not one — an entry gated org-wide
  (editing roles) must never open for a school-scoped grant. Explain that in a
  comment.
- `type PermissionGroup = { group: string; codes: readonly string[] }`.
- `type AppModule = { id; schemaFolder?; nav?: NavEntry[]; permissions?: PermissionGroup[] }`.
- `defineModule<const T extends AppModule>(m: T): T` and
  `definePermissions<...>(codes)` — both identity functions whose only job is to
  preserve literal types so the catalogue below is a closed union.

**`modules/registry.ts`** — the one file that knows the module list.

- `MODULES` — an array of the imported manifests, empty for now.
- `PERMISSIONS` — the union of every module's codes, derived from `MODULES`, as
  a const object keyed by SCREAMING_CASE.

**`lib/permissions.ts`** — what the rest of the app imports.

- Re-export `PERMISSIONS`, `type PermissionCode` (the closed union),
  `ALL_PERMISSION_CODES`, `PERMISSION_GROUPS` (derived from `MODULES`).
- `isPermissionCode(v: string): v is PermissionCode`.
- Nothing else in the app may import `modules/registry.ts` directly. Say so in a
  comment on both files.

**`lib/nav.ts`** — turns `MODULES` into the sidebar.

- Takes the set of permissions the current user holds org-wide and the set they
  hold in the current school, returns sections → entries, sorted by `order`,
  dropping entries the user cannot see.
- **In development, throw** if a `NavEntry` names a permission that is not in the
  catalogue, or a `labelKey` that is not in the `nav` namespace of the
  dictionary. A typo must fail loudly on first render, not silently hide a link.

**`lib/action-state.ts`**

- `type ActionState = { status: "idle" | "success" | "error"; message?: string;
  fieldErrors?: Record<string,string> }`, plus `IDLE`, `success()`, `failure()`.
- `withActionErrors(fn)` — wraps an action body, returns `failure()` for expected
  problems and **rethrows genuine bugs**. Never swallow.

**`lib/db-keys.ts`** — the `scopeKey` helpers described in AGENTS.md. Start with
`nullableKey(...parts: (string | null | undefined)[]): string` joining with `|`
and mapping nullish to `-`. Every partial-uniqueness key in the app goes through
this, never through an inline template string.

**Gate:** `npm run typecheck && npm run lint && npm run build`. Then show me
`lib/module.ts` and explain in three sentences how a module gets into the
sidebar without any central file listing routes.
