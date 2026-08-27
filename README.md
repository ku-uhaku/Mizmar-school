# Mizmar School — administration scolaire

The administration system for a private school group in Morocco. **One
organisation, many schools.** Every user works inside a *current school* and a
*current school year* that they can switch from the header at any time, and
everything they see — the pupil list, the till, the timetable, the payroll — is
scoped to that pair.

It is deliberately **not a SaaS**: one organisation per deployment, edited
in-app rather than created through a signup flow. There is no public signup at
all; accounts are created by an administrator.

The system covers the whole life of a school:

| Domain | What it does |
| --- | --- |
| **Vie scolaire** | families and guardians, pupils, enrolments and their fee schedule, classes and groups, the timetable, attendance, homework and remarks |
| **Évaluation** | assessments, marks, appreciations, term bulletins, printable report cards |
| **Finance** | the fee catalogue and price list, the caisse (encaissement, décaissement, transferts, chèques, sessions de caisse), family balances and receipts |
| **RH** | staff files, attendance, payroll, advances, leave |
| **Logistique** | transport (routes, voyages, fleet, fuel consumption, run sheets), rooms, supplies |
| **Administration** | schools, school years, users, roles and permissions, configuration of every reference table, audit trail, MASSAR exchange, imports |
| **Communication** | chat, notifications, events, parent requests |
| **Mobile** | a separate Expo app: four small read-only spaces for families, teachers, drivers and directors |

Three languages throughout — **French** (default), **English**, **Arabic** with
full RTL.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Turbopack) |
| Runtime | Node 20+ (developed on 24) |
| Database | MySQL 8 / MariaDB 10.6+ via Prisma 7 + `@prisma/adapter-mariadb` |
| Auth | Auth.js v5 (`next-auth@beta`) — credentials, JWT session; Bearer tokens for the phone |
| UI | shadcn/ui on Radix, Tailwind CSS v4, TanStack Table, hand-rolled SVG charts (no chart library) |
| Validation | Zod 4 |
| Tests | Vitest |
| Native app | Expo SDK 54 / expo-router (`mobile/`) |

## How the code is laid out

The app is **module-first**, not layer-first — one folder per domain, holding
its schema, its permissions, its queries, its actions, its translations and its
screens. See [AGENTS.md](AGENTS.md) for the full architecture; the short version:

```
modules/<module>/     module.ts permissions.ts enums.ts validation.ts
                      queries.ts service.ts actions.ts seed.ts
                      i18n/{en,fr,ar}.ts components/*.tsx
prisma/schema/<module>/<table>.prisma      the schema is a FOLDER
app/                  routes only — authorize, query, render
lib/                  infrastructure: db, dal, i18n, permissions, nav
components/           the design system and shell — domain-free
mobile/               the Expo app, its own package.json
```

Imports may only point inward: `app/ → modules/ → lib/`.

---

# Running it

There are two ways: **Docker** (everything in one command, also how it should be
deployed) or **local Node + your own MySQL** (what you want while developing).

## Option A — Docker (the whole stack)

You need Docker with Compose v2. Nothing else: no Node, no MySQL, no
`npm install` on the host.

```bash
cp docker/env.example .env.docker
```

Fill in the three required values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"     # MYSQL_ROOT_PASSWORD
node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"     # MYSQL_PASSWORD
```

Keep the two MySQL passwords to letters and digits — they are interpolated into
a connection URL, so `@`, `:`, `/` or `#` would need percent-encoding and would
otherwise silently truncate it.

Then:

```bash
docker compose up -d --build
```

The app is on <http://localhost:3000>. The first build takes a few minutes;
later ones reuse the cached `npm ci` layer.

**Three services, in order.** `db` comes up and passes its health check, then
`migrate` runs once and exits, then `app` starts — so the app never serves a
request against a schema older than the code running it.

| Service | Image / stage | Role |
|---|---|---|
| `db` | `mysql:8.4` | utf8mb4 / utf8mb4_unicode_ci, data in the `db-data` volume, published on `127.0.0.1:3306` only |
| `migrate` | `builder` | one-shot: `prisma migrate deploy`, then the seed chosen by `SEED_MODE`, then exits |
| `app` | `runner` | the standalone Next server on port 3000 |
| `phpmyadmin` | `phpmyadmin:5.2` | **not** in the default stack — behind the `tools` profile |

