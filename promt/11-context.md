# 11 — `context`

**Prereqs:** 07, 08, 09, 10.
**Owns no tables** — it writes `User.currentSchoolId` and
`User.currentSchoolYearId`. **No route** — it lives in the header.

---

Small module, large consequences: it decides what every other query in the app
sees.

**The switcher.** In the shell header, two selects: school, then year. The school
list is the schools the user has a `Membership` in (plus all schools if they hold
an org-scoped grant). The year list is the years of the selected school.

**On switching school**, the year must be re-derived — years belong to schools,
so keeping the old `schoolYearId` would point at another school's year. Pick that
school's `isDefault` year, else its `ACTIVE` one, else the most recent. Do it in
one transaction with the school change.

**On first sign-in** with no context set, choose defaults the same way. A user
with no membership and no org grant sees an explicit "no school assigned" state,
not a crash.

**Authorization:** `requireAuth()`, then verify the target school is reachable
from *this* user's memberships before writing it. An id from a request is never
trusted — this is the exact place that rule earns its keep.

Mirror the choice into a cookie so the shell can render the right school name on
first paint without a round-trip, but treat the cookie as a **hint only**;
`lib/dal.ts` reads the database columns.

**Gate:** switch school and confirm the year select repopulates, the sidebar
re-filters to that school's permissions, and every list screen changes. Then
hand-craft a POST with another organisation's school id and show me the refusal.
