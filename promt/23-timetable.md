# 23 — `timetable`

**Prereqs:** 22, 16, 08.
**Tables:** `TimeSlot`, `TimetableEntry`, `TimetableException`, `SchoolWeek`,
`SchoolHoliday`, `TeacherUnavailability`, `TeacherAbsence`.
**Routes:** `/timetable`, `/timetable/availability`.

---

The largest single module before the caisse. Build it in the order below;
each step is verifiable on its own.

**`TimeSlot`** — the grid. `schoolYearId` (Cascade), `dayOfWeek Int` (ISO 1–7),
`session` (`MORNING | AFTERNOON`), `startTime String` ("08:00"), `endTime`,
`scheduleKind` (`STANDARD | RAMADAN`), `position`, `isBreak`, `isActive`.
`@@unique([schoolYearId, scheduleKind, dayOfWeek, startTime])`.
Times are `String "HH:mm"`, not `DateTime` — a slot is a wall-clock position, not
an instant, and timezone arithmetic on it is a bug generator. Comment that.
Generate the grid from `SchoolSettings` (`dayStartsAt`, `periodMinutes`,
`morningPeriods`, `periodsBeforeBreak`, `breakMinutes`, `afternoonStartsAt`,
`afternoonPeriods`, `teachingDays`). `RAMADAN` is a second full grid.

**`TimetableEntry`** — the recurring lesson. `schoolClassId` (Cascade),
`classGroupId?` (Cascade), `timeSlotId` (Cascade), `subjectId` (**Restrict**),
`teacherId?` (SetNull), `roomId?` (SetNull), `termId?` (Cascade),
`weekParity` (`ALL | A | B`), `fromWeek Int?`, `toWeek Int?`, **`bookingKey`**.
`@@unique([schoolClassId, timeSlotId, bookingKey])` where `bookingKey =
nullableKey(classGroupId, weekParity, termId)` — that is what lets two groups of
the same class occupy the same slot while stopping a genuine double-booking.

**Three conflict rules, all in `service.ts`, all checked in one transaction:**
1. a **teacher** cannot be in two places in the same slot,
2. a **room** cannot hold two classes in the same slot,
3. a **class or group** cannot have two lessons in the same slot.
Week parity and term narrow each check — an A-week lesson does not conflict with
a B-week one. Return the conflicting entry in the failure so the UI can say
*which* lesson is in the way, not just "conflict".

**`TimetableException`** — one week's deviation. `schoolClassId`, `classGroupId?`,
`timeSlotId`, `weekStart DateTime`, `kind` (`CANCELLED | REPLACED`), `subjectId?`,
`teacherId?`, `roomId?`, `note?`, `createdById?`, **`scopeKey`** =
`nullableKey(classGroupId)`.
`@@unique([schoolClassId, timeSlotId, weekStart, scopeKey])`.
The base timetable is never edited to record a one-off. Comment it.

**`SchoolWeek`** — `schoolYearId`, `number`, `startsOn`, `endsOn`, `isTeaching`,
`parity` (`A | B`), `label?`. `@@unique([schoolYearId, number])`. Generated from
the year's dates minus holidays; this is what `fromWeek`/`toWeek` count in.

**`SchoolHoliday`** — `schoolYearId`, `name`, `nameAr?`, `startDate`, `endDate`,
`kind` (`SCHOOL_HOLIDAY | PUBLIC_HOLIDAY | EXAM_PERIOD | OTHER`).

**`TeacherUnavailability`** — `teacherId`, `timeSlotId`, `reason?`.
`@@unique([teacherId, timeSlotId])`. Recurring "cannot teach then".

**`TeacherAbsence`** — `schoolId`, `teacherId`, `startDate`, `endDate`,
`kind` (`SICK | LEAVE | TRAINING | OTHER`), `substituteId?` (SetNull), `notes?`.

**Permissions:** `timetable.view`, `timetable.manage`. School-scoped.
**Nav:** `/timetable` order 50, `/timetable/availability`, both `vieScolaire`.

**Screens:** a week grid, switchable between **class**, **teacher** and **room**
views, drag-to-place with the conflict check running before the drop commits,
the week picker showing parity and holidays, and an exceptions layer visibly
distinct from the base grid. `/timetable/availability` edits unavailability and
absences.

**Gate:** build a full week for one class. Then try to put the same teacher in
two rooms at once and show me the message naming the conflicting lesson. Cancel
one lesson for one week and confirm the base grid is unchanged.
