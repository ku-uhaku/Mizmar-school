# System review — school management platform

Audit date: **3 August 2026** · Branch `main` · 542 hand-written TS/TSX files · 29 modules · 60 tables

This document has three audiences and is split accordingly:

| Part | For whom | What it answers |
| --- | --- | --- |
| [1 — Verdict](#1--verdict) | you | how good is this, really |
| [2 — Security](#2--security-audit) | you | what an attacker could do |
| [3 — Operations](#3--operations-the-real-gap) | you | what breaks when it's live |
| [4 — Performance](#4--performance--scale) | you | what breaks at 2 000 pupils |
| [5 — Architecture drift](#5--architecture--documentation-drift) | you | what has rotted since the docs were written |
| [6 — UI / UX](#6--ui--ux-improvements-with-code) | you | concrete code to paste |
| [7 — The modules, explained](#7--the-modules-explained-for-the-client) | **the client** | what each module does, in plain language |

---

## 1 — Verdict

**This is a well-built system.** That is not a courtesy sentence — it is the finding. I went looking for the usual catastrophes and did not find them:

- Authorization is re-derived from the database on **every** request, not read from the token. Deactivating a user takes effect on their next click.
- Every one of the 24 `actions.ts` files authorizes inside the action body, not on the page.
- Every by-id write I checked re-verifies row ownership **before** writing (`reachableStaff`, `findFirst({ where: { id, schoolId } })`), or uses `updateMany` with a context clause so a crafted id matches zero rows.
- Money is stored in **integer centimes**. No floats anywhere near a balance.
- Login throttling sits in `checkCredentials`, which is the shared path — so `/api/auth/callback/credentials` is throttled too, not just the form action.
- `next.config.ts` ships a real CSP with `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`, HSTS, and a referrer policy chosen because URLs in this app name children.
- The light-mode contrast work is **already done**, measured, and documented in `app/globals.css` with before/after ratios.

The gaps are not in the code. They are in **everything around the code**: there are zero tests, no CI, no backup story, no audit trail, and no error monitoring. A system this carefully written deserves to not lose a day of fee collection to an un-backed-up SQLite file.

**Priority order, honestly:**

1. Backups (§3.1) — you are one disk failure from losing the school year.
2. Audit trail (§2.1) — money changes hands with no record of who.
3. Tests + CI (§3.2, §3.3) — 60 tables and no regression net.
4. Pagination and photo payloads (§4.1) — this breaks at scale, silently.
5. Everything else.

---

## 2 — Security audit

### 2.1 — No audit trail — **HIGH**

This is the most important security gap in the system.

`EnrollmentFee` recently gained a proper cancellation trail, and it is exactly the right shape:

```prisma
cancelledAt   DateTime?
cancelReason  String?
cancelledById String?
cancelledBy   User?     @relation("FeeLineCancelledBy", ...)
```

**Nothing else has one.** These all mutate without recording who:

| What | Where | Why it matters |
| --- | --- | --- |
| Cancelling a payment | `treasury/service.ts:513` `cancelPayment` | money reversed, no name attached |
| Closing a cash session | `treasury/service.ts:271` `closeSession` | the drawer count is the accountability record |
| Recording a disbursement | `treasury/service.ts:626` | cash leaves the building |
| Changing a grade | `assessments/service.ts:469` | a published mark changing silently |
| Deciding leave / salary advances | `hr/actions.ts` | payroll consequences |
| Deleting a role | `access/actions.ts:162` | permission changes |

A school's bursar disputes a cancelled receipt. Today there is no way to answer "who cancelled it, when, and why." That is a governance problem before it is a security one.

**Recommendation — one table, written by the service layer:**

```prisma
// prisma/schema/audit/audit-entry.prisma

/// An append-only record of consequential writes. Never updated, never deleted.
/// Written by the service layer, not by actions — so a write cannot reach the
/// database on a path that skips the log.
model AuditEntry {
  id             String   @id @default(cuid())
  organizationId String
  schoolId       String?

  /// Who. Nullable because a seed or a migration has no actor.
  actorId        String?
  actor          User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)

  /// What: "payment.cancel", "assessment.publish", "role.delete".
  action         String
  /// Which row: the model name and the id, kept as strings so this table
  /// carries no foreign keys to the fifty tables it may describe.
  entityType     String
  entityId       String

  /// Only the fields that changed, as JSON. Never the whole row — a full
  /// snapshot of a pupil would put their birth date in a table with a
  /// different retention rule than the pupil record itself.
  changes        String?
  reason         String?

  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([schoolId, createdAt])
  @@index([entityType, entityId])
  @@index([actorId])
  @@map("audit_entries")
}
```

Then a helper the services call inside the same `$transaction` as the write — so an audit row and its change either both land or neither does:

```ts
// modules/audit/service.ts
import "server-only";

/**
 * Records a consequential write. Takes the transaction client so the entry
 * shares the write's atomicity: there is no path where the change commits and
 * the record of it does not.
 */
export async function recordAudit(
  tx: Prisma.TransactionClient,
  context: AuthContext,
  entry: {
    action: string;
    entityType: string;
    entityId: string;
    changes?: Record<string, unknown>;
    reason?: string;
  },
): Promise<void> {
  await tx.auditEntry.create({
    data: {
      organizationId: context.organization.id,
      schoolId: context.currentSchool?.id ?? null,
      actorId: context.user.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes ? JSON.stringify(entry.changes) : null,
      reason: entry.reason ?? null,
    },
  });
}
```

Start with treasury and assessments. Those two cover the money and the marks, which is where disputes actually happen.

### 2.2 — SVG is an accepted image type — **MEDIUM**

`lib/images.ts:49` accepts `image/svg+xml`, and `checkImageValue` passes any `data:image/…;base64,` URI. An SVG is an XML document that can carry `<script>`.

Today this is contained: the CSP sets `object-src 'none'`, and an SVG referenced from `<img src>` cannot execute script in any current browser. So this is **not currently exploitable**. But it is one refactor away from being so — the day someone inlines a logo with `dangerouslySetInnerHTML` to recolour it, or a user opens the data URI in a new tab directly.

**Fix — drop it from the accepted list:**

```ts
// lib/images.ts
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // SVG is deliberately absent. It is an XML document that can carry script,
  // and these values are stored and replayed into `src` attributes. The picker
  // rasterises everything it accepts anyway, so nothing is lost.
] as const;
```

The client-side picker already resizes through a canvas, which rasterises — so SVG uploads were being converted to raster regardless. The only path this closes is a **pasted** `data:image/svg+xml` URL, which is precisely the crafted case.

### 2.3 — No self-service password reset — **MEDIUM**

There is no forgotten-password flow. Today a locked-out director must be reset by an administrator editing the user record. For a school with one IT-literate person, that person becomes a single point of failure — and in practice this is the pressure that produces shared passwords.

This is a product decision as much as a security one. Two honest options:

- **Admin-initiated reset with a one-time token** — simplest, no mail server needed if the token is read out over the phone. Add `passwordResetToken` + `passwordResetExpiresAt` to `User`, single-use, 30-minute expiry.
- **Email reset** — needs SMTP, which the deployment may not have.

Given the deployment shape (a school running this on its own hardware), the first is the right one. Whichever you pick, keep the throttle in `lib/login-throttle.ts` covering the reset endpoint too — a reset form is a user-enumeration oracle if it says "no such address."

### 2.4 — Seed admin credentials — **MEDIUM (deployment)**

`.env.example` ships:

```
SEED_ADMIN_EMAIL="admin@groupescolaire.ma"
SEED_ADMIN_PASSWORD="Admin123!"
```

That is fine as an example. The risk is that it becomes the production password because nobody was forced to change it. **Add a guard to the seed:**

```ts
// prisma/seed.ts — near the top
const isProduction = process.env.NODE_ENV === "production";
const password = process.env.SEED_ADMIN_PASSWORD;

// A known password in a live deployment is the same as no password. Refuse to
// seed rather than create the account everyone already knows the login for.
if (isProduction && (!password || password === "Admin123!")) {
  throw new Error(
    "SEED_ADMIN_PASSWORD must be set to something other than the example value before seeding a production database.",
  );
}
```

Also worth adding: a `mustChangePassword Boolean @default(false)` on `User`, set on seeded and admin-reset accounts, checked in the dashboard layout.

### 2.5 — No password policy — **LOW**

`hashPassword` uses bcrypt at cost 12, which is correct and current. But nothing enforces a minimum strength on the way in. Check `modules/users/validation.ts` — if the only rule is a length minimum, consider raising it to 12 characters and rejecting the top few thousand common passwords. Do **not** add complexity rules (uppercase/symbol); they measurably produce worse passwords.

### 2.6 — Rate limiting covers only login — **LOW**

`lib/login-throttle.ts` is well done and correctly placed. Nothing else is throttled. The realistic abuse case is not brute force — it is a compromised low-privilege account enumerating pupils through a report or a search endpoint, or hammering a heavy report to degrade the box.

Given a self-hosted, small-user-count deployment, this is genuinely low priority. Note it, and revisit if the app is ever exposed to the open internet rather than a school LAN or VPN.

### 2.7 — Session lifetime — **INFORMATIONAL**

12 hours (`lib/auth.ts`), JWT strategy, token holds only the user id. Revocation works correctly because `loadUser` checks `isActive` on every request. This is a sound design.

The one thing missing is **"sign out everywhere"** — because the token is stateless, a stolen JWT stays valid for up to 12 hours even after a password change. If that matters, add a `sessionsValidFrom DateTime` to `User`, bump it on password change, and compare against the token's `iat` in `loadUser`. Small change, closes the window.

### 2.8 — What is already right (do not regress these)

These are load-bearing and were clearly deliberate. Listed so a future refactor does not quietly undo them:

- `lib/dal.ts` — the whole file. Every authorization decision, re-made per request, from the database.
- `lib/auth.ts:19` — `DUMMY_HASH` compared against when no user matches, so a wrong email costs the same time as a wrong password. Correct defence against user enumeration by timing.
- `lib/auth.ts` — throttle before the bcrypt call, so a locked address costs no CPU.
- `lib/safe-redirect.ts` — resolves `callbackUrl` against a throwaway origin. Correctly handles `//evil.com` and `/\evil.com`, both of which defeat a naive `startsWith("/")`.
- `lib/images.ts` — rejects `data:text/html`, rejects non-`http(s)` protocols. Stops stored XSS via an image column.
- `modules/configuration/actions.ts` — `updateMany`/`deleteMany` with the context `where` instead of `update` by id. A crafted id becomes "not found" instead of a cross-tenant write. This is the right pattern; it should be the house pattern everywhere.
- All 7 print routes under `app/(print)/` authorize with an explicit permission before rendering. Print routes are the classic forgotten door — these are not forgotten.
- `next.config.ts` — the CSP, and the comment explaining honestly why there is no `script-src`. That comment is better engineering than most `script-src` policies.

---

## 3 — Operations: the real gap

The code is production-grade. The operational envelope around it is not yet.

### 3.1 — There is no backup strategy — **CRITICAL**

`dev.db` is 25 MB and holds everything: pupils, fees, payments, payroll, grades. The database is a single file. There is no documented backup, no restore procedure, no test of a restore.

This is the highest-consequence item in this document. A school that loses its fee ledger in March does not recover.

The good news is that SQLite makes this genuinely easy — and `lib/images.ts` already argues (correctly) that keeping images in the database makes a backup one file copy.

**Minimum viable, today:**

```bash
#!/usr/bin/env bash
# scripts/backup.sh — run from cron, hourly during business hours.
set -euo pipefail

DB="${DATABASE_PATH:-./dev.db}"
DEST="${BACKUP_DIR:-/var/backups/school}"
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DEST"

# `.backup` is the only safe way to copy a live SQLite database. `cp` on a file
# with an open write transaction produces a corrupt copy that restores cleanly
# and is silently wrong — which is worse than no backup.
sqlite3 "$DB" ".backup '$DEST/school-$STAMP.db'"
gzip "$DEST/school-$STAMP.db"

# Keep 48 hourly, and the daily 03:00 copy for 90 days.
find "$DEST" -name 'school-*.db.gz' -mmin +2880 -not -name '*-03*' -delete
find "$DEST" -name 'school-*.db.gz' -mtime +90 -delete
```

**Then, in order:**

1. Enable **WAL mode** — better concurrency and a safer backup story:
   ```sql
   PRAGMA journal_mode = WAL;
   ```
   Set it once on the database file; it persists. Worth doing regardless of backups, because it stops readers blocking on a writer, which is exactly what happens when the bursar posts a payment while the director opens a report.
2. **Copy backups off the machine.** A backup on the same disk as the database is not a backup. `rclone`/`rsync` to anywhere else — another PC in the school is fine.
3. **Test a restore.** Once. Write down the steps. An untested backup is a hypothesis.

### 3.2 — Zero tests — **HIGH**

```
$ find . -name "*.test.ts*" -o -name "*.spec.ts*" | wc -l
0
```

Nothing. No framework in `package.json`, no config, no test files. `AGENTS.md:248` states the i18n completeness guarantee "is tested" — that is **not accurate**. The guarantee is real, but it is enforced by the *type system* (the `Dictionary` type is derived from `en`, so a missing key in `fr` or `ar` is a compile error). That is arguably better than a test, but the doc should say what is true.

A green `tsc --noEmit` genuinely covers a lot here — missing translations, unknown permission codes, bad `NavIcon` values. It does not cover **arithmetic**, and this system's arithmetic decides what families are charged.

**Start here — the highest-value tests are pure functions with money in them:**

```bash
npm i -D vitest @vitest/coverage-v8
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],   // so "@/..." resolves the same as in the app
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "lib/generated"],
  },
});
```

**The first twenty tests, ranked by what they would have caught:**

| Priority | Target | Why |
| --- | --- | --- |
| 1 | `modules/enrolment` fee schedule generation | decides what every family owes for a year |
| 2 | `modules/treasury/payment-state.ts` | allocation and outstanding-balance arithmetic |
| 3 | `treasury/service.ts` `expectedCashInDrawer` | the drawer reconciliation |
| 4 | Discount application (bps rounding) | basis-point rounding is where centimes vanish |
| 5 | `lib/safe-redirect.ts` | already correct — lock it in so it stays correct |
| 6 | `lib/images.ts` `checkImageValue` | a security boundary; must not loosen by accident |
| 7 | `modules/assessments` average/coefficient maths | the marks a parent sees |
| 8 | `lib/school-year.ts` date-boundary helpers | inclusive-range bugs, per `runners.server.ts`'s own warning |

These are all pure functions with no database. They are fast, they are easy, and they cover the parts where a bug costs money or trust.

Later, when there is time: a few integration tests that call an action with a forged `schoolId` and assert it returns "not found". That converts the tenancy discipline from a convention into a guarantee.

### 3.3 — No CI — **HIGH**

`.github/workflows/` does not exist. `npm run typecheck` passes right now, which is worth a lot — but nothing enforces that it keeps passing.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push: { branches: [main] }
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      # The client is generated output and is gitignored, so it must be built
      # before anything type-checks.
      - run: npx prisma generate

      - run: npx prisma validate

      # Proves the committed migrations still produce the committed schema —
      # the check AGENTS.md already documents, run automatically.
      - name: Migrations match schema
        run: |
          DIFF=$(npx prisma migrate diff \
            --from-migrations prisma/migrations \
            --to-schema prisma/schema)
          echo "$DIFF"
          echo "$DIFF" | grep -q "No difference detected" || {
            echo "::error::Committed migrations do not reproduce prisma/schema."
            exit 1
          }

      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
```

That migration-drift check is worth more than it looks. It is the one failure mode that survives a green typecheck and only shows up on a fresh deployment.

### 3.4 — No error monitoring — **MEDIUM**

`lib/server-action.ts:36` does `console.error("Server action failed:", error)`. In production that goes to a log file nobody reads. When a bursar says "it didn't work," there is no way to find out what happened.

Cheapest useful fix — write failures to the database, since you already have one:

```prisma
// prisma/schema/audit/error-log.prisma
model ErrorLog {
  id        String   @id @default(cuid())
  message   String
  stack     String?
  /// Which action, so a spike is attributable without reading stack traces.
  action    String?
  userId    String?
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@map("error_logs")
}
```

Hook it into `withActionErrors` where the `console.error` already is. Then a "recent errors" panel under `/organization` gives whoever supports this school a first place to look. Sentry is the fuller answer if the deployment has outbound internet.

### 3.5 — No health check or version marker — **LOW**

Add `app/api/health/route.ts` returning a DB ping and the build SHA. It makes "is it up?" answerable without SSH, and it makes "which version is running?" answerable when a bug report arrives.

---

## 4 — Performance & scale

### 4.1 — Image data URIs are shipped in list payloads — **HIGH**

This one compounds two separately-reasonable decisions into a problem.

`lib/images.ts` stores images as data URIs in the database, capped at 256 KB. That decision is well-argued in its own doc comment and I agree with it for this deployment.

But list queries then select `photoUrl` into every row:

```
modules/students/queries.ts:144      photoUrl: student.photoUrl,
modules/classes/queries.ts:245       photoUrl: enrolment.student.photoUrl,
modules/classroom/queries.ts:356     photoUrl: enrollment.student.photoUrl,
modules/hr/queries.ts:330            photoUrl: person.photoUrl,
modules/assessments/queries.ts:598   photoUrl: true,
modules/families/queries.ts:177      photoUrl: true,
modules/users/queries.ts:77          avatarUrl: ...
```

And `listStudents` has **no pagination**. So `/students` at a 1 200-pupil school serialises 1 200 rows, each carrying a base64 portrait, into the RSC payload. At a realistic 20 KB per photo that is **~24 MB on every page load**. At the 256 KB cap it is 300 MB.

The database file is already 25 MB, which is consistent with photos being stored and this being real rather than theoretical.

**Fix — three steps, in order:**

**a. Stop selecting the photo into list DTOs.** A table row needs initials, not a portrait. Where a list genuinely shows avatars, serve them from a route instead:

```ts
// app/api/student/[studentId]/photo/route.ts
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Serves a pupil's portrait as bytes rather than shipping the data URI inside
 * the list payload. The image is then cacheable by the browser and fetched once
 * per pupil, instead of re-serialised into every render of every screen that
 * mentions them.
 *
 * Authorized like any other read of a pupil — a portrait is personal data and a
 * predictable URL is not a permission.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const context = await requireAuth();
  if (!context.can(PERMISSIONS.STUDENT_VIEW)) notFound();

  const student = await db.student.findFirst({
    // Scoped, never by bare id — the same rule the actions follow.
    where: { id: studentId, schoolId: context.currentSchool?.id },
    select: { photoUrl: true, updatedAt: true },
  });

  const value = student?.photoUrl;
  if (!value?.startsWith("data:")) notFound();

  const [header, base64] = value.split(",", 2);
  const mime = header.slice(5).split(";")[0];

  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": mime,
      // Private: this is a child's photograph. No shared cache may hold it.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
```

**b. Paginate the lists.** These `queries.ts` files have no `take:` anywhere:

```
students (433 lines)      ← the big one
assessments (920 lines)
timetable (995 lines)
enrolment (417 lines)
classes (328 lines)
supplies (241 lines)
```

`families`, `hr`, `transport`, `treasury` and `classroom` already paginate — so the pattern exists in the codebase. Apply it to the rest, starting with students.

**c. Consider moving images out of the row.** If photos become universal, a one-column `ImageBlob` table keyed by id keeps `Student` rows small, so `findMany` over pupils stops dragging portraits through memory even when they are not selected. Only worth it after (a) and (b); those two solve most of it.

### 4.2 — SQLite write concurrency — **MEDIUM**

`better-sqlite3` is synchronous and SQLite takes a database-level write lock. During enrolment season — several people posting payments at once — writers serialise. With the default rollback journal, readers block too.

Two settings, applied once:

```ts
// lib/db.ts — inside createClient()
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

// WAL lets readers proceed while a writer holds the lock — which is the exact
// contention this app has: long report reads against short payment writes.
// `busy_timeout` makes a blocked writer wait rather than immediately throwing
// SQLITE_BUSY, which is what a bursar experiences as "it didn't work".
```

Apply `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;` on connection. Check the `@prisma/adapter-better-sqlite3` options for the supported hook — if it exposes none, run the pragmas once against the file (WAL persists in the file header; `busy_timeout` is per-connection and does need the hook).

This is also a prerequisite for the backup script in §3.1 to be safe under load.

### 4.3 — No loading states — every navigation blocks — **MEDIUM**

```
$ find app -name "loading.tsx" | wc -l
0
$ grep -rl "Suspense" app/ modules/ | wc -l
0
```

Not one `loading.tsx`, not one `<Suspense>`. Every navigation waits for the full server render — including `getAuthContext`, which alone does a user read with four nested includes, plus schools, plus school years, plus settings. On a heavy screen like the timetable grid or a report, the user clicks and the interface simply does nothing for a second or more.

You already have `components/ui/skeleton.tsx`. It is unused for this.

**Fix — one file per route group, ~10 lines each:**

```tsx
// app/(dashboard)/students/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Rendered instantly on navigation while the server builds the real page.
 * Mirrors the finished layout's shape so the transition is a fill-in rather
 * than a jump.
 */
export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-2 rounded-xl ring-1 ring-foreground/10 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
```

Add one to each of `/students`, `/families`, `/classes`, `/timetable`, `/caisse`, `/hr`, `/assessments`, `/transport`, `/reports`. This is perhaps two hours of work and it is the single largest perceived-speed improvement available.

Then, for screens where one panel is slow and the rest is fast — the dashboard is the obvious case — wrap the slow panel in `<Suspense>` so the fast half paints immediately:

```tsx
<Suspense fallback={<StatCardSkeleton />}>
  <TreasurySummary />       {/* the expensive aggregate */}
</Suspense>
```

### 4.4 — Files that have outgrown their module — **LOW**

| File | Lines |
| --- | --- |
| `modules/reports/runners.server.ts` | 2 596 |
| `modules/configuration/resources.ts` | 1 647 |
| `modules/treasury/queries.ts` | 1 585 |
| `modules/timetable/service.ts` | 1 449 |
| `modules/treasury/components/payment-console.tsx` | 1 141 |

None of these is *wrong* — `runners.server.ts` is a flat registry of report runners, which is a legitimate shape for a file that is really a table. But `payment-console.tsx` at 1 141 lines of a single client component is worth splitting; it is the screen where an error costs the most and it is currently the hardest to review.

Suggestion for `runners.server.ts` only if it keeps growing: split by domain (`runners/pupils.ts`, `runners/treasury.ts`, `runners/transport.ts`) with the registry re-assembled in one small index. The module boundary stays exactly where it is.

---

## 5 — Architecture & documentation drift

The architecture is genuinely good and the discipline is consistent. I verified:

- No `db` import anywhere in `app/` — pages really are thin. ✅
- No `lib/` file imports a module's `queries.ts`/`service.ts`/`actions.ts`. ✅
- Every `queries.ts` and `service.ts` starts with `import "server-only"`. ✅
- `$transaction` used in 11 modules where multi-row invariants need it. ✅

The two `components/shell/*` files importing `modules/*/actions.ts` (`locale-switcher.tsx`, `user-menu.tsx`) are technically outward-pointing imports from a domain-free folder — but they are the shell wiring the app's own session and locale, which are not domain concepts. I'd leave them and note the exception in `AGENTS.md` rather than contort around it.

### 5.1 — `AGENTS.md` is out of date — **MEDIUM**

This matters more than a docs nit, because `AGENTS.md` is the file that instructs future contributors (human and AI).

**The module inventory lists 19 modules. There are 29.** Missing from the table entirely:

`assessments`, `classroom`, `documents`, `geography`, `hr`, `reports`, `supplies`, `transport`, `treasury`

Those nine include the three biggest subsystems in the app — treasury, HR and transport are roughly a third of the codebase. Someone reading `AGENTS.md` today would conclude this is a pupil-records app with no money in it.

Also wrong or stale:

- `AGENTS.md:248` — "That guarantee is tested." There are no tests (§3.2). The guarantee is enforced by the type system. Say that instead; it is a stronger claim.
- The "Registration points" section says four files. Still true, and still good.
- The routes column omits `/caisse`, `/hr/*`, `/transport/*`, `/teacher/*`, `/assessments`, `/supplies`, `/reports`.

**Add the missing rows:**

```markdown
| **Finance** | | |
| `treasury` | `CashRegister`, `CashSession`, `CashOperation`, `Payment`, `PaymentAllocation`, `PaymentTender`, `Cheque`, `Bank`, `Supplier`, `OperationCategory`, `OperationSubcategory`, `OperationMotif` | `/caisse`, `/caisse/encaissement` |
| **Ressources humaines** | | |
| `hr` | `Staff`, `EmploymentContract`, `StaffAttendance`, `LeaveRequest`, `SalaryPayment`, `SalaryAdvance`, `TeacherSubject` | `/hr`, `/hr/staff`, `/hr/attendance`, `/hr/payroll`, `/hr/advances`, `/hr/paiements` |
| **Logistique** | | |
| `transport` | `Vehicle`, `TransportRoute`, `RouteStop`, `RouteSchedule`, `RouteNeighbourhood`, `TransportSubscription`, `TransportAttendance`, `TransportSchedule`, `FuelRequest` | `/transport`, `/transport/routes`, `/transport/fleet`, `/transport/attendance`, `/transport/consumption` |
| `supplies` | `SupplyList`, `SupplyItem`, `SupplyArticle` | `/supplies` |
| **Enseignant** | | |
| `classroom` | `StudentAttendance`, `StudentRemark` | `/teacher`, `/teacher/attendance`, `/teacher/timetable`, `/teacher/devoirs`, `/teacher/remarks` |
| `assessments` | `Assessment`, `AssessmentType`, `AssessmentGrade` | `/assessments` |
| **Transverse** | | |
| `documents` | `DocumentType`, `StudentDocument` | — (pupil file) |
| `geography` | `City`, `Neighbourhood` | — (edited under `/configuration`) |
| `reports` | `ReportFavourite` | `/reports` |
```

### 5.2 — Uncommitted work in progress — **INFORMATIONAL**

23 modified files and 5 untracked paths on `main`, including two migrations (`fee_line_cancellation_trail`, `report_favourites`) and an entire new `modules/reports/` subsystem. Recent commit messages are all `ok`.

Two suggestions, neither urgent:

- Commit the reports module as its own commit before it grows further — it is 2 600 lines of untracked runner code and one accidental `git checkout` from being gone.
- Commit messages of `ok` cost nothing today and cost real time in a year when you are trying to find when fee cancellation was introduced. Even `feat(enrolment): fee line cancellation trail` would pay for itself once.

---

## 6 — UI / UX improvements, with code

### First, credit where it is due

The design system here is unusually good, and I want to be specific because it changes what "improve the UI" means.

`app/globals.css` contains a documented, **measured** contrast remediation of stock shadcn light mode:

```
page ← card            1.00  →  1.08   cards now lift off the page
muted-foreground       4.73  →  6.00 on card, 5.11 on muted
ring                   2.59  →  4.85   the focus ring was not a visible indicator
destructive on muted   4.01  →  4.64
```

And all six accent colours were re-derived so `--primary` works as **ink**, not just as a fill (amber went 2.73 → 5.08). That is a level of care most commercial products never reach. The reasoning about why `--card` stays pure white — because the chart series were validated against `#ffffff` and moving it would invalidate them silently — is exactly right.

**So: light-mode contrast is already handled.** What follows is not remediation. It is the next layer.

### 6.1 — Cards are flat; add an elevation scale

`components/ui/card.tsx` uses `ring-1 ring-foreground/10` and no shadow at all. Across the whole app there are 24 shadow utilities total, mostly `shadow-none`. The result reads as clean but slightly undifferentiated — nothing on screen says "this panel is above that one."

The `--card` surface is deliberately locked at pure white, so elevation cannot come from lightness. **It should come from shadow** — which also keeps the chart-series validation intact.

Add elevation tokens that differ per mode, since a shadow that reads on white is invisible on near-black:

```css
/* app/globals.css — add to :root, after the colour tokens */

/* Elevation.
   --card is pinned to pure white (see the light-mode note above), so a panel
   cannot lift by getting lighter — the step has to come from shadow. Two
   layers each: a tight contact shadow that defines the edge, and a wider soft
   one that carries the height. Values are tuned for a white surface on the
   0.972 page.

   Dark mode gets the same *scale* with different means. A drop shadow on a
   0.205 card against a 0.145 page is nearly invisible, so depth there comes
   from a brightened top edge (an inset highlight) plus a deeper, more diffuse
   shadow — the way a real surface catches light from above. */
:root {
  --elevation-1:
    0 1px 2px -1px oklch(0 0 0 / 0.06),
    0 1px 3px 0 oklch(0 0 0 / 0.05);
  --elevation-2:
    0 2px 4px -2px oklch(0 0 0 / 0.07),
    0 4px 10px -2px oklch(0 0 0 / 0.07);
  --elevation-3:
    0 4px 8px -4px oklch(0 0 0 / 0.09),
    0 12px 28px -6px oklch(0 0 0 / 0.10);
}

.dark {
  --elevation-1:
    inset 0 1px 0 0 oklch(1 0 0 / 0.04),
    0 1px 3px 0 oklch(0 0 0 / 0.35);
  --elevation-2:
    inset 0 1px 0 0 oklch(1 0 0 / 0.05),
    0 4px 12px -2px oklch(0 0 0 / 0.45);
  --elevation-3:
    inset 0 1px 0 0 oklch(1 0 0 / 0.06),
    0 14px 32px -6px oklch(0 0 0 / 0.55);
}

@theme inline {
  --shadow-elevation-1: var(--elevation-1);
  --shadow-elevation-2: var(--elevation-2);
  --shadow-elevation-3: var(--elevation-3);
}
```

Then apply level 1 as the card default, keeping the ring — the ring defines the edge crisply, the shadow supplies the height:

```tsx
// components/ui/card.tsx
className={cn(
  "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl",
  "bg-card py-(--card-spacing) text-sm text-card-foreground",
  // The ring draws the edge; the shadow supplies the height. Both, because
  // --card cannot lift by lightness — it is pinned to white by design.
  "ring-1 ring-foreground/10 shadow-elevation-1",
  "[--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 …",
  className,
)}
```

Use `shadow-elevation-2` for dialogs and popovers, `shadow-elevation-3` for the command palette. Those currently sit at the same visual height as the page content behind them.

### 6.2 — Interactive cards give no feedback

Cards that are links or open a dialog look identical to cards that are inert. Add an opt-in variant rather than making every card hoverable:

```tsx
// components/ui/card.tsx — extend the signature
function Card({
  className,
  size = "default",
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm";
  /** Set on cards that are clickable, so the surface answers the pointer. */
  interactive?: boolean;
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-interactive={interactive || undefined}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl",
        "bg-card py-(--card-spacing) text-sm text-card-foreground",
        "ring-1 ring-foreground/10 shadow-elevation-1",

        // Interactive cards rise on hover and press back down on click. The
        // ring warms toward the accent so the affordance survives a
        // prefers-reduced-motion setting, which kills the transform but not
        // the colour.
        "data-[interactive]:cursor-pointer",
        "data-[interactive]:transition-[box-shadow,transform,--tw-ring-color]",
        "data-[interactive]:duration-150 data-[interactive]:ease-out",
        "data-[interactive]:hover:-translate-y-px",
        "data-[interactive]:hover:shadow-elevation-2",
        "data-[interactive]:hover:ring-primary/30",
        "data-[interactive]:active:translate-y-0",
        "data-[interactive]:active:shadow-elevation-1",
        "motion-reduce:data-[interactive]:hover:translate-y-0",

        // Keyboard parity: a card reachable by Tab must show the same focus
        // ring every other control uses.
        "data-[interactive]:focus-visible:outline-none",
        "data-[interactive]:focus-visible:ring-2",
        "data-[interactive]:focus-visible:ring-ring",

        "[--card-spacing:--spacing(4)] …",
        className,
      )}
      {...props}
    />
  );
}
```

Note the `motion-reduce:` escape and the `focus-visible` parity — a clickable card that only responds to a mouse is an accessibility regression, and this app is used all day by staff who work fast on a keyboard.

### 6.3 — A stat tile for the dashboard and module landing pages

`/`, `/school-life`, `/hr`, `/transport` and `/caisse` all present counts. A shared tile makes them read as one system and gives the dashboard a spine:

```tsx
// components/shared/stat-tile.tsx
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: string;
  /** Optional secondary line — a comparison, a subtotal, a period. */
  hint?: string;
  /** Direction of change, when there is one to show. */
  trend?: { direction: "up" | "down" | "flat"; label: string };
  className?: string;
};

/**
 * One number, presented consistently wherever the app presents numbers.
 *
 * The figure is tabular-nums so a column of tiles keeps its digits aligned, and
 * the trend colour is paired with a word — never colour alone, because roughly
 * one man in twelve cannot separate the green from the red.
 */
export function StatTile({ label, value, hint, trend, className }: StatTileProps) {
  return (
    <Card size="sm" className={cn("gap-2", className)}>
      <CardContent className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        {(hint || trend) && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  "font-medium",
                  trend.direction === "up" && "text-success",
                  trend.direction === "down" && "text-destructive",
                )}
              >
                {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "—"}{" "}
                {trend.label}
              </span>
            )}
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

Two things to keep when you use it: format every number through `lib/i18n/format.ts` (never `toLocaleString` directly — `AGENTS.md` is right about this, and Arabic numerals depend on it), and keep `tabular-nums` so columns of figures line up.

### 6.4 — Empty states are inconsistent

`components/shell/empty-state.tsx` and `components/shell/states.tsx` both exist, and roughly ten modules reference an empty state — but many screens still render a bare empty table. Pick one component, and give it the three things an empty state needs: what would be here, why it is not, and the button that fixes it.

```tsx
<EmptyState
  icon="students"
  title={t.student.emptyTitle}
  description={t.student.emptyDescription}
  action={
    context.can(PERMISSIONS.STUDENT_CREATE)
      ? { href: "/students/new", label: t.student.create }
      : undefined   // no dead button for someone who may not click it
  }
/>
```

That last line is the detail worth copying everywhere: gate the call-to-action on the same permission the destination requires. Otherwise the empty state teaches a teacher to click a button that will refuse them.

### 6.5 — Smaller UI items

- **Optimistic feedback on money forms.** `payment-console.tsx` is the highest-stakes screen; a submit that appears to do nothing for 800 ms is how double-payments get entered. `useActionState`'s `isPending` into a disabled button with a spinner, minimum.
- **`aria-live` on toast + form errors.** `sonner` is wired up; confirm the error summary in forms is announced, not just rendered.
- **RTL spot-check.** The codebase follows the logical-property rule well. The two places to actually test in Arabic are the timetable grid and the charts — both do arithmetic on positions, and neither is caught by a `grep` for `ml-`.
- **Print stylesheets.** Seven print routes exist and are correctly authorized; confirm each has an explicit `@page` size and margins, since `attestation` and `echeancier` are documents a parent keeps.

---

## 7 — The modules, explained (for the client)

*This section is written to be read aloud in a meeting. No jargon, no file paths.*

---

### The shape of the system

The platform is organised the way a school actually is: an **establishment** (or a group of establishments), running a **school year**, with **pupils** in **classes**, taught by **staff**, paid for through the **cash desk**.

Two ideas explain almost everything else:

**1. A pupil and their year are separate things.**
A child's record — name, date of birth, family — belongs to the child and lasts as long as they attend. What is true of them *this year* — the level, the class, the fee schedule — is a separate record attached to the year.

This is why the system can do things simpler software cannot: a pupil who repeats a year keeps one identity and gains a second enrolment. Last year's class list still works after this year's is drawn up. A parent asking "what did we pay in 2024?" gets an answer, not a shrug.

**2. Everything is scoped to the establishment.**
A director of one school sees their school. A group administrator sees the group. This is not a display filter — it is enforced at the point every piece of data is read, so there is no URL anyone can type that reaches another establishment's records.

---

### Administration

**Organisation** — The group at the top. Its identity, its logo, its establishments.

**Establishments** — Each school in the group: address, crest, and its own settings. Two schools in the same group can run different grading scales, a different teaching week, a different matricule format, and a different number of fee instalments. Nothing is hard-coded to one school's way of working.

**School years** — Opening a year, setting terms, and choosing which is current. The whole application works "inside" the selected year: change the year in the header, and enrolments, timetables, marks and fees all shift with it.

**Users & roles** — Who may sign in, and what each of them may do. Permissions are fine-grained — not "admin or not," but specific abilities: *may view pupils*, *may cancel a receipt*, *may publish marks*. Roles group these into jobs (Director, Bursar, Teacher, Secretary). A user's access can be organisation-wide or limited to one establishment.

The important guarantee: **removing someone's access takes effect on their very next click.** Not when their session expires, not tomorrow. Immediately.

**Configuration** — One screen per configurable list: levels, subjects, rooms, fee types, fee rates, discounts, document types, cities and neighbourhoods, cash operation categories. This is the part that lets the school adapt the system to itself without a developer.

**Reports** — A catalogue of ready reports across pupils, fees, attendance, payroll and transport, each with date ranges and filters, and each exportable. Frequently used ones can be saved as favourites.

---

### Vie scolaire — the pupils

**Familles** — The family file. Guardians, contact details, addresses, and the primary contact. Fees and correspondence attach to the family, so siblings are handled as one household rather than three unrelated accounts.

**Élèves** — The pupil file: civil details, Massar code, photograph, family, and the full history of their time at the school. Their status — enrolled, left, graduated — is *derived* from their enrolments rather than typed in by hand, so it cannot drift out of step with reality.

**Inscriptions** — Enrolling a pupil into a year: the level admitted to, the class and group seated in, and the **complete fee schedule for the year**, written at the moment of enrolment. One line per charge per instalment. Discounts apply per line, and a cancelled line keeps a record of who cancelled it, when, and why.

That last point matters: the fee schedule is fixed at enrolment, so a mid-year change to the price list does not silently rewrite what a family already agreed to pay.

**Classes** — Levels offered this year, classes, groups within a class, and which teacher is assigned to which subject in which class. Class lists print directly.

**Emploi du temps** — Timetables: time slots, the weekly grid, per-class and per-teacher views, room allocation, holidays, teacher unavailability and absences, and one-off exceptions. Prints per class and per teacher.

**Évaluations** — Assessment types, marks entry, coefficients and averages, and controlled publication so marks become visible to families only when the school decides they are final.

**Documents** — Which documents each pupil's file requires, which have been received, and what is still outstanding.

**Fournitures** — Supply lists per level or class, and the articles on them.

---

### Espace enseignant

A deliberately narrow area, built for a teacher who has five minutes between classes and only ever needs their own classes.

- **Attendance** — the daily register, marked in one screen.
- **Timetable** — their own week.
- **Devoirs** — homework set.
- **Remarques** — notes on individual pupils.

Teachers see their own classes and nothing else. That is enforced by the same permission system as everything else, not by hiding menu items.

---

### Finance — la caisse

The most carefully built part of the system, because it is the part where mistakes cost money.

**Cash desk** — Cash registers, and **sessions**: opening with a float, posting movements, and closing with a count. At close, the system shows what the drawer *should* hold against what was actually counted, and the difference. A session is a shift, and it reconciles.

**Encaissement** — Taking payment against a pupil's fee schedule. A payment can be split across several tenders (cash, cheque, transfer) and is allocated across outstanding fee lines. Cheques are tracked through their own lifecycle — received, deposited, cleared, or bounced. Receipts print.

**Décaissement** — Money out: suppliers, expenses, and staff payments, each classified by category, subcategory and motif so the year's spending is analysable rather than a list.

**All amounts are stored in centimes as whole numbers.** No decimal fractions anywhere in the money path, which is the single most common source of accounting errors in software of this kind.

---

### Ressources humaines

**Personnel** — Staff files: civil details, CNSS number, bank details, job role, contract dates. A staff member can be linked to a login account, so a teacher is one person in the system rather than two.

**Contracts** — Employment contracts and their terms.

**Attendance & leave** — Staff presence, leave requests, and the decision on each. Granting leave is a separate permission from requesting it.

**Payroll** — Salary payments, salary advances, and the payment history per employee.

---

### Logistique — transport

**Fleet** — Vehicles, their registration, and the driver assigned — who must be one of that school's own employees.

**Routes** — Routes, stops, schedules, and the neighbourhoods each route serves.

**Subscriptions** — Which pupils travel on which route, and the transport fee that goes with it.

**Attendance** — Boarding and alighting per trip.

**Consumption** — Fuel requests and consumption per 100 km per vehicle, so a vehicle that is quietly costing too much shows up.

---

### What the client should be told about safety

Three things, in plain terms:

1. **Permission is checked every single time, against the database.** Not once at login. If you revoke someone's access while they are logged in, their next click is refused.

2. **Nobody can reach another establishment's data by guessing.** Every read and every write is filtered by what the signed-in person is actually allowed to reach, derived from their account — never from anything the browser sent. A crafted address returns "not found," not somebody else's pupil.

3. **The application refuses to be embedded, sniffed, or used to send data elsewhere.** The security headers are configured deliberately, including a rule that stops the console being loaded invisibly inside another website — the technique used to trick a signed-in director into clicking something they cannot see.

**And the one thing to raise honestly, because it is the client's decision to fund:**

> The system's data lives in a single database file. **There is currently no backup running.** Before this carries a real school year, an automated backup — hourly, copied to a second machine, with a restore that has actually been tested once — needs to be in place. This is inexpensive and it is the difference between a bad afternoon and a lost year.

---

## Appendix — Checklist, in order

| # | Item | Effort | Section |
| --- | --- | --- | --- |
| 1 | Automated SQLite backup, off-machine, restore tested | half a day | §3.1 |
| 2 | Enable WAL + busy_timeout | 1 hour | §4.2, §3.1 |
| 3 | `AuditEntry` table; wire treasury + assessments | 1–2 days | §2.1 |
| 4 | Remove `photoUrl` from list DTOs; add photo route | 1 day | §4.1 |
| 5 | Paginate `students`, `assessments`, `timetable` queries | 1 day | §4.1 |
| 6 | CI workflow (typecheck, lint, build, migration drift) | 2 hours | §3.3 |
| 7 | Vitest + the first 8 money/date tests | 1–2 days | §3.2 |
| 8 | `loading.tsx` for the 9 main routes | 2 hours | §4.3 |
| 9 | Drop SVG from accepted image types | 15 minutes | §2.2 |
| 10 | Production seed-password guard | 30 minutes | §2.4 |
| 11 | Elevation tokens + interactive card variant | half a day | §6.1, §6.2 |
| 12 | Update `AGENTS.md` module inventory | 1 hour | §5.1 |
| 13 | `ErrorLog` table + panel | half a day | §3.4 |
| 14 | Admin-initiated password reset | 1 day | §2.3 |
| 15 | `StatTile`, consistent empty states | 1 day | §6.3, §6.4 |
| 16 | Split `payment-console.tsx` | 1 day | §4.4 |
