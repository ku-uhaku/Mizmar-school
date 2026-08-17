# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────────────
#  Mizmar School — production image
#
#  Four stages, and two of them are shipped:
#
#    base     node + the OS packages Prisma's schema engine needs
#    deps     node_modules, cached on the lockfile alone
#    builder  `prisma generate` + `next build`  → also the migrate/seed image
#    runner   the standalone server and nothing else  → the app image
#
#  `builder` is deliberately reused as the migration and seeding image rather
#  than built again: the seeds are TypeScript that imports from `modules/`
#  (`prisma/seed.ts` calls each module's own `seed.ts`), so they need the full
#  source and dev dependencies — `tsx`, the Prisma CLI — that `runner` throws
#  away. Reusing the stage costs nothing, because compose has already built it.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=24

# ── base ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The Prisma *client* needs no engine binary here — lib/db.ts drives MySQL
# through the MariaDB driver adapter, which is plain JavaScript. The Prisma
# *CLI* still ships a schema engine for `migrate deploy`, and that one links
# against OpenSSL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ── deps ─────────────────────────────────────────────────────────────────────
# Only the lockfile is copied, so editing application code does not re-run the
# install. Dev dependencies are kept: the build needs them, and so do the seeds.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `npm run build` is `prisma generate && next build` — the generate writes the
# client into lib/generated/prisma, which the trace then follows.
#
# The two placeholders are never used to connect: `next build` evaluates modules
# while it traces routes, and `lib/db.ts` throws on a missing DATABASE_URL by
# design, so without a value the build fails on a variable that only matters at
# runtime. They are set inline on this one command rather than with `ENV`
# precisely so they do NOT persist into the image — this stage is also the
# migrate/seed image, and an inherited placeholder DATABASE_URL would send the
# migration at the container's own localhost, while an inherited AUTH_SECRET
# would satisfy the entrypoint's check and hide a genuinely missing secret.
RUN DATABASE_URL="mysql://build:build@127.0.0.1:3306/build" \
    AUTH_SECRET="build-time-placeholder" \
    NODE_ENV=production \
    npm run build

# This stage is also the migrate/seed image, so it needs the same DATABASE_URL
# resolution the app gets. Compose overrides the command; the entrypoint stays.
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["sh", "/app/docker/init.sh"]

# ── runner ───────────────────────────────────────────────────────────────────
# `output: "standalone"` (next.config.ts) emits a server plus only the traced
# files from node_modules, so this image carries neither the Prisma CLI nor the
# 1 GB of dev dependencies the builder needed.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone server does not copy `public` or `.next/static` itself — the
# Next docs expect a CDN to serve them. There is no CDN here, so they are
# placed where server.js looks for them and it serves them directly.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
