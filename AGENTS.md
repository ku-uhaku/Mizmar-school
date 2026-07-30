<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architecture

This app is **module-first**, not layer-first. It is built to carry 80+ tables,
so the organising rule is:

> Everything belonging to one domain lives in one folder. Nothing grows without
> bound. Adding a table touches its own module and nothing else.

There is no `app/actions/`, no central `lib/enums.ts`, no central
`lib/validation/schemas.ts`, and no 3,000-line dictionary. If you find yourself
appending to a shared list, you are probably in the wrong file — check
"Registration points" below, which names the only four that exist.

```
modules/<module>/          one bounded domain — owns its tables and its UI
  module.ts                manifest: nav entries, permission groups  (pure data)
  permissions.ts           its permission codes                      (pure data)
  enums.ts                 allowed values for its enum-like columns  (pure data)
  validation.ts            zod schema factories                      (isomorphic)
  queries.ts               server-only reads, permission-scoped
  service.ts               server-only writes and data invariants
  actions.ts               "use server" entry points
  i18n/{en,fr,ar}.ts       its translations                          (pure data)
  components/*.tsx         its screens and forms
  registry.ts              ← the module registry (at modules/ root)

prisma/schema/             the schema is a FOLDER, one subfolder per module
  datasource.prisma        generator + datasource only, no models
  <module>/<table>.prisma  one file per table

app/                       routes only — thin. No queries, no business logic.
lib/                       infrastructure shared by every module
components/{ui,form,data-table,charts,shell,shared,providers}/
                           the design system and app shell — domain-free
```

Not every module needs every file. Create a file when it has something to hold:
`auth` and `context` own no tables, so they have no `enums.ts`; `organization`
has no write invariants, so it has no `service.ts`.

## Module inventory

| Module | Tables it owns (`prisma/schema/…`) | Routes |
| --- | --- | --- |
| `dashboard` | — | `/` |
| `organization` | `Organization` | `/organization` |
| `schools` | `School` | `/schools`, `/schools/[schoolId]`, `/schools/new` |
| `school-years` | `SchoolYear` | `/school-years` |
| `users` | `User`, `Profile` | `/users`, `/users/[userId]`, `/users/new` |
| `access` | `Role`, `Permission`, `RolePermission`, `Membership` | `/roles`, `/roles/[roleId]`, `/roles/new` |
| `profile` | — (writes own `Profile` row) | `/profile` |
| `appearance` | — (writes own `Profile` row) | `/appearance` |
| `auth` | — (reads `User`) | `/login` |
| `context` | — (writes own `User` row) | — (header) |

Owning a table means owning its schema file, its enums and its write
invariants. Other modules may **read** it through the owner's `queries.ts`.

# Database

## The schema is a folder

`prisma.config.ts` points `schema` at `prisma/schema`, which Prisma searches
recursively for `*.prisma`. Never recreate a single `schema.prisma`.

- One file per table: `prisma/schema/<module>/<table-name>.prisma`, kebab-case,
  named after the model (`school-year.prisma` for `SchoolYear`).
- `datasource.prisma` holds the `generator` and `datasource` blocks and nothing
  else. Do not add models to it.
- Models are global to the schema regardless of file, so relations across
  modules need no imports — just reference the model by name.
- A new module that owns tables gets a new `prisma/schema/<module>/` folder and
  declares `schemaFolder: "<module>"` in its manifest.

## Conventions every table follows

- `id String @id @default(cuid())`, `createdAt`, `updatedAt`.
- `@@map("snake_case_plural")` on every model. Table names are snake_case; model
  names are PascalCase singular.
- Index every foreign key (`@@index([schoolId])`). SQLite does not do it for you.
- Choose `onDelete` deliberately, and say why when it is not obvious: `Cascade`
  for owned children, `SetNull` for soft references such as
  `User.currentSchoolId`, `Restrict` where deleting would lose meaning
  (`Membership.roleId`).
- Scope rows to the tenant. Anything reachable from a request carries
  `organizationId`, or is reachable from a row that does.
- Use `///` doc comments for anything a reader would otherwise have to guess.

## Enum-like columns

SQLite has no native enum type. Every "enum" column is a `String` whose allowed
values live in the owning module's `enums.ts` as an `as const` array plus a
derived type. Three things must move together:

1. the array in `modules/<module>/enums.ts`,
2. the `///` comment on the column pointing at that file,
3. the labels in `modules/<module>/i18n/{en,fr,ar}.ts`.

## Migrations

```bash
npm run db:migrate      # prisma migrate dev — after any schema change
npm run db:generate     # regenerate the client into lib/generated/prisma
npm run db:seed         # idempotent, safe to re-run
npm run db:studio
```

