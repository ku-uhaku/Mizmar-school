# 13 — `dashboard`

**Prereqs:** 06–12. **Use the `dataviz` skill before writing any chart.**
**Owns no tables.** **Route:** `/`.

---

The landing page. Its rule, and the reason it exists this early: **it composes
other modules' counts through their own `queries.ts`, never with its own `where`
clauses.** `modules/dashboard/queries.ts` is the reference implementation of
cross-module reads for the whole app — get it right here and the pattern holds
for 20 more modules.

Right now that means: schools, users, roles, years. Each later prompt adds one
line to this file calling its own module's count function. If a later prompt
makes you write `db.student.count(...)` inside `dashboard`, you have broken the
rule.

**Content, for a user holding everything:** a row of `stat-tile`s, a trend chart,
and a "what needs attention" panel. Each tile is **hidden, not zeroed**, when the
user lacks the permission behind it — a caissier should not learn the pupil count
from a greyed-out card.

**Different people see different dashboards.** Compose from what
`ctx.canInSchool` / `ctx.canOrg` allow, and make the empty case (a brand-new
organisation, nothing seeded) a proper onboarding state pointing at
`/schools/new`, not a wall of zeros.

Nav: `/`, icon `dashboard`, section `main`, order 0, no permission.

**Gate:** typecheck/lint/build. Show me the page as an administrator and as a
user holding only `user.view`, side by side.
