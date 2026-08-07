# 25 — `school-life`

**Prereqs:** 19, 20, 21, 22, 24.
**Owns no tables** — it composes the others.
**Routes:** `/school-life`, plus the **global search** in the header.

---

Two things, both cross-cutting, both deliberately owned by no domain module.

**1. The overview** at `/school-life`: effectifs by level and by class, this
year versus last, dossiers incomplets, pupils with no class, enrolments this
week, gender split. Every number comes from the owning module's `queries.ts` —
same rule as `dashboard` (prompt 13). If you write a `where` clause here naming
another module's table, you have broken it.

Use the `dataviz` skill. `stat-tile` row, a `column-chart` of effectif by level,
a `split-bar` for the gender split, a `meter` per class against capacity.

**2. The global search** — the header slot reserved in prompt 05. A `cmdk`
palette on `⌘K` that searches, in one place: pupils (name in both scripts, code,
Massar code), families (name, code, phone), classes, and staff (from prompt 32,
add it then). Results grouped by type, keyboard navigable, each row linking to
the detail page.

Search rules that matter:
- **scope it** — `schoolScope(ctx)` and, for enrolment-dependent results, the
  current year. A search must never surface another school's pupil.
- **permission-filter it** — a caissier searching a name gets families, not
  medical records. Each result type is gated on its own module's `*.view`.
- debounce, cap at 8 per group, and make it fast: this is the most-used feature
  in the app. Index accordingly and show me the query plan if it is not.

**Nav:** `/school-life`, icon `schoolLife`, `vieScolaire`, order 10.
**Permissions:** none of its own — every panel and every result group is gated on
the owning module's code. Note that in `module.ts`.

Also fill in `/students/[studentId]/dashboard`, stubbed in prompt 20: one pupil,
one page — identity, family, class, dossier, attendance and grades placeholders
(prompts 28–29), and the échéancier with what is paid (prompt 27).

**Gate:** search a pupil by Arabic name and by code. Then sign in as a caissier
and confirm the same search returns families only.