`migrate` is built from `builder` and not `runner` because the seeds are
TypeScript importing from `modules/`, so they need the full source, `tsx` and
the Prisma CLI — all of which `runner` drops.

### Docker commands

```bash
docker compose up -d --build        # build and start everything
docker compose up -d                # start
docker compose down                 # stop, KEEP the data
docker compose down -v              # stop and DESTROY the database volume
docker compose logs -f migrate      # watch migrations + seeding
docker compose logs -f app
docker compose exec app sh          # a shell in the app container
docker compose restart app
docker compose ps
```

Pulling new code with new migrations needs nothing special —
`docker compose up -d --build` runs `migrate` again and `app` waits for it.

### Choosing what gets seeded

`SEED_MODE` in `.env.docker` decides what `migrate` does after the migrations:

| Value | What you get |
|---|---|
| `config` *(default)* | years and their calendar, the cursus, rooms, towns, the fee catalogue and price list, the tills and rubriques, the roles, one administrator |
| `demo` | all of that **plus** staff, families, pupils, enrolments, classes, timetable, buses and a year of receipts |
| `empty` | an organisation and nothing else |
| `none` | apply migrations only |

All four are safe on every `up` — the seeds are idempotent and never delete, so
a school you added by hand survives. To seed differently for one run without
touching the file:

```bash
docker compose run --rm -e SEED_MODE=demo migrate
```

### Browsing the database under Docker

phpMyAdmin sits behind a Compose profile so a plain `up` never quietly gains a
database administration UI:

```bash
docker compose --profile tools up -d phpmyadmin   # then http://localhost:8080
docker compose stop phpmyadmin
```

Sign in as `root` / `MYSQL_ROOT_PASSWORD` or `mizmar` / `MYSQL_PASSWORD`. Like
MySQL, it is published on loopback only — to reach it on a remote box, forward
the port rather than opening it:

```bash
ssh -L 8080:127.0.0.1:8080 user@host
```

Your own `.env` is never used and never copied into the image;
`docker/entrypoint.sh` builds `DATABASE_URL` inside the container from the
`MYSQL_*` values, so the app can only reach the database standing next to it.
Local `npm run dev` is unaffected.

[docker/README.md](docker/README.md) covers backups, building on a small cloud
instance, and troubleshooting.

## Option B — local development

### 1. The database

Prisma migrates into the database but will **not** create it, so make it first:

```sql
CREATE DATABASE mizmar_school CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
mysql -u root -p -e "CREATE DATABASE mizmar_school \
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

`utf8mb4` is not optional — the app stores Arabic throughout — and
`utf8mb4_unicode_ci` is what makes the `contains` searches in `queries.ts` case-
and accent-insensitive without a `mode` Prisma does not offer on MySQL.

### 2. Environment

```bash
cp .env.example .env
```

Set two things:

```bash
DATABASE_URL="mysql://root:root@localhost:3306/mizmar_school"
AUTH_SECRET="…"    # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`AUTH_SECRET` signs both the session cookie and the native app's bearer tokens.
Changing it signs everybody out.

Optional, all documented in [.env.example](.env.example):

| Variable | Effect |
|---|---|
| `DATABASE_SSL_CA` | the CA that signed a managed MySQL's certificate (PEM or base64) |
| `SEED_ADMIN_EMAIL` | the first administrator — their username is its local part |
| `SEED_ADMIN_PASSWORD` | the password every seeded account gets |
| `SEED_ORG_NAME` | the organisation's name, for `db:seed:empty` |
| `PRISMA_LOG_QUERIES=1` | print every SQL statement in development |

Set `SEED_ADMIN_*` **before the first seed**: the seeds upsert on the username
derived from the email, so changing it later adds a second administrator rather
than renaming the first.

### 3. Install, migrate, seed, run

```bash
npm install
npx prisma migrate deploy     # apply the committed migrations
npm run db:generate           # generate the client into lib/generated/prisma
npm run db:seed               # the full demonstration
npm run dev                   # http://localhost:3000
```

On a fresh checkout `npm install` already runs `prisma generate`; run
`db:generate` again after any schema change. **Restart `npm run dev` after
adding tables** — `lib/db.ts` caches the client on `globalThis` in development,
so a server started before a `prisma generate` keeps the old client and every
new model reads as `undefined`.

