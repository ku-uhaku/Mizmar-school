#!/bin/sh
# Resolves DATABASE_URL, then hands off to the container's real command.
#
# ── Why the URL is built here and not in docker-compose.yml ──────────────────
# Compose interpolates `${...}` from the `.env` beside it, and this repository's
# `.env` is a developer's own — it points DATABASE_URL at a remote MySQL. Had
# compose assembled the URL, that file would have had to hold the container's
# credentials too, and a stale value in it would have quietly sent the
# containerised app back across the internet to the wrong server.
#
# Building it from MYSQL_* inside the container removes the choice: the app can
# only reach the database standing next to it. An explicit DATABASE_URL still
# wins, which is what lets one point this image at a managed MySQL later
# without touching the compose file.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  : "${MYSQL_USER:=mizmar}"
  : "${MYSQL_DATABASE:=mizmar_school}"
  : "${MYSQL_HOST:=db}"
  : "${MYSQL_PORT:=3306}"

  if [ -z "${MYSQL_PASSWORD:-}" ]; then
    echo "✗ MYSQL_PASSWORD is not set. Copy docker/env.example to .env.docker and fill it in." >&2
    exit 1
  fi

  DATABASE_URL="mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"
  export DATABASE_URL
fi

# Checked here rather than left to fail at the first sign-in: without it Auth.js
# cannot sign a session, and the symptom (a login that silently loops back to
# the form) points nowhere near the cause.
if [ -z "${AUTH_SECRET:-}" ]; then
  echo "✗ AUTH_SECRET is not set. Copy docker/env.example to .env.docker and fill it in." >&2
  echo "  Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"" >&2
  exit 1
fi

exec "$@"
