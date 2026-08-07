# 08 — `school-years`

**Prereqs:** 07.
**Tables:** `SchoolYear`, `Term`. **Route:** `/school-years`.

---

The year is the second axis of the whole app. Almost every operational table is
scoped by `schoolYearId`, so get this right.

**`SchoolYear`** — `schoolId` (Cascade), `name` ("2025-2026"), `startDate`,
`endDate`, `status` (`PLANNED | ACTIVE | CLOSED`), `isDefault Boolean`,
timestamps. `@@unique([schoolId, name])`, `@@index([schoolId])`.

**`Term`** — `schoolYearId` (Cascade), `number Int`, `name`, `nameAr?`,
`massarCode?`, `startDate`, `endDate`, `status` (`PLANNED | ACTIVE | CLOSED`).
`@@unique([schoolYearId, number])`, `@@unique([schoolYearId, massarCode])`.

**Enums:** native Prisma `SchoolYearStatus` and `TermStatus`.

**Invariants — put these in `service.ts`, not in the form:**
- at most one `isDefault` year per school, and at most one `ACTIVE`; setting one
  clears the other in the same transaction,
- `endDate > startDate`,
- terms must sit inside their year and must not overlap each other,
- a `CLOSED` year rejects new enrolments and new payments. Write the check now
  even though those modules do not exist yet — export
  `assertYearOpen(schoolYearId)` from `service.ts` and make later prompts call it.

**`lib/school-year.ts`** — `clampToSchoolYear(date, year)` and
`defaultDateWithin(year)`. Date pickers across the app default to a date inside
the current year rather than today, which is often outside it.

**Nav:** `/school-years`, icon `schoolYears`, `administration`, order 14. No
permission codes of its own — it rides on `school.view` / `school.update`. Say
why in a comment.

**Screens:** list of years with their terms inline, expandable; create/edit both.
A "generate terms" action that splits a year into 2 or 3 balanced terms.

**Gate:** create a year, generate 3 terms, try to make a second year default and
confirm the first flips. Try overlapping terms and confirm the failure message is
translated in all three languages.
