# 28 — `classroom`

**Prereqs:** 21, 22, 23.
**Tables:** `StudentAttendance`, `StudentRemark`.
**Routes:** `/teacher`, `/teacher/attendance`, `/teacher/timetable`,
`/teacher/devoirs`, `/teacher/remarks`.

---

The teacher's own space. Different shape from every other module: a teacher is
not an administrator, sees only their own classes, and holds **one** permission.

**`StudentAttendance`** — `enrollmentId` (Cascade — attendance is year-specific,
so it hangs off the enrolment, never off the student), `date`, `timeSlotId?`
(SetNull), `subjectId?` (SetNull), `status` (`PRESENT | ABSENT | LATE | EXCUSED`),
`minutesLate Int?`, `reason?`, `isJustified`, `recordedById?` (SetNull),
**`scopeKey`** = `nullableKey(timeSlotId)`.
`@@unique([enrollmentId, date, scopeKey])` — one mark per pupil per day per slot,
and one daily mark when no slot is given.

**`StudentRemark`** — `enrollmentId` (Cascade), `subjectId?` (SetNull),
`kind` (`BEHAVIOUR | WORK | HEALTH | ATTENDANCE | OTHER`),
`tone` (`POSITIVE | NEUTRAL | CONCERN`), `body`, `occurredOn`,
`isVisibleToFamily Boolean @default(false)`, `authorId?` (SetNull).

`isVisibleToFamily` defaults to **false**. A teacher's note is internal until
someone decides otherwise. Comment it.

**Scoping — the important part.** Every query in this module is scoped by the
signed-in user's `TeachingAssignment` rows and `SchoolClass.mainTeacherId`, not
by school permissions. A teacher holding `classroom.workspace` can read and write
only for pupils they actually teach. Do the scoping in `queries.ts` from
`ctx.user.id`; never accept a class id and trust it.

**Permission:** `classroom.workspace`, school-scoped. One code, because this is a
space rather than a set of operations. Grant it to `Enseignant` in
`system-roles.ts`.

**Nav:** section `enseignant` — `/teacher` (10), `/teacher/attendance` (20),
`/teacher/timetable` (25), `/teacher/devoirs` (30), `/teacher/remarks` (40).

**Screens:**
- `/teacher` — today: my next lessons, classes with attendance not yet taken,
  recent remarks.
- `/teacher/attendance` — pick a lesson from today's timetable, get the roster,
  mark everyone present by default, tap the exceptions. Must work on a phone and
  must be finishable in under 30 seconds for 30 pupils.
- `/teacher/timetable` — the teacher view of the grid, read-only, with this
  week's exceptions applied.
- `/teacher/devoirs` — homework per lesson (no new table: store as a
  `StudentRemark` of kind `WORK` scoped to the class, or add one if you can
  justify it — say which you chose and why).
- `/teacher/remarks` — write and list remarks, with the family-visibility toggle.

**Gate:** sign in as a teacher assigned to two classes. Confirm they see exactly
those two, that a crafted request for a third class's roster is refused, and that
marking attendance twice for the same slot updates rather than duplicating.
