# 29 — `assessments`

**Prereqs:** 21, 22, 08 (`Term`), 15 (`LevelSubject` coefficients).
**Tables:** `AssessmentType`, `Assessment`, `AssessmentGrade`,
`AssessmentQuestion`.
**Routes:** `/assessments`, `/assessments/[assessmentId]`.

---

**`AssessmentType`** — the school's exam catalogue. `schoolId` (Cascade), `code`,
`name`, `nameAr?`, `defaultCoefficient Int @default(1)`,
`defaultMaxScore Int @default(20)`, `countsTowardAverage Boolean @default(true)`,
`gradesWholeSubject Boolean @default(false)`,
`allowTeacherCreate Boolean @default(false)`, `colorHex?`, `position`, `isActive`.
`@@unique([schoolId, code])`. Seed: Contrôle continu, Devoir surveillé, Examen,
Oral, Projet. Editable under `/configuration`.

`allowTeacherCreate` is the gate between `assessment.manage` and a teacher adding
their own contrôle — check it in `service.ts`, not only in the UI.

**`Assessment`** — `schoolId`, `schoolClassId` (Cascade), `classGroupId?`
(Cascade), `subjectId` (**Restrict**), `termId` (Cascade), `assessmentTypeId`
(**Restrict**), `sequence Int @default(1)`, `title`, `scheduledOn?`,
`maxScore Int @default(20)`, `coefficient Int @default(1)`,
`status` (`DRAFT | SCHEDULED | GRADING | PUBLISHED | ARCHIVED`),
`teacherId?` (SetNull), `createdById?` (SetNull), `notes?`, **`scopeKey`** =
`nullableKey(classGroupId)`.
`@@unique([schoolClassId, subjectId, termId, assessmentTypeId, sequence, scopeKey])`.

**`AssessmentGrade`** — `assessmentId` (Cascade), `enrollmentId` (Cascade),
`score Float?`, `isAbsent`, `isExcused`, `comment?`, `gradedById?` (SetNull),
`gradedAt?`. `@@unique([assessmentId, enrollmentId])`.

`score` is nullable and separate from `isAbsent`: null means "not yet entered",
absent means "will not be". They average differently. Comment it.

**`AssessmentQuestion`** — `assessmentId` (Cascade), `position`, `text`,
**`pointsQuarters Int`**. `@@unique([assessmentId, position])`.
Points in quarter-marks as an integer, because half and quarter marks are normal
and floats do not sum reliably. Σ questions must equal `maxScore × 4`.

**Averages are derived, never stored.** `queries.ts` exports
`subjectAverage(enrollmentId, subjectId, termId)` and
`termAverage(enrollmentId, termId)`, weighting by assessment coefficient then by
`LevelSubject.coefficient`, skipping types with `countsTowardAverage = false`,
excluding excused absences and counting unexcused ones as zero. Round only at
display, using `SchoolSettings.gradingMaxScore` and `passMarkBps`.

**Status flow:** `DRAFT → SCHEDULED → GRADING → PUBLISHED`. Only `PUBLISHED`
grades are visible to families. `assessment.publish` is its own permission for
exactly that reason.

**Permissions:** `assessment.view|manage|grade|publish|delete`, school-scoped.
Teachers get `view` + `grade` (scoped to their assignments, as in prompt 28).
**Nav:** `/assessments`, icon `assessments`, `vieScolaire`, order 45.

**Screens:** the assessment list filtered by term/class/subject; the detail page
is a **grade entry grid** — one row per pupil, arrow-key navigation, autosave per
cell, absent/excused toggles, and a live distribution chart (`dataviz`) beside it.
A "generate" action creating the same assessment across a class, a level or the
whole year (`CLASS | LEVEL | YEAR`).

**Gate:** create a DS for one class, enter 30 grades including one absent and one
excused, and show me the class average computed by hand matching the query.
Publish it and confirm an unpublished one is invisible to a non-teacher.