`prisma migrate dev` prompts before adding a unique constraint, which fails in a
non-interactive shell. The CI-friendly path is to generate the SQL, read it, then
apply:

```bash
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema prisma/schema --script > prisma/migrations/<stamp>_<name>/migration.sql
npx prisma migrate deploy
```

Never hand-edit a file in `prisma/migrations/`. After reorganising schema files
without intending a schema change, prove it:

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema
# → "No difference detected."
```

`lib/generated/prisma/` is generated output. Never edit it.

**`lib/db.ts` caches the client on `globalThis` in development.** A dev server
started before a `prisma generate` keeps the old client, and every new model
reads as `undefined` ("Cannot read properties of undefined"). Restart
`npm run dev` after adding tables.

## Seeding

`prisma/seed.ts` is only an orchestrator: it decides the order and passes ids
along. **Each module seeds its own tables** in `modules/<module>/seed.ts`, so a
new module means a new seed file and one call, never another few hundred lines in
a shared script. The client and the shared `SeedContext` live in
`prisma/seed/client.ts`; `@/` aliases resolve under `tsx`.

- Seeds must be **idempotent** — upsert on the table's unique constraint, never
  `create`. Re-running is the normal case and must change nothing.
- Seeds **never delete**. A school you added by hand survives a re-seed; use
  `npm run db:reset` for a clean slate.
- Set derived columns (`scopeKey`, `bookingKey`) through their helpers, exactly
  as an action would — the seed is bound by the same invariants as the app.
- Prove a change with counts before and after, and re-run once to prove
  idempotency.

# Layering

Imports may only point **inward**. Enforced by review, not by tooling:

```
app/  →  modules/  →  lib/  →  (nothing app-specific)
                  ↘  components/{ui,form,…}
