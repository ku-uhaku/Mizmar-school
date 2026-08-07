# This is NOT the Next.js you know

This project runs a Next.js version with breaking changes from your training
data — APIs, conventions and file structure may all differ. **Read the relevant
guide in `node_modules/next/dist/docs/` before writing any code.** Heed
deprecation notices. The same applies to Prisma 7: read
`node_modules/prisma/` docs before touching the schema or the client.

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
  enums.ts                 option lists derived from its Prisma enums(pure data)
  validation.ts            zod schema factories                      (isomorphic)
  queries.ts               server-only reads, permission-scoped
  service.ts               server-only writes and data invariants
  actions.ts               "use server" entry points
  i18n/{en,fr,ar}.ts       its translations                          (pure data)
  components/*.tsx         its screens and forms
  seed.ts                  seeds its own tables, idempotent
  registry.ts              ← the module registry (at modules/ root)

prisma/schema/             the schema is a FOLDER, one subfolder per module
  datasource.prisma        generator + datasource only, no models
  <module>/<table>.prisma  one file per table

app/                       routes only — thin. No queries, no business logic.
lib/                       infrastructure shared by every module
components/{ui,form,data-table,charts,shell,shared,print,providers}/
                           the design system and app shell — domain-free
```

Not every module needs every file. Create a file when it has something to hold:
`auth` and `context` own no tables, so they have no `enums.ts`; `organization`
has no write invariants, so it has no `service.ts`.

## The split every domain follows

Identity and the year are deliberately separate:

* **`Student`** is who a child *is* — name, birth date, dossier familial. It
  outlives every year and is never enough to say where the child sits.
* **`Enrollment`** is what is true of them *in one year* — the level admitted
  to, the class and group seated in, and the whole year's fee schedule
  (`EnrollmentFee`, one row per charge per instalment, written at enrolment).

A child who repeats has two enrolments and one student row, and last year's
class list keeps resolving after this year's is drawn up. Anything that happens
*to a pupil in a year* (attendance, grades, remarks, bus subscription) hangs off
`Enrollment`, never off `Student`.

`Student.status` is **derived** from the enrolments — only `refreshStudentStatus`
writes it, and no form ever submits it. Apply that pattern everywhere: derived
columns have exactly one writer.

# Database (PostgreSQL)

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
- Index every foreign key (`@@index([schoolId])`).
- Choose `onDelete` deliberately, and say why when it is not obvious: `Cascade`
  for owned children, `SetNull` for soft references such as
  `User.currentSchoolId`, `Restrict` where deleting would lose meaning
  (`Membership.roleId`, `PaymentAllocation.enrollmentFeeId`).
- Scope rows to the tenant. Anything reachable from a request carries
  `organizationId`, or is reachable from a row that does.
- Use `///` doc comments for anything a reader would otherwise have to guess.
- **Money is `Int` centimes.** Never `Float`, never `Decimal` in the UI path.
  Percentages are basis points (`Int`, `percentBps`). Litres are tenths.
  A column holding money ends in `Centimes`; a rate ends in `Bps`.

## Enums

Use **native Prisma enums** — this is Postgres. Declare the enum in the owning
module's schema folder, next to the table that first uses it. Three things move
together:

1. the `enum` block in `prisma/schema/<module>/`,
2. the option list in `modules/<module>/enums.ts` (re-exported from the
   generated client so the array and the type cannot drift),
3. the labels in `modules/<module>/i18n/{en,fr,ar}.ts`.

Never write a bare string literal for an enum value in application code.

## Partial-uniqueness: the `scopeKey` convention

Postgres treats `NULL` as distinct in a unique index, so
`@@unique([levelId, subjectId, trackId])` does **not** stop two rows with a null
`trackId`. Where a nullable column takes part in identity, add a non-null
`scopeKey String` that stringifies the nullable parts (`trackId ?? "-"`), put
that in the unique constraint, and set it through one helper in
`lib/db-keys.ts`. Never set it by hand at a call site, and never let a form
submit it. Same pattern for `TimetableEntry.bookingKey` and
`CashSession.openKey` (a partial unique enforcing "one open session per
register").

## Migrations

```bash
npm run db:migrate      # prisma migrate dev — after any schema change
npm run db:generate     # regenerate the client into lib/generated/prisma
npm run db:seed         # idempotent, safe to re-run — the full demonstration
npm run db:seed:config  # the same, minus every person: configuration only
npm run db:studio
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
reads as `undefined`. Restart `npm run dev` after adding tables.

## Seeding

Two orchestrators over one set of module seeds:

* `prisma/seed.ts` — the demonstration: a school with pupils, staff, classes, a
  timetable and a year of receipts. What you look at the app with.
* `prisma/seed-config.ts` — the same school with nothing in it: years and their
  calendar, the cursus, rooms, towns, the fee catalogue, the caisse's tills and
  rubriques, the school's policies, the roles, and one administrator. What a
  real school starts from.

The split is only in the orchestration — both call the same
`modules/<module>/seed.ts` functions, so a module gets one seed and not two.
Anything that takes a `withOffice`-style switch belongs in the module's seed.

- Seeds must be **idempotent** — upsert on the table's unique constraint, never
  `create`. Re-running is the normal case and must change nothing.
- Seeds **never delete**. Use `npm run db:reset` for a clean slate.
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

These rules are load-bearing. The session cookie holds only a user id; every
authorization decision is re-made from the database on every request
(`lib/dal.ts`), so revoking access takes effect immediately instead of when a
token expires.

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
  leak.
- `proxy.ts` / middleware is an optimistic cookie check only. Never a real gate.
- Rate-limit login by email (`LoginAttempt`), and never say which of the email
  or the password was wrong.

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
  in `lib/i18n/format.ts` for dates, numbers and money — never `toLocaleString`
  directly.
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
4.  modules/<id>/enums.ts                   re-export the generated enums
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
17. modules/<id>/seed.ts + one call in prisma/seed.ts
18. npm run db:seed
```

# Verifying

Run all of these before calling a change done:

```bash
npm run typecheck     # next typegen && tsc --noEmit
npm run lint
npm run format:check
npm run test          # --passWithNoTests until prompt 38 drops the flag
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
  a `Restrict`, a derived column, an invariant the database cannot express) get a
  sentence. Obvious code gets none.
- British spelling in English copy ("organisation"), matching the dictionary.
  Product-facing role names stay French — they are data, not translation keys.
- `type` over `interface`. Named exports over default (dictionaries and pages
  excepted). Explicit return types on exported functions.
- Derive, never duplicate: age from `birthDate`, the permission catalogue from
  the registry, DTO shaping in `queries.ts` so list and detail cannot drift.
- No `any`. No `as` outside a parser boundary. No `useEffect` for data.
