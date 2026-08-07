# 20 — `students`

**Prereqs:** 14, 19.
**Table:** `Student`. **Routes:** `/students`, `/students/new`,
`/students/[studentId]`, `/students/[studentId]/dashboard`.

---

Who a child **is** — not where they sit. Read the identity/year split in
`AGENTS.md` before writing a line: everything year-specific belongs to
`Enrollment` (prompt 21), and nothing in this table may be year-dependent.

**`Student`** — `schoolId` (Cascade), `familyId?` (→ `Family`, **SetNull**),
`code` (from `studentCodeFormat`), `massarCode?`,
`firstName`, `lastName`, `firstNameAr?`, `lastNameAr?`,
`gender` (`MALE | FEMALE`), `birthDate`, `birthCityId?` (→ `City`, **Restrict**),
`neighbourhoodId?` (→ `Neighbourhood`, **Restrict**), `nationality @default("MA")`,
`nationalId?`, `photoUrl?`, `status`, `entryDate?`, `exitDate?`,
— medical: `bloodType?`, `allergies?`, `chronicCondition?`, `medications?`,
  `doctorName?`, `doctorPhone?`, `insurer?`, `hasDisability`, `medicalNotes?`
— schooling history: `previousSchool?`, `previousLevel?`,
  `previousSchoolCityId?` (→ `City`, Restrict), `schoolingType?`, `transferReason?`
— household: `brotherCount?`, `sisterCount?`, `birthRank?`, `livesWith?`,
  `isOrphan`
— `notes?`, `isActive`.

`@@unique([schoolId, code])`, `@@unique([schoolId, massarCode])`, and indexes on
`schoolId`, `familyId`, `neighbourhoodId`, `birthCityId`,
`[schoolId, lastName]`, `[schoolId, status]`.

**`status`** is `PRE_REGISTERED | ENROLLED | LEFT | GRADUATED | ARCHIVED` and is
**derived from the enrolments**. Exactly one writer: `refreshStudentStatus(id)` in
`service.ts`. No form ever submits it; put that in a `///` comment on the column
and make the zod schema for the form physically unable to carry it.

**Age is derived from `birthDate`.** Never store it. `ageFrom()` in `lib/utils.ts`.

**Permissions:** `student.view|create|update|delete`, school-scoped.

**Nav:** `/students`, icon `students`, `vieScolaire`, order 30.

**Screens:**
- list — data-table with faceted filters (status, level, class, gender,
  neighbourhood), search across name in both scripts and code, CSV export.
- create — a long form using `form-nav`: Identité, Famille, Naissance & adresse,
  Scolarité antérieure, Santé, Notes. Photo via `image-field`.
- detail — the same form plus enrolment history (read-only until prompt 21).
- `/students/[studentId]/dashboard` — leave a stub; prompt 25 fills it in.

**Gate:** create a pupil, confirm `status` is `PRE_REGISTERED` and that no
request can set it to `ENROLLED`. Confirm Arabic name search works. Confirm
deleting the family leaves the pupil with a null `familyId`, not deleted.