```

- **`app/` is thin.** A page authorizes, calls a module's `queries.ts`, and
  renders. No `db` import, no `where` clause, no business rule in a page. If a
  page grows a query, move it into the module's `queries.ts`.
- **`lib/` never imports a module's `queries.ts`, `service.ts` or `actions.ts`.**
  It may import `module.ts`, `permissions.ts` and `i18n/*` — those are pure
  data. This is what keeps `lib/permissions.ts` and `lib/nav.ts` usable from
  client components.
- **`components/` is domain-free.** Anything that knows about schools, roles or
  users belongs in `modules/<module>/components/`.
- **Cross-module reads go through the owner's `queries.ts`**, never a raw `db`
  call against another module's table. `modules/dashboard/queries.ts` is the
  reference: it composes each module's own count instead of re-deriving scoping.
- **`module.ts`, `permissions.ts`, `enums.ts` and `i18n/*` stay pure data** — no
  `server-only`, no `db`, no React. They cross the server/client boundary.

## Server-only vs client

- `queries.ts`, `service.ts` and anything touching `db` start with
  `import "server-only"`.
- `actions.ts` starts with `"use server"` and may export **only** async
  functions.
- Never re-export server actions through a barrel / `index.ts`.
- Icons cross the boundary as *names*, not components — see `NavIcon` in
  `lib/module.ts` and the mapping in `components/shell/nav-icon.tsx`.

# Security

These rules are load-bearing. The JWT holds only a user id; every authorization
decision is re-made from the database on every request (`lib/dal.ts`), so
revoking access takes effect immediately instead of when a token expires.

- **Authorize inside the action, not the page.** Server Functions are reachable
  by direct POST — a check on the page that renders the form protects nothing.
  Use `authorizeOrg`, `authorizeSchool`, `authorizeAnyScope` or `requireAuth`
  from `lib/dal.ts` as the first thing the action body does.
- **Pick the right scope.** Org-wide (`canOrg`) for anything whose effect spans
  schools — creating a school, editing roles. School-scoped (`canInSchool`) for
  what a director may do only in their own school.
- **Never trust an id from the request.** Re-derive what the user may reach from
  the session and scope the write by it (`where: { id, organizationId }`), so a
  crafted id cannot reach another tenant's row.
- **Reads scope themselves.** A module's `queries.ts` takes the `AuthContext` and
  builds its own `where`. The list and the detail screen must agree — that is the
  point of putting it in one function.
- Return expected failures as `ActionState` values (`failure(...)`) so
  `useActionState` can render them; let genuine bugs throw. Wrap action bodies in
  `withActionErrors`.
- Prefer `notFound()` over a forbidden state when revealing existence is itself a
  leak (see `findUser`).
- `proxy.ts` is an optimistic cookie check only. It is never a real gate.

# i18n

Three languages: `fr` (default), `en`, `ar` (RTL). English is canonical — the
`Dictionary` type is derived from it, so **a key added to `en` is a compile error
until `fr` and `ar` supply it**. That guarantee is tested; do not weaken it.

- Module strings live in `modules/<module>/i18n/{en,fr,ar}.ts` under a namespace
  the module owns (`school`, `schoolYear`, …). Core strings — `common`,
  `validation`, `errors` and the sidebar section titles — live in
  `lib/i18n/core/`.
- Two namespaces are **merged** across modules rather than owned by one: `nav`
  (via the `nav` named export) and `permissions` (via the `permissions` named
  export, holding `groups` and `codes`). Everything else is a plain namespace, so
  a clash between two modules is a type error in the dictionary file.
- Never hardcode user-facing text. Server code reads `await getDictionary()`;
  client components use `useT()`.
- Use `interpolate(t.x.y, { count })` for `{placeholder}` slots, and the helpers
  in `lib/i18n/format.ts` for dates and numbers — never `toLocaleString` directly.
- Keep RTL working: logical CSS properties only (`ms-*`/`me-*`/`ps-*`/`pe-*`,
  `text-start`/`text-end`), never `ml-*`/`pl-*`/`text-left`.

# Permissions

Codes are `<group>.<action>`, declared per module and aggregated into a closed
union. Nothing outside the catalogue can be granted, so role editing cannot
invent a permission the code never checks.

Adding one:

1. Add it to `modules/<module>/permissions.ts` via `definePermissions`. Keys are
   SCREAMING_CASE and globally unique — prefix with the module's domain.
2. Make sure the module's `module.ts` lists its group in `permissions`.
3. Add the label to `permissions.codes` in all three `i18n` files.
4. Grant it where appropriate in `modules/access/system-roles.ts`.
   (`Administrateur` gets the whole catalogue automatically.)
5. `npm run db:seed` to upsert it into the `Permission` table.

Import `PERMISSIONS` from `lib/permissions.ts`, never from `modules/registry.ts`.

# Registration points

Four files, and no others, know the list of modules. If a change makes you edit a
fifth central list, reconsider the design.

1. **`modules/registry.ts`** — `MODULES` (drives nav and the permission matrix)
   and `PERMISSIONS` (the typed catalogue).
2. **`lib/i18n/dictionaries/en.ts`**, **`fr.ts`**, **`ar.ts`** — import and spread
   the module's translations.

`lib/permissions.ts`, `lib/nav.ts` and `prisma/seed.ts` derive from the registry
and need no edit when a module is added.

# Adding a module — checklist

```
1.  mkdir modules/<id>/{components,i18n}
2.  prisma/schema/<id>/<table>.prisma       for each table it owns
3.  npm run db:migrate                      name the migration meaningfully
4.  modules/<id>/enums.ts                   if it has enum-like columns
5.  modules/<id>/permissions.ts             definePermissions({...})
6.  modules/<id>/module.ts                  defineModule({ id, schemaFolder, nav, permissions })
7.  modules/<id>/i18n/{en,fr,ar}.ts         default export + nav/permissions named exports
8.  modules/<id>/validation.ts              zod factories taking the Dictionary
9.  modules/<id>/queries.ts                 server-only, AuthContext-scoped reads
10. modules/<id>/service.ts                 only if it has write invariants
11. modules/<id>/actions.ts                 "use server", authorize first
12. modules/<id>/components/*.tsx
13. app/(dashboard)/<route>/page.tsx        thin: authorize → query → render
14. REGISTER: modules/registry.ts + the three dictionary files
15. Add the icon name to NavIcon (lib/module.ts) + components/shell/nav-icon.tsx
16. modules/access/system-roles.ts          grant the new permissions
17. npm run db:seed
```

# Verifying

Run all of these before calling a change done:

```bash
npm run typecheck     # next typegen && tsc --noEmit
npm run lint          # one pre-existing warning in components/data-table
npm run build
npx prisma validate
```

A green typecheck is meaningful here: it covers missing translations, unknown
codes in `PERMISSIONS.*`, and bad `NavIcon` / `section` values. A nav entry
pointing at a permission that does not exist throws on first render in
development (`lib/nav.ts`) rather than silently hiding the link.

# House style

Match the surrounding code. It is deliberate and consistent.

- Comments explain **why**, never what. Load-bearing decisions (a security scope,
  a `Restrict`, a cookie mirror, an invariant SQLite cannot express) get a
  sentence. Obvious code gets none.
- British spelling in English copy ("organisation"), matching the dictionary.
  Product-facing role names stay French — they are data, not translation keys.
- `type` over `interface`. Named exports over default (dictionaries and pages
  excepted). Explicit return types on exported functions.
- Derive, never duplicate: age from `birthDate`, the permission catalogue from
  the registry, DTO shaping in `queries.ts` so list and detail cannot drift.
