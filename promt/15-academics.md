# 15 — `academics`

**Prereqs:** 07.
**Tables:** `EducationLevel`, `Level`, `Track`, `Subject`, `LevelSubject`.
**No route** — edited under `/configuration` (prompt 18).

---

The curriculum the school is authorised to teach. **Year-independent by design**
— what actually runs in a given year is `LevelOffering`, owned by `classes`
(prompt 22). Keep that line sharp; it is the hardest boundary in the app to hold.

**`EducationLevel`** — the cycle. `schoolId` (Cascade), `cycle`, `name`,
`nameAr?`, `position`, `isActive`. `@@unique([schoolId, cycle])`.
Moroccan cycles: `PRESCOLAIRE`, `PRIMAIRE`, `COLLEGE`, `LYCEE`.

**`Level`** — a year of study (3AP, 1APIC, 2BAC). `educationLevelId` (Cascade),
`schoolId` (Cascade), `code`, `name`, `nameAr?`, `massarCode?`, `gradeYear Int`,
`position`, `isActive`. `@@unique([schoolId, code])`,
`@@unique([schoolId, massarCode])`.

**`Track`** — the filière inside a level (Sciences Maths, Lettres).
`levelId` (Cascade), `code`, `name`, `nameAr?`, `massarCode?`, `position`,
`isActive`. `@@unique([levelId, code])`.

**`Subject`** — `schoolId` (Cascade), `code`, `name`, `nameAr?`, `shortName?`,
`massarCode?`, `parentId?` (self-relation `SubjectComponents`, Cascade — so
"Physique-Chimie" can have components), `colorHex?`, `isLanguage`, `requiresLab`,
`isActive`. `@@unique([schoolId, code])`.

**`LevelSubject`** — the programme: which subject is taught at which level, with
what weight. `levelId` (Cascade), `trackId?` (Cascade), `subjectId` (Cascade),
`coefficient Int @default(1)`, `weeklyMinutes Int?`, `isGraded`, `isEliminatory`,
`position`, **`scopeKey`**. `@@unique([levelId, subjectId, scopeKey])`.

`scopeKey` here is `nullableKey(trackId)`. Without it, Postgres would allow two
rows for the same level+subject with a null track, because NULLs are distinct in
a unique index. Set it through `lib/db-keys.ts`, never inline. This is the first
of six places in the app using this pattern — get the helper right here.

**Queries:** `listLevels(ctx)` with cycle and track counts, `listSubjects(ctx)`,
`programmeFor(ctx, levelId, trackId?)` returning subjects with coefficients — the
last one is consumed by `timetable`, `assessments` and `classes`.

**No permission codes** — edited through `configuration.manage`.

**Gate:** `prisma validate`, plus a seed with a full Moroccan primaire +
collège cursus. Then insert two `LevelSubject` rows with the same level, subject
and a null track, and show me the constraint rejecting the second.
