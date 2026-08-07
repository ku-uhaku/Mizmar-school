# 30 — `supplies`

**Prereqs:** 22, 15, 08.
**Tables:** `SupplyArticle`, `SupplyList`, `SupplyItem`.
**Route:** `/supplies`.

---

The back-to-school stationery list, per class, with a review step — because
teachers write them and the direction approves them before they go to families.

**`SupplyArticle`** — the school's catalogue. `schoolId` (Cascade), `code`,
`name`, `nameAr?`, `category` (`NOTEBOOK | STATIONERY | BOOK | ART | SPORT |
HYGIENE | OTHER`), `defaultQuantity Int?`, `notes?`, `position`, `isActive`.
`@@unique([schoolId, code])`. Editable under `/configuration`.

**`SupplyList`** — `schoolId` (Cascade), `schoolYearId` (Cascade),
`schoolClassId` (Cascade), `subjectId?` (**Restrict**), `title`, `notes?`,
`status` (`DRAFT | SUBMITTED | APPROVED | REJECTED | PUBLISHED`),
`authorId?` (SetNull), `reviewedById?` (SetNull), `reviewedAt?`, `reviewNote?`.

**`SupplyItem`** — `listId` (Cascade), `articleId?` (**SetNull**), `label`,
`labelAr?`, `quantity Int?`, `notes?`, `isRequired`, `position`.

`articleId` is optional and `label` is always stored: a teacher may write "un
cahier 96 pages Seyès" that is not in the catalogue, and the list must survive
the article being deleted. That is why the label is copied, not joined. Comment it.

**Workflow (`service.ts`):** the author edits in `DRAFT`, submits, a reviewer
holding `supply.review` approves or rejects with a note, and only `APPROVED`
lists can be `PUBLISHED`. A published list is immutable — changes go through a
new revision. Transitions are checked in the service; the UI only reflects them.

**Permissions:** `supply.view|write|review|delete`, school-scoped.
`write` for teachers, `review` for the direction. Grant accordingly.
**Nav:** `/supplies`, icon `supplies`, `vieScolaire`, order 60.

**Screens:** lists grouped by level then class, with status badges; the editor
with an article picker (`combobox` over the catalogue) plus free-text entry,
drag reordering, and a duplicate-from-last-year action. A printable per-class
list (prompt 36).

**Gate:** write a list as a teacher, submit, approve as a director, publish, then
try to edit it and show the refusal. Confirm deleting a catalogue article leaves
published lists readable.
