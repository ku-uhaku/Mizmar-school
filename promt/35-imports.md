# 35 — `imports`

**Prereqs:** 19, 20, 21, 14.
**Owns no tables.** **Route:** `/students/import`.

---

Schools arrive with a spreadsheet. This is the module that decides whether their
first day with the app is good or terrible.

**`lib/csv.ts`** — `sniffDelimiter` (`,` `;` `\t` — Moroccan Excel exports `;`),
`parseCsv` handling quotes and embedded newlines, `toCsv`, `normaliseHeader`.
UTF-8 with BOM, and Windows-1252 as a fallback with a warning. Arabic must
survive the round trip — test it.

**Four steps, in this order, and never skip step 3:**

1. **Upload & map** — read the header row, propose a column mapping by fuzzy
   name match, let the user correct it, remember the mapping per school.
2. **Validate** — run every row through the same zod schemas the forms use.
   Never a second, laxer validation path for imports; that is how bad data gets
   in. Resolve referentials (level, class, city, neighbourhood) by name or code
   and report unmatched values as errors, not as silent nulls.
3. **Preview** — a table of every row with its status: **create**, **update**
   (matched on Massar code or code), **skip**, **error** with the reason.
   Nothing is written until the user approves this screen.
4. **Commit** — one transaction per batch of ~500 rows, a progress indicator, and
   a downloadable report of what happened, including the generated codes.

**Matching:** Massar code first, then `[schoolId, code]`, then nothing. Never
match on name — two children are called Mohammed Alami.

**Families:** a pupil row may carry guardian columns. Create or reuse the family
by the guardian's CIN or phone, so three siblings in the file end up in **one**
household. Show how many were merged in the report.

**Optionally enrol** in the same run: if the file has a level and a class column
and the user ticks it, create the enrolment and its fee schedule through
`enrolment`'s service — never by writing `EnrollmentFee` here.

**Permission:** `import.students`, school-scoped, granted to Secrétaire and
Directeur only.

**Gate:** import 300 rows with 20 deliberate problems (missing birth date, a
level that does not exist, a duplicate Massar code, an Arabic name, a `;`
delimiter, a BOM). Show me the preview classifying all 20 correctly, that nothing
was written before approval, and that re-importing the same file updates rather
than duplicating.
