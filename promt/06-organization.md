# 06 — `organization`

**Prereqs:** 01–05.
**Table:** `Organization`. **Route:** `/organization`.

---

The tenant root. One row per customer; everything else in the database is
reachable from it. Small module, and deliberately the first domain one — it is
the template every later module copies.

**Table `Organization`** (`prisma/schema/organization/organization.prisma`):
`id`, `name`, `legalName?`, `ice?`, `taxId?` (Moroccan company identifiers),
`email?`, `phone?`, `website?`, `addressLine?`, `city?`, `region?`, `postalCode?`,
`country String @default("MA")`, `logoUrl?`, `defaultLocale String @default("fr")`,
timestamps. `@@map("organizations")`.

**Permissions:** `organization.view`, `organization.update`.

**Nav:** `/organization`, icon `organization`, section `administration`, order 10,
`orgPermission: ORGANIZATION_VIEW`. Org-scoped — an organisation spans schools,
so a school-scoped grant must never open this.

**Screens:** one page, view + edit in place. Logo via `image-field`.

**Build the full module file set**, because this is the pattern for 25 more:
`module.ts`, `permissions.ts`, `validation.ts` (zod factories that take the
`Dictionary` so messages are translated), `queries.ts` (`server-only`,
`AuthContext`-scoped), `actions.ts` (`"use server"`, `authorizeOrg` as the first
statement, `withActionErrors`), `i18n/{en,fr,ar}.ts`, `components/`, `seed.ts`.

Register it: `modules/registry.ts` + the three dictionary files. Add the
`organization` icon to `NavIcon` and `nav-icon.tsx`.

**Gate:** typecheck/lint/build/`prisma validate`. Then, before moving on, walk me
through this module file by file and tell me which parts every subsequent module
will repeat verbatim. I want the pattern fixed here.
