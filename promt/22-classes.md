# 22 — `classes`

**Prereqs:** 15 (academics), 16 (facilities), 08 (years), 09 (users).
**Tables:** `LevelOffering`, `SchoolClass`, `ClassGroup`, `TeachingAssignment`.
**Routes:** `/classes`, `/classes/[classId]`.

---

Where the year-independent cursus meets a real year.

**`LevelOffering`** — "this school runs 3AP, Sciences track, in 2025-2026".
`schoolYearId` (Cascade), `levelId` (**Restrict**), `trackId?` (**Restrict**),
`plannedCapacity Int?`, `isActive`, **`scopeKey`** = `nullableKey(trackId)`.
`@@unique([schoolYearId, levelId, scopeKey])`.

This table is the join that keeps `academics` year-free. Nothing in `academics`
may reference a year, and nothing operational may reference a `Level` directly —
it goes through the offering. Comment it.

**`SchoolClass`** — `levelOfferingId` (Cascade), `schoolId` (Cascade), `code`
("3AP-A"), `massarCode?`, `name?`, `section?`, `capacity Int?`,
`mainTeacherId?` (→ `User`, SetNull, relation `ClassMainTeacher`),
`roomId?` (→ `Room`, SetNull), `isActive`.
`@@unique([levelOfferingId, code])`, `@@unique([schoolId, massarCode])`.

**`ClassGroup`** — a subdivision of a class. `schoolClassId` (Cascade), `code`,
`name?`, `purpose` (`LANGUAGE | LAB | SPORT | SUPPORT | OPTION | OTHER`),
`subjectId?` (SetNull), `capacity Int?`, `isActive`.
`@@unique([schoolClassId, code])`. This is how "the half that does German" works,
and it is why `Enrollment`, `TimetableEntry` and `Assessment` all carry an
optional `classGroupId`.

**`TeachingAssignment`** — who teaches what to whom. `schoolClassId` (Cascade),
`classGroupId?` (Cascade), `subjectId` (**Restrict**), `teacherId` (→ `User`,
Cascade), `weeklyMinutes Int?`, `isPrimary`, **`scopeKey`** =
`nullableKey(classGroupId)`.
`@@unique([schoolClassId, subjectId, teacherId, scopeKey])`.

**Permissions:** `class.view`, `class.roster`. School-scoped. Roster is separate
because moving children between classes is a bigger deal than reading the list.

**Nav:** `/classes`, icon `classes`, `vieScolaire`, order 40.

**Screens:**
- `/classes` — grouped by cycle then level, each class card showing effectif vs
  capacity (a `meter`), main teacher, room.
- `/classes/[classId]` — tabs: **Élèves** (the roster, with a transfer-list to
  move pupils between classes of the same offering, and the seat count updating
  live), **Groupes**, **Enseignements** (assignments per subject, only teachers
  qualified for that subject offered), **Emploi du temps** (read-only, from
  prompt 23).

**Invariants:** a pupil can only be moved to a class under the **same
`LevelOffering`** — moving across levels is a re-enrolment, not a transfer.
Refuse with a translated message. Deleting a class with enrolled pupils is
refused; deactivate instead.

**Gate:** build 3AP-A and 3AP-B, move five pupils between them, confirm the
counts and that a move to 4AP-A is refused. Show the `scopeKey` values written
for an assignment with and without a group.