## Option C — web + native app together

```bash
npm run dev:all
```

Starts the Next dev server and Expo Metro side by side, prefixes their output,
and makes sure neither outlives the other. It refuses to start if ports 3000 or
8081 are already taken, and warns if `mobile/app.json` points somewhere the
phone cannot reach.

---

# The native app (`mobile/`)

An Expo client — **not** a second copy of the web app. Four small read-only
spaces, decided by the account (`modules/portal/identity.ts`):

| Espace | Who | What it shows |
| --- | --- | --- |
| Famille | a guardian with a portal account | their children, marks, absences, scolarité, ramassage |
| Classe | a teacher | the day, the timetable, the registers still to take |
| Transport | a driver | the day's runs and the run sheet |
| Direction | a director or manager | effectifs, billing, breakdown by level |

An account with more than one space gets a switcher. Everything is read-only —
marking a register or taking a payment stays on the web app.

## Running the phone app

The Next server must be running first, because every screen reads
`app/api/mobile/v1/**`.

**Point the app at your machine's LAN address, not `localhost`** — on a real
phone `localhost` is the phone. Edit `extra.apiUrl` in
[mobile/app.json](mobile/app.json):

```json
{ "expo": { "extra": { "apiUrl": "http://192.168.1.20:3000" } } }
```

Find your address with `ip addr` / `ifconfig`, or just run `npm run dev:all` —
it prints the addresses this machine answers on when the URL looks wrong.

```bash
cd mobile
npm install
npx expo start              # scan the QR code with Expo Go
npx expo start --android    # an Android emulator or device
npx expo start --ios        # an iOS simulator
npx expo start --web        # in the browser
npx expo start --clear      # clear the Metro cache when a change will not take
```

From the repository root, `npm run dev:mobile` runs `expo start` in `mobile/`.

`mobile/` has its own `package.json` and `tsconfig`, is excluded from the root
tsconfig and ESLint, and mirrors the DTO types by hand in
`mobile/src/api/types.ts` — importing a module's `queries.ts` would drag
`server-only` and Prisma into a phone bundle.

---

# Signing in

Everybody signs in with a **username** — the dashboard and the phone ask for the
same one, and an email address is never a credential. The seeded
administrator's username is the local part of `SEED_ADMIN_EMAIL`, so
`admin@groupescolaire.ma` signs in as `admin`.

The full demonstration seed (`npm run db:seed`, or `SEED_MODE=demo`) prints the
accounts when it finishes. They all share `SEED_ADMIN_PASSWORD` — `Admin123!`
unless you changed it:

| Username | Access |
|---|---|
| `admin` | Super administrator — everything, in every school |
| `pedagogie` | Org-wide role: sees all schools, manages school years |
| `directeur.casa` | Directeur — Casablanca only |
| `directeur.rabat` | Directeur — Rabat only |
| `secretariat.casa` | Secrétaire — Casablanca, read-mostly |
| `prof.marrakech` | Enseignant — Marrakech, read-only |

Teachers sign in as `firstname.lastname` (`karim.bennis`), and a family's portal
login is the dossier number. The seed prints a working driver and family login
for the phone app.

The `config` seed creates only the administrator.

---

# Every command

## Development

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server on :3000 |
| `npm run dev:all` | the web app **and** Expo Metro together |
| `npm run dev:mobile` | Expo Metro alone (`mobile/`) |
| `npm run build` | `prisma generate` then a production build |
| `npm start` | serve the production build |

## Database

| Command | What it does |
|---|---|
| `npm run db:generate` | `prisma generate` — regenerate the client into `lib/generated/prisma` |
| `npm run db:migrate` | `prisma migrate dev` — author and apply a migration after a schema change |
| `npx prisma migrate deploy` | apply the committed migrations, no prompts (CI, containers) |
| `npm run db:seed` | the full demonstration seed — idempotent, safe to re-run |
| `npm run db:seed:config` | the same school, configuration only: no people, no receipts |
| `npm run db:seed:empty` | an organisation and nothing else |
| `npm run db:reset` | drop, re-migrate, re-seed — a clean slate |
| `npm run db:studio` | Prisma Studio |
| `npx prisma validate` | check the schema folder parses and is coherent |
| `npx prisma format` | format the `.prisma` files |

