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

## Running with Docker

The app and MySQL in one stack, on one machine. This is also how the app should
be **deployed**: across the internet each statement costs ~112 ms, and a page
issuing thirty of them spends three seconds doing nothing but waiting. On one
machine the same query is a loopback hop, and the only traffic left on the slow
link is the HTTP response to the browser.

You need Docker with Compose v2. Nothing else — no Node, no MySQL, no
`npm install` on the host.

### First run

```bash
cp docker/env.example .env.docker
```

Fill in the three required values. Generate them:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"     # MYSQL_ROOT_PASSWORD
node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"     # MYSQL_PASSWORD
```

Keep the two MySQL passwords to letters and digits. They are interpolated into a
connection URL, so a `@`, `:`, `/` or `#` would need percent-encoding and would
otherwise silently truncate it.

Then build the images and start everything:

```bash
docker compose up -d --build
```

The first build takes a few minutes; later ones reuse the cached `npm ci` layer.

### What that does

Three services, in order:

| Service | Image stage | Role |
|---|---|---|
| `db` | `mysql:8.4` | utf8mb4 / utf8mb4_unicode_ci, data in the `db-data` volume |
| `migrate` | `builder` | one-shot: `prisma migrate deploy`, then the seed, then exits |
| `app` | `runner` | the standalone Next server, on <http://localhost:3000> |

`migrate` waits for `db` to pass its health check, and `app` waits for `migrate`
to exit successfully — so the app never serves a request against a schema older
than the code it is running. Watch it come up:

```bash
docker compose logs -f migrate   # migrations and seeding
docker compose logs -f app
```

`migrate` is built from the `builder` stage rather than `runner` because the
seeds are TypeScript that imports from `modules/`, so they need the full source,
`tsx` and the Prisma CLI — all of which `runner` drops.

### Signing in

Everybody signs in with a **username** — the dashboard and the phone ask for the
same one, and an email address is never a credential. The seeded administrator's
is the local part of `SEED_ADMIN_EMAIL`, so `admin@groupescolaire.ma` means
signing in as `admin`. The password is `SEED_ADMIN_PASSWORD`, `Admin123!` unless
you changed it.

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` *before* the first
`docker compose up`: the seeds upsert on the username derived from it, so
changing it later adds a second administrator rather than renaming the first.

### Choosing what gets seeded

`SEED_MODE` in `.env.docker` decides what `migrate` does after the migrations:

| Value | What you get |
|---|---|
| `config` *(default)* | years and calendar, cursus, rooms, fee catalogue, roles, one administrator |
| `demo` | all of the above plus pupils, staff, classes, timetable, a year of receipts |
| `empty` | an organisation and nothing else |
| `none` | migrations only |

All four are safe on every `up` — the seeds are idempotent and never delete, so
a school you added by hand survives. Set `none` once the school has real data
in it, purely to save the few seconds. To seed differently without a restart:

```bash
docker compose run --rm -e SEED_MODE=demo migrate
```

### Browsing the database

phpMyAdmin is available but deliberately **not** part of the stack — it sits
behind a Compose profile, so a plain `docker compose up` never quietly gains a
database administration UI:

```bash
docker compose --profile tools up -d phpmyadmin
```

Then <http://localhost:8080>, signing in as either `root` /
`MYSQL_ROOT_PASSWORD` or `mizmar` / `MYSQL_PASSWORD` from `.env.docker`. Stop it
again with `docker compose stop phpmyadmin`.

Like MySQL, it is published on loopback only. To reach it on a remote box,
forward the port rather than opening it:

```bash
ssh -L 8080:127.0.0.1:8080 user@host
```

`npm run db:studio` is the other option, and needs no container — it reaches the
published `127.0.0.1:3306` from the host.

### Everyday commands

```bash
docker compose up -d                  # start
docker compose down                   # stop, keep the data
docker compose down -v                # stop and DESTROY the database volume
docker compose up -d --build          # rebuild after a code change
docker compose logs -f app
docker compose exec app sh            # a shell in the app container
```

Pulling new code with new migrations needs nothing special: `docker compose up
-d --build` runs `migrate` again and `app` waits for it.

Your own `.env` is not used and not copied into the image — `.dockerignore`
excludes it, and `docker/entrypoint.sh` builds `DATABASE_URL` inside the
container from the `MYSQL_*` values so the app can only reach the database
standing next to it. Local `npm run dev` is therefore unaffected.

[docker/README.md](docker/README.md) covers backups, building on a small cloud
instance, and troubleshooting.

## Seeded accounts

These come from the full demonstration seed — `npm run db:seed`, or
`SEED_MODE=demo` under Docker. The `config` seed creates only the administrator.

All share the password `Admin123!`. Each one exercises a different permission
level, which makes the role system easy to see in action.

| Username | Access |
|---|---|
| `admin` | Super administrator — everything |
| `pedagogie` | Org role: sees all schools, manages school years |
| `directeur.casa` | Directeur — Casablanca only |
| `directeur.rabat` | Directeur — Rabat only |
| `secretariat.casa` | Secrétaire — Casablanca, read-mostly |
| `prof.marrakech` | Enseignant — Marrakech, read-only |

Teachers sign in as `firstname.lastname`, and a family's portal login is the
dossier number — the seed prints both when it finishes.

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
