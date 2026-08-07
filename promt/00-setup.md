# 00 — Setup

> Do this one **first**, in an empty directory. It creates the repo and the
> constitution every later prompt depends on.

## Before you paste anything

**Skills to have installed in Claude Code** (these do real work in this build):

| Skill | Why |
|---|---|
| `prisma-postgres-setup` | provisions the database and writes the connection string |
| `prisma-cli` | migrate / generate / studio commands, correct for v7 |
| `prisma-client-api` | query syntax — stops invented `findMany` options |
| `prisma-database-setup` | datasource + adapter wiring |
| `dataviz` | the dashboard, reports and caisse charts |

Check with `/help` or your skills list. If any are missing, install them before
prompt 13 at the latest.

**Settings to set once**, in `.claude/settings.json` of the new repo — it removes
most permission prompts for the next 38 sessions:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)", "Bash(npx prisma *)", "Bash(npx tsc *)",
      "Bash(git status)", "Bash(git diff *)", "Bash(git log *)",
      "Bash(ls *)", "Bash(rg *)", "Bash(cat *)"
    ]
  }
}
```

**Working habit:** start every later prompt with `/clear`, then paste. Long
sessions drift. One prompt, one session.

---

## The prompt — paste from here

I am starting a school-management app for Moroccan private schools: one
organisation, several schools, ~80 tables, three languages (fr default, en, ar
RTL). Postgres. Web only, no mobile.

Set up the empty repository. Nothing domain-specific yet — this prompt is
scaffolding only.

**1. Create the app**

Use the current `create-next-app` with: TypeScript, App Router, Tailwind, ESLint,
`src/` **off** (top-level `app/`), import alias `@/*`. Read
`node_modules/next/dist/docs/` afterwards and tell me the version you got and
anything in it that differs from what you would have assumed. Do not write
application code against assumptions — check the docs first.

**2. Dependencies**

```
prisma @prisma/client            # v7
zod
next-auth@beta                   # v5, credentials provider only
bcryptjs @types/bcryptjs
@tanstack/react-table
@tanstack/react-query
date-fns
lucide-react
sonner
zustand
class-variance-authority clsx tailwind-merge
server-only
tsx dotenv                       # dev
vitest                           # dev — unit tests for service.ts invariants,
                                  # lib/dal.ts scoping, lib/csv.ts edge cases
prettier prettier-plugin-tailwindcss  # dev — no formatter otherwise; the
                                  # Tailwind plugin keeps class order sane
                                  # across 80 tables' worth of forms
```

Deliberately **not** on this list: no PDF or CSV library (`lib/csv.ts` and the
browser's own `@page` print CSS cover both — see prompts 35 and 36), no
`react-hook-form` (forms run on native `useActionState` + `lib/server-action.ts`
+ zod — see the Security section of `AGENTS.md`). Do not add either later
without a real gap; they duplicate what the house style already owns.

Then `npx shadcn@latest init` and add: `button card input label select textarea
checkbox switch radio-group dialog alert-dialog dropdown-menu popover command
sheet sidebar tabs table badge avatar separator skeleton tooltip scroll-area
collapsible breadcrumb sonner slider`.

**3. Postgres**

Use the `prisma-postgres-setup` skill to provision a database and write
`DATABASE_URL` into `.env`. Add `.env` to `.gitignore` and commit a `.env.example`
with the keys and no values. Also generate `AUTH_SECRET`.

**4. Prisma, schema-as-a-folder**

- `prisma.config.ts` pointing `schema` at `prisma/schema/` (a directory).
- `prisma/schema/datasource.prisma` — generator + datasource **only**, no models.
  Generator output goes to `lib/generated/prisma`. Add that path to
  `.gitignore` and to `eslint.config.mjs` ignores.
- `lib/db.ts` — the client, cached on `globalThis` in development, with a
  comment saying why.
- No models yet.

**5. Scripts** in `package.json`:

```
dev, build (prisma generate && next build), start, lint,
typecheck   → next typegen && tsc --noEmit
test        → vitest run --passWithNoTests
format      → prettier --write .
format:check → prettier --check .
db:generate, db:migrate, db:reset, db:studio,
db:seed     → tsx prisma/seed.ts
db:seed:config → tsx prisma/seed-config.ts
```

`--passWithNoTests` only matters at this scaffolding stage, when no module has
written a test yet — drop it once the first `*.test.ts` lands, so an empty
suite starts failing the gate again instead of hiding one.

**6. TypeScript strictness.** In `tsconfig.json` turn on `strict`,
`noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`. We are going to write 80 tables against this; loose
types will cost more later than they save now.

**7. Write `AGENTS.md`** — I am pasting the full contents in my next message.
Also write `CLAUDE.md` containing exactly `@AGENTS.md`.

**8. Directory skeleton**, empty but present, each with a one-line `README.md`
saying what belongs there and what does not:
`modules/`, `lib/`, `lib/i18n/core/`, `lib/i18n/dictionaries/`,
`components/{ui,form,data-table,charts,shell,shared,print,providers}/`,
`app/(auth)/`, `app/(dashboard)/`, `app/(print)/`, `prisma/schema/`, `prisma/seed/`.

**Gate — do not report done until all five are green:**

```
npm run typecheck && npm run lint && npm run format:check && npm run build && npx prisma validate
```

(`npm run test` joins this gate once prompt 03 or later adds the first test
file — running it now over an empty suite proves nothing.)

Then `git init`, first commit, and show me the tree of what you created.

## After this prompt

Paste the contents of `promt/AGENTS.md` as your next message.