`prisma migrate dev` prompts before adding a unique constraint, which hangs in a
non-interactive shell. The CI-friendly path is to generate the SQL, read it,
then apply it:

```bash
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema prisma/schema --script > prisma/migrations/<stamp>_<name>/migration.sql
npx prisma migrate deploy
```

After reorganising schema files without intending a schema change, prove it:

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema
# → "No difference detected."
```

Never hand-edit a file in `prisma/migrations/`, and never edit
`lib/generated/prisma/` — it is generated output.

## Data maintenance scripts

One-off repairs, safe to run on a seeded database:

| Command | What it does |
|---|---|
| `npm run db:carry-marks` | carry marks stranded by a re-enrolment onto the right enrolment |
| `npm run db:move-misfiled` | move rows filed against the wrong school |
| `npm run db:staff-classes` | assign teachers to classes that have none |

## Checks — run all of these before calling a change done

```bash
npm run typecheck     # next typegen && tsc --noEmit
npm run lint          # ESLint, flat config (one pre-existing warning in components/data-table)
npm test              # vitest run
npm run build
npx prisma validate
```

A green typecheck is meaningful here: it covers missing translations, unknown
permission codes, and bad `NavIcon` or `section` values. `npm run test:watch`
watches.

---

# How authorization works

Three ideas, all enforced in `lib/dal.ts`:

- **`isSuperAdmin`** — a flag outside the role system, so an unlucky role edit
  can never lock the organisation out.
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
   changing a role takes effect immediately rather than when their token
   expires. The phone's bearer token works the same way, through the same path.
2. **Server Actions re-authorize.** They are reachable by direct POST, so a
   check on the page that renders a form protects nothing. Every action calls
   `authorizeOrg` / `authorizeSchool` / `authorizeAnyScope` itself and scopes
   its `where` clauses by organisation, so a crafted id cannot reach another
   tenant's row.

`proxy.ts` (Next 16's renamed middleware) only does a shallow cookie-presence
check to bounce anonymous visitors to `/login`. It is deliberately not a
security boundary.

**A parent is not staff.** Guardians hold no membership and no permission, so
`modules/portal/queries.ts` scopes on the household instead — every read goes
through `householdScope`, and an id from a phone is only ever combined with it.

---

# Notes and trade-offs

- **A pupil's record is split in two.** `Student` is who a child *is* and
  outlives every year; `Enrollment` is what is true of them *in one year* — the
  level, the class and group, and the whole year's fee schedule. So a child who
  repeats 3AP has two enrolments and one student row, and last year's class list
  keeps resolving. `Student.status` is derived from the enrolments and no form
  ever submits it.
- **The current school and year live on the `User` row**, not in a cookie — they
  cannot be forged and they follow the user across devices. Language and
  appearance *are* cookies, because they must apply before anyone signs in.
- **Enum-like columns are `String`, not MySQL `ENUM`.** Widening an `ENUM` is a
  migration, and these values change with a school's configuration rather than
  with the schema. Allowed values live in each module's `enums.ts`.
- **Column lengths are explicit.** Prisma's default for a bare `String` is
  `VARCHAR(191)`, so free text carries `@db.Text`, image columns carry
  `@db.MediumText`, and every id and foreign key carries `@db.VarChar(30)` — a
  cuid is 25 characters, and the short form is what keeps the six-column unique
  on `assessments` inside InnoDB's 3072-byte index limit.
- **Deploy the app and the database on one machine.** Across the internet each
  statement measured ~112 ms, and a page issuing thirty of them spent three
  seconds doing nothing but waiting. That is the whole reason
  `docker-compose.yml` exists.
- **English is the canonical dictionary.** A key added to `en` is a compile
  error until `fr` and `ar` supply it. That guarantee is tested; do not weaken
  it.
- **Tables filter and paginate client-side** where the row count is bounded by
  one organisation. Revisit if a deployment grows past a few thousand.

---

# Further reading

| File | What is in it |
|---|---|
| [AGENTS.md](AGENTS.md) | the architecture, the module checklist, the house style — read this before writing code |
| [docker/README.md](docker/README.md) | backups, small cloud instances, troubleshooting |
| [mobile/README.md](mobile/README.md) | the native app in detail |
| [.env.example](.env.example) | every environment variable, with why |
| [docker/env.example](docker/env.example) | the same for the Docker stack |
