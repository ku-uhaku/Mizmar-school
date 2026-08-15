# Administration scolaire

Admin dashboard for a private school group in Morocco. One organisation, many
schools. Every user works inside a **current school** and **current school year**
that they can switch at any time.

Not a SaaS: there is a single organisation per deployment, and it is edited
in-app rather than created through a signup flow.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, Server Actions) |
| Database | MySQL 8 via Prisma 7 + `@prisma/adapter-mariadb` driver adapter |
| Auth | Auth.js v5 (`next-auth@beta`), credentials + JWT sessions |
| UI | shadcn/ui (Radix base, RTL-aware) + Tailwind CSS v4 |
| Tables | TanStack Table |
| Validation | Zod 4 |

## Getting started

You need a MySQL 8 server (MariaDB 10.6+ also works — same driver). Prisma
migrates into the database but does not create it, so make it first:

```sql
CREATE DATABASE mizmar_school CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`utf8mb4` is required — the app stores Arabic throughout — and
`utf8mb4_unicode_ci` is what makes name search case- and accent-insensitive.

```bash
npm install
cp .env.example .env        # then set DATABASE_URL and AUTH_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Seeded accounts

All share the password `Admin123!`. Each one exercises a different permission
level, which makes the role system easy to see in action.

| Email | Access |
|---|---|
| `admin@groupescolaire.ma` | Super administrator — everything |
| `pedagogie@almanar.ma` | Org role: sees all schools, manages school years |
| `directeur.casa@almanar.ma` | Directeur — Casablanca only |
| `directeur.rabat@almanar.ma` | Directeur — Rabat only |
| `secretariat.casa@almanar.ma` | Secrétaire — Casablanca, read-mostly |
| `prof.marrakech@almanar.ma` | Enseignant — Marrakech, read-only |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` then production build |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm run db:migrate` | Create + apply a migration |
| `npm run db:seed` | Idempotent seed |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:studio` | Prisma Studio |

## Features

- **Login only.** No public signup — accounts are created by administrators.
- **Organisation**: view and update (single row, not creatable/deletable).
- **Schools**: full CRUD, scoped to what the user can see.
- **School years**: CRUD scoped to the current school, with one default per school.
- **Users**: CRUD, plus a per-school role matrix and a super-admin flag.
- **Roles & permissions**: CRUD with a permission grid. System roles can have
  their permissions tuned but cannot be renamed or deleted.
- **Profile**: own details and password change.
- **Appearance**: language, light/dark/system, accent colour, font, text size and
  corner radius — stored on the profile and mirrored to a cookie.
- **i18n**: French, English and Arabic, with full RTL for Arabic.

## How authorization works

Three ideas, all enforced in `lib/dal.ts`:

- **`isSuperAdmin`** — a flag outside the role system, so an unlucky role edit can
  never lock the organisation out.
- **Organisation roles** (`User.orgRoleId`, scope `ORG`) apply in every school.
- **School roles** (`Membership`, scope `SCHOOL`) apply only where assigned.

Effective permissions in a school are the union of the org-wide set and that
school's role. The context exposes three checks:

```ts
context.canOrg(p)              // org-wide only
context.can(p)                 // in the currently selected school
context.canInSchool(id, p)     // in one specific school
```

Two rules the code holds to throughout:

1. **The JWT carries only a user id.** Roles, permissions and the school context
   are re-read from the database on every request, so deactivating a user or
   changing a role takes effect immediately rather than when their token expires.
2. **Server Actions re-authorize.** They are reachable by direct POST, so a check
   on the page that renders a form protects nothing. Every action calls
   `authorizeOrg` / `authorizeSchool` / `authorizeAnyScope` itself, and scopes its
   `where` clauses by organisation so a crafted id cannot reach another row.

`proxy.ts` (Next 16's renamed middleware) only does a shallow cookie-presence
check to bounce anonymous visitors to `/login`. It is deliberately not a security
boundary.

## Notes and trade-offs

- **The current school/year live on the `User` row**, not in a cookie — they
  cannot be forged, and they follow the user across devices. Language and
  appearance *are* cookies, because they must apply before anyone signs in.
- **Enum-like columns are `String`, not MySQL `ENUM`.** Widening an `ENUM` is a
  migration, and these values change with a school's configuration rather than
  with the schema. The allowed values live in each module's `enums.ts` — keep
  them in sync with that module's `prisma/schema/<module>/*.prisma`.
- **Column lengths are explicit.** Prisma's default for a bare `String` is
  `VARCHAR(191)`, so free text carries `@db.Text`, the four image columns carry
  `@db.MediumText`, and every id and foreign key carries `@db.VarChar(30)` — a
  cuid is 25 characters, and the short form is what keeps the six-column unique
  on `assessments` inside InnoDB's 3072-byte index limit.
- **Tables filter and paginate client-side.** One organisation's schools, users
  and roles are hundreds of rows at most, so shipping them in one go keeps search
  instant and the code simple. Revisit if a deployment grows past a few thousand.
- **The whole dictionary is sent to the client** so client components can
  translate without a round trip. It is a few KB per page; splitting it per route
  would be the optimisation if that ever matters.
