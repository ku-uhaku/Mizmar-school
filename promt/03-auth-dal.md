# 03 — Authentication and the data access layer

**Prereqs:** 01, 02.
**Owns:** `lib/dal.ts`, `lib/auth.ts`, `lib/scope.ts`, `lib/login-throttle.ts`,
`proxy.ts`/middleware, `modules/auth/`, `app/(auth)/login/`.
**Tables:** `LoginAttempt` (this module's only table).

---

This is the most security-sensitive prompt in the pack. Read it twice.

**The rule.** The session cookie carries **only a user id**. Every authorization
decision is re-made from the database on every request. That is what makes
deactivating an account take effect immediately instead of when a token expires.
Never put roles or permissions in the token.

**`LoginAttempt`** — `email @unique`, `failedCount Int @default(0)`,
`lockedUntil DateTime?`, `lastFailedAt DateTime?`. Its own file in
`prisma/schema/auth/`.

**`lib/auth.ts`** — next-auth v5, credentials provider only, JWT strategy,
bcrypt with cost 12. The `authorize` callback:
- looks the user up by email, checks `isActive`,
- on failure increments `LoginAttempt` and, past 5 failures, sets `lockedUntil`
  to now + 15 min with exponential growth,
- on success resets the counter and stamps `lastLoginAt`,
- **returns the same generic error whichever of email or password was wrong**,
  and the same one for a locked account. Never leak which.

**`lib/dal.ts`** — the single authorization surface.

```ts
type AuthContext = {
  user: SessionUser            // id, email, organizationId, isSuperAdmin, profile
  organizationId: string
  schoolId: string | null      // the current school from User.currentSchoolId
  schoolYearId: string | null  // the current year from User.currentSchoolYearId
  orgPermissions: Set<PermissionCode>
  schoolPermissions: Set<PermissionCode>
  canOrg(code): boolean
  canInSchool(code): boolean
  canAnywhere(code): boolean
}
```

- `getAuthContext()` — React `cache()`d, one query per request, returns `null`
  when signed out. Loads the user, their org role, their membership in the
  current school and that role's permissions.
- `requireAuth()` — context or `redirect("/login")`.
- `authorizeOrg(code)`, `authorizeSchool(code)`, `authorizeAnyScope(code)` —
  context or `forbidden()`. **These are what an action calls as the first
  statement of its body.** Write that in a comment: a check on the page that
  renders a form protects nothing, because Server Functions are reachable by
  direct POST.
- `displayName(user)`.
- Super-admin short-circuits `canOrg`, and nothing else.

**`lib/scope.ts`** — `schoolScope(ctx)` → `{ schoolId }`, `yearScope(ctx)` →
`{ schoolYearId }`, `currentSchoolId(ctx)` / `currentSchoolYearId(ctx)` which
throw if absent. Every module's `queries.ts` builds its `where` from these, never
from a value that arrived in the request.

**Middleware / `proxy.ts`** — an optimistic cookie presence check that redirects
to `/login`. Put a comment on it saying it is **never a real gate**; the gate is
`lib/dal.ts`.

**`app/(auth)/login/page.tsx`** — email + password, `useActionState`, three
languages, RTL-correct, a locale switcher, and a `callbackUrl` passed through
`safeCallbackPath()` in `lib/safe-redirect.ts` that accepts **only** same-origin
relative paths. Open redirects are how this class of app gets phished.

**Gate:** typecheck/lint/build, plus show me:
1. what a request with a tampered session cookie does,
2. what a `POST` straight to a server action with no session does,
3. the query count for one authenticated page load (it must be one for the DAL).
