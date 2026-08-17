#!/bin/sh
# Brings the database up to the code, then optionally puts data in it.
#
# Runs as a one-shot compose service that the app waits on
# (`service_completed_successfully`), so the app never serves a request against
# a schema that is behind the code it is running.
set -eu

echo "→ Applying migrations…"
# `migrate deploy`, never `migrate dev`: deploy applies the committed
# migrations and nothing else. `dev` would try to author a new one from a
# schema drift and prompts before adding a unique constraint, which in a
# container with no terminal hangs until compose gives up.
npx prisma migrate deploy

SEED_MODE="${SEED_MODE:-config}"

case "$SEED_MODE" in
  config)
    # Years and their calendar, the cursus, rooms, the fee catalogue, the
    # roles, and one administrator. What a real school starts from.
    echo "→ Seeding configuration (SEED_MODE=config)…"
    npm run db:seed:config
    ;;
  demo)
    # The full demonstration: pupils, staff, classes, a timetable, a year of
    # receipts. Takes appreciably longer than the other two.
    echo "→ Seeding the demonstration data (SEED_MODE=demo)…"
    npm run db:seed
    ;;
  empty)
    echo "→ Seeding an empty organisation (SEED_MODE=empty)…"
    npm run db:seed:empty
    ;;
  none)
    echo "→ Skipping the seed (SEED_MODE=none)."
    ;;
  *)
    echo "✗ SEED_MODE must be one of: config, demo, empty, none — got '$SEED_MODE'." >&2
    exit 1
    ;;
esac

echo "✓ Database ready."
