# 34 — `reports`

**Prereqs:** 21, 22, 27, 29, 32. **Use the `dataviz` skill.**
**Table:** `ReportFavourite`. **Routes:** `/reports`, `/reports/[reportId]`.

---

One engine, many reports — the same idea as `configuration` (prompt 18) applied
to reading instead of writing.

**`ReportFavourite`** — `userId` (Cascade), `reportId String`, timestamps.
`@@unique([userId, reportId])`. `reportId` is a code from the registry, not a
foreign key: reports are code, not rows.

**`modules/reports/registry.ts`** — each report as data: id, section, title and
description keys, the permission it needs, its parameters (year, term, level,
class, date range), and a `run(ctx, params)` that **calls the owning modules'
`queries.ts`**. Adding a report is one registry entry and one query function in
the module that owns the data. No new route, no new page.

Reports to ship:
- **Effectifs** — pupils by level, class, gender, with year-on-year comparison
- **Recouvrement** — collected vs due by month and by level, ageing buckets
  (0–30, 31–60, 61–90, 90+), the top unpaid families
- **Journal de caisse** — every operation over a period, by rubrique, with the
  opening and closing position
- **Assiduité** — attendance rates by class and by pupil, worst absentees
- **Résultats** — averages by class and by subject, pass rates, distribution
- **Masse salariale** — payroll by month, by job role, employer cost
- **Transport** — occupancy by route, consumption by vehicle

**Every report is scoped by `AuthContext` and gated on the owning module's
permission**, not on a generic `report.view`. `report.view` opens the index; each
report checks its own. A user without `hr.payroll` does not see Masse salariale
in the list at all.

**Output:** on-screen with charts, CSV export via `lib/csv.ts`, and a print view
(prompt 36). One `run` function feeding all three — never three code paths that
can disagree.

**Permission:** `report.view`, school-scoped. **Nav:** `/reports`, icon
`reports`, `administration`, order 15.

**Gate:** run Recouvrement for the seeded year and reconcile its total against
`SELECT SUM(amount_centimes) FROM payment_allocations` by hand. Then add an
eighth report and show me it took only a registry entry.
