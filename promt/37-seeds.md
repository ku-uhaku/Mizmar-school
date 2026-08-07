# 37 — Seeding

**Prereqs:** every module. Each already has its own `seed.ts`; this prompt builds
the two orchestrators and makes the whole thing coherent.

---

**Two orchestrators over one set of module seeds.** The split is only in the
orchestration — a module has one seed function, never two.

**`prisma/seed-config.ts`** — what a real school starts from. A school, its
settings, one year with its terms and calendar, the cursus, rooms, cities and
quarters, the fee catalogue and price list, the caisse's tills and rubriques,
document types, assessment types, supply articles, the system roles, and **one
administrator**. No staff, no families, no pupils, no enrolments, no classes, no
timetable, no buses, no receipts.

**`prisma/seed.ts`** — the demonstration, on top of that: ~40 staff, ~250
families, ~400 pupils across all levels, enrolments with full fee schedules, 18
classes with groups and assignments, a complete timetable, a term of attendance
and grades, three bus routes with subscriptions and runs, and **a full year of
caisse activity** — sessions opened and closed, receipts, décaissements,
transfers, cheques at every lifecycle stage, payslips and advances.

Anything that takes a `withOffice`-style switch belongs in the **module's** seed,
never as a second copy in an orchestrator.

**Non-negotiables:**

- **Idempotent.** Upsert on the table's unique constraint, never `create`.
  Running it twice must change nothing. Prove it: print counts before and after
  a second run and show them identical.
- **Never delete.** A school added by hand survives a re-seed. `npm run db:reset`
  is the clean slate.
- **Derived columns through their helpers** — `scopeKey`, `bookingKey`,
  `openKey`, `activeKey`, generated codes, `refreshStudentStatus`. The seed is
  bound by exactly the same invariants as the app. If the seed needs a shortcut
  around a rule, the rule is in the wrong place.
- **Deterministic.** A seeded PRNG, fixed dates relative to the seeded year.
  Two runs on two machines produce identical data.
- **Realistic.** Moroccan names in both scripts (`prisma/seed/names.ts`),
  plausible fee amounts, a believable payment pattern — some families paid up,
  some two months late, some with a sibling discount. Bugs hide in tidy data.

**Also build** `prisma/seed/check.ts` — a verification script asserting the
invariants across the whole seeded database:
- every till balance equals its sum of `cashImpactCentimes`,
- Σ allocations ≤ each fee line's amount, and no line is over-paid,
- every posted `Payment` has exactly one `CashOperation`,
- every transfer group nets to zero,
- no `Enrollment` violates its class's level offering,
- no timetable conflict exists,
- one active contract per employee, one open session per register,
- every `Student.status` matches what `refreshStudentStatus` would write.

Run it as the last line of `npm run db:seed`.

**Gate:** `db:reset && db:seed`, then `db:seed` again, then the check script.
Show me the counts from both runs side by side and the check output.
