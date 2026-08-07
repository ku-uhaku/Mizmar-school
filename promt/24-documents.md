# 24 — `documents`

**Prereqs:** 20.
**Tables:** `DocumentType`, `StudentDocument`.
**No route** — the checklist lives on the pupil detail; the types are edited
under `/configuration`.

---

The admissions paperwork checklist. Small, but it is what a secretary actually
looks at every morning.

**`DocumentType`** — `schoolId` (Cascade), `code`, `name`, `nameAr?`,
`isRequired Boolean @default(true)`, `copies Int?`, `notes?`, `position`,
`isActive`. `@@unique([schoolId, code])`, `@@index([schoolId, isActive])`.
Seed the Moroccan set: acte de naissance, certificat de scolarité, fiche
médicale, photos d'identité, CIN du tuteur, certificat de radiation.

**`StudentDocument`** — `studentId` (Cascade), `documentTypeId` (**Restrict**),
`status` (`MISSING | RECEIVED | PENDING | WAIVED`), `receivedOn?`, `reference?`,
`notes?`, `recordedById?` (SetNull).
**`@@unique([studentId, documentTypeId])`** — one row per pupil per type.

**No file upload.** This tracks whether the paper was handed over, not the paper
itself. Say so in a comment so nobody adds a blob column later.

**Derived, not stored:** a pupil's "dossier complet" state is computed from the
required types versus their rows. Expose it as
`dossierStatus(ctx, studentId)` in `queries.ts` and let `students` and
`school-life` call it. Do not add a column.

**Permissions:** `document.view`, `document.manage`. School-scoped.

**Screens:** a checklist section on the pupil detail — every active type listed,
missing ones highlighted, one click to mark received with today's date. Plus a
filter on the pupil list: "dossier incomplet".

**Gate:** add the six types, mark three received for one pupil, confirm the
derived status and that the pupil-list filter finds them.
