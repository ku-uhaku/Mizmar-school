# Prompt pack — rebuilding the school app from zero

40 prompts. You paste one, Claude builds it, you verify, you paste the next.
Nothing here is code — it is the **specification**, split so each prompt fits
comfortably in one session and ends in something you can look at.

## How to use it

1. Do `00-setup.md` first. It creates the repo and installs `AGENTS.md`.
2. **Copy `AGENTS.md` into the new repo root** as both `AGENTS.md` and a
   `CLAUDE.md` containing only `@AGENTS.md`. Every later prompt assumes Claude
   reads it — that is what keeps 82 tables consistent.
3. Then go in order. Do not skip: each prompt lists its prereqs and they are real.
4. After each prompt, run the gate at the bottom of it. If it is not green, fix
   before moving on. Debt compounds fast at this size.

## Order

| # | File | Builds |
|---|---|---|
| 00 | `00-setup.md` | fresh Next app, Postgres, deps, AGENTS.md |
| 01 | `01-module-system.md` | `defineModule`, registry, permission catalogue |
| 02 | `02-i18n.md` | fr/en/ar dictionaries, RTL, formatters |
| 03 | `03-auth-dal.md` | login, session, `AuthContext`, tenant scoping |
| 04 | `04-design-system.md` | shadcn ui, form kit, data-table, charts |
| 05 | `05-app-shell.md` | sidebar, nav from registry, school/year switcher |
| 06 | `06-organization.md` | `Organization` |
| 07 | `07-schools.md` | `School`, `SchoolSettings` |
| 08 | `08-school-years.md` | `SchoolYear`, `Term` |
| 09 | `09-users.md` | `User`, `Profile` |
| 10 | `10-access.md` | `Role`, `Permission`, `RolePermission`, `Membership` |
| 11 | `11-context.md` | school + year switcher in the header |
| 12 | `12-profile-appearance.md` | self-service profile and theming |
| 13 | `13-dashboard.md` | the landing page |
| 14 | `14-geography.md` | `City`, `Neighbourhood` |
| 15 | `15-academics.md` | `EducationLevel`, `Level`, `Track`, `Subject`, `LevelSubject` |
| 16 | `16-facilities.md` | `Room` |
| 17 | `17-billing.md` | `FeeType`, `FeeRate`, `Discount` |
| 18 | `18-configuration.md` | the generic referential CRUD screens |
| 19 | `19-families.md` | `Family`, `Guardian` |
| 20 | `20-students.md` | `Student` |
| 21 | `21-enrolment.md` | `Enrollment`, `EnrollmentFee` |
| 22 | `22-classes.md` | `LevelOffering`, `SchoolClass`, `ClassGroup`, `TeachingAssignment` |
| 23 | `23-timetable.md` | slots, entries, exceptions, weeks, holidays |
| 24 | `24-documents.md` | `DocumentType`, `StudentDocument` |
| 25 | `25-school-life.md` | the vie-scolaire overview + global search |
| 26 | `26-treasury-core.md` | registers, sessions, operations, rubriques |
| 27 | `27-treasury-payments.md` | encaissement, allocations, cheques, transfers |
| 28 | `28-classroom.md` | the teacher space |
| 29 | `29-assessments.md` | assessments, grades, questions |
| 30 | `30-supplies.md` | supply lists |
| 31 | `31-transport.md` | fleet, routes, runs, subscriptions, fuel |
| 32 | `32-hr.md` | staff, contracts, payroll, advances, leave |
| 33 | `33-audit.md` | the activity log |
| 34 | `34-reports.md` | the reporting screens |
| 35 | `35-imports.md` | CSV student import |
| 36 | `36-print.md` | the print route group |
| 37 | `37-seeds.md` | demo seed + config-only seed |
| 38 | `38-hardening.md` | final audit pass |

## Rules for you, the human

- **Never let a prompt run past its own scope.** If Claude starts building the
  next module, stop it. The whole point of 40 prompts is bounded blast radius.
- **Run `npm run typecheck` yourself** between prompts. It is the cheapest way
  to catch a missing translation or a bad permission code.
- If Claude proposes a schema change to a table owned by an *earlier* prompt,
  make it justify the change and write a migration — not an edit to old SQL.
