# Running with Docker

The app and MySQL in one stack, on one machine.

## Why

Against a MySQL across the internet, one statement measured **~112 ms**. Pages
here issue dozens — the dashboard alone is a few dozen — so a render spent
seconds doing nothing but waiting, and a write cost three round trips per row
because of the audit extension.

Nothing about that is fixed by tuning queries. It is fixed by putting the app
next to the database, where a round trip is a loopback hop instead of a journey
across a lossy link. Compose does exactly that: `app` and `db` share a Docker
network, and the only traffic left on the slow link is the single HTTP response
to the browser.

## First run

```bash
cp docker/env.example .env.docker
```

Fill in the three required values. Generate them:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"     # each MySQL password
```

Keep the MySQL passwords to letters and digits — they are interpolated into a
connection URL, and `@`, `:`, `/` or `#` would need percent-encoding.

Then:

```bash
docker compose up -d --build
```

That brings up MySQL, waits for it to pass its health check, applies every
migration, seeds, and starts the app on <http://localhost:3000>.

Sign in with `SEED_ADMIN_EMAIL`'s local part — `admin@groupescolaire.ma` means
signing in as **`admin`** — and `SEED_ADMIN_PASSWORD`.

Watch it come up:

```bash
docker compose logs -f migrate   # migrations and seeding
docker compose logs -f app
```

## What runs, in what order

| Service | Image stage | Role |
|---|---|---|
| `db` | `mysql:8.4` | utf8mb4 / utf8mb4_unicode_ci, data in the `db-data` volume |
| `migrate` | `builder` | one-shot: `prisma migrate deploy`, then the seed, then exits |
| `app` | `runner` | the standalone Next server |

`app` waits on `migrate` completing successfully, so it never serves a request
against a schema older than the code it is running.

`migrate` is built from the `builder` stage rather than `runner` because the
seeds are TypeScript that imports from `modules/` — they need the full source,
`tsx` and the Prisma CLI, all of which `runner` drops.

## Seeding

`SEED_MODE` in `.env.docker` decides what `migrate` does after the migrations:

| Value | What you get |
|---|---|
| `config` *(default)* | years and calendar, cursus, rooms, fee catalogue, roles, one administrator |
| `demo` | all of the above plus pupils, staff, classes, timetable, a year of receipts |
| `empty` | an organisation and nothing else |
| `none` | migrations only |

All four are safe on every `up` — the seeds are idempotent and never delete, so
a school you added by hand survives. Set `none` once the school has real data
in it, purely to save the few seconds.

To reseed differently without a restart:

```bash
docker compose run --rm -e SEED_MODE=demo migrate
```

## Everyday commands

```bash
docker compose up -d                  # start
docker compose down                   # stop, keep the data
docker compose down -v                # stop and DESTROY the database volume
docker compose up -d --build app      # rebuild after a code change
docker compose exec app sh            # a shell in the app container
docker compose logs -f app
```

Apply new migrations after pulling code:

```bash
docker compose up -d --build
```

`migrate` runs again automatically and `app` waits for it.

### Backups

```bash
docker compose exec db sh -c \
  'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines "$MYSQL_DATABASE"' \
  > backup-$(date +%F).sql
```

Restore:

```bash
docker compose exec -T db sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < backup-2026-08-17.sql
```

## Notes on the setup

**Where DATABASE_URL comes from.** Not from compose. `docker/entrypoint.sh`
builds it inside the container from the `MYSQL_*` values. Compose interpolates
`${...}` from the `.env` beside it, and this repository's `.env` is a
developer's own pointing at a remote server — had compose assembled the URL, a
stale value there could quietly have sent the containerised app back across the
internet. Setting `DATABASE_URL` explicitly still wins, which is what lets this
image point at a managed MySQL later without touching the compose file.

**`.env` is not in the image.** `.dockerignore` excludes it, which matters more
than it looks: Next's standalone output copies a `.env` it finds at the project
root into the bundle, so without that exclusion the developer's secrets *and*
their remote `DATABASE_URL` would be baked into a layer and would win at
runtime.

**MySQL is not published to the internet.** The port is bound to
`127.0.0.1:3306`, not `3306:3306`. Docker writes its own iptables rules, so the
plain form would expose MySQL past a cloud security-list rule. The app does not
use the published port at all — it goes over the compose network. Reach it from
the host for `prisma studio` or a `mysql` client, and nowhere else.

**`output: "standalone"`** is set in `next.config.ts`. It is read at build time,
so it has to live there rather than be passed to `next build`. `next dev` and
`next start` ignore it, so local development is unaffected.

## Building on a small cloud instance

`next build` is memory-hungry and an Oracle free-tier box will OOM partway
through, usually as a bare `Killed`. Give it swap once:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

The alternative is to build elsewhere and push the image to a registry.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `entrypoint.sh: not found` (but it exists) | CRLF line endings. `.gitattributes` pins `*.sh` to LF; re-clone or run `dos2unix docker/*.sh` |
| `✗ AUTH_SECRET is not set` | `.env.docker` missing or unfilled |
| `migrate` exits non-zero | read `docker compose logs migrate`; `app` deliberately will not start |
| `Killed` during build | out of memory — add swap, above |
| app up but sign-in loops | `AUTH_SECRET` changed; every existing session is void |
