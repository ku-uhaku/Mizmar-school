# 07 — `schools`

**Prereqs:** 06.
**Tables:** `School`, `SchoolSettings`. **Routes:** `/schools`, `/schools/new`,
`/schools/[schoolId]`.

---

**`School`** — `organizationId` (Cascade), `code`, `name`,
`level String @default("GROUP")`, `massarCode?` (the ministry identifier),
`email?`, `phone?`, `website?`, `logoUrl?`, `addressLine?`, `city?`, `region?`,
`postalCode?`, `country @default("MA")`, `directorName?`, `capacity Int?`,
`isActive`, timestamps.
`@@unique([organizationId, code])`, `@@unique([organizationId, massarCode])`,
`@@index([organizationId])`, `@@map("schools")`.

**`SchoolSettings`** — `schoolId @unique` (Cascade). One row per school, holding
the school's policies. **This table is load-bearing for six later modules** — do
not treat it as a preferences bag; every field here is read by code:

- grading: `gradingMaxScore Int @default(20)`, `passMarkBps Int @default(5000)`
- calendar: `teachingDays String @default("1,2,3,4,5,6")` (ISO weekday numbers)
- money: `currencyCode @default("MAD")`, `defaultInstalmentCount Int @default(9)`,
  `feeDueDayOfMonth Int @default(5)`
- locale/UI: `defaultLocale @default("fr")`, `defaultAccent @default("blue")`
- **code formats**: `studentCodeFormat @default("E-{year}-{seq:4}")`,
  `familyCodeFormat @default("F-{year}-{seq:4}")`,
  `staffCodeFormat @default("P-{year}-{seq:4}")`
- timetable geometry: `periodMinutes @default(60)`, `dayStartsAt @default("08:00")`,
  `afternoonStartsAt @default("14:00")`, `periodsBeforeBreak @default(2)`,
  `breakMinutes @default(15)`, `morningPeriods @default(4)`,
  `afternoonPeriods @default(4)`
- payroll: `payrollWorkingDays @default(26)`, `cnssRateBps @default(448)`,
  `cnssCeilingCentimes @default(600000)`, `amoRateBps @default(226)`,
  `irRateBps @default(0)` — Moroccan social contributions

**`lib/school-settings.ts`** (isomorphic) + `lib/school-settings-server.ts`
(cached loader). Exports `DEFAULT_SETTINGS`, `settingsOf(school)`,
`passMarkOf`, `isPassingScore`, `parseTeachingDays`, `teachingDaysOf`,
`isTeachingDayIn`, `dueDayOf`, and the code-format engine:
`formatEntityCode(format, { year, seq })`, `codePrefixOf`, `sequenceFromCode`,
`codeFormatHasSequence`. Every generated code in the app (`E-2026-0042`,
`F-2026-0007`, `P-2026-0003`) goes through this. **Never format a code inline.**

**Permissions:** `school.view|create|update|delete`. All org-scoped: creating a
school spans schools by definition.

**Nav:** `/schools`, icon `schools`, `administration`, order 12.

**Screens:** list (data-table, filter by active), create, detail with tabs
"Identité" and "Paramètres" — the settings tab is a long form, use `form-nav`.

**Invariants:** deleting a school with any dependent row must fail with a clear
message, not a foreign-key error page. `SchoolSettings` is created in the same
transaction as the school, never lazily.

**Gate:** typecheck/lint/build. Create two schools, edit settings on one, confirm
the other is untouched. Try to delete a school by id from another organisation
and show me that it fails.
