# 33 — `audit`

**Prereqs:** everything that writes — do it after 32.
**Table:** `ActivityLog`. **Route:** `/audit`.

---

Who changed what. Built late so it can cover every module at once, but written so
no module has to know it exists.

**`ActivityLog`** — deliberately denormalised and deliberately not
foreign-keyed to anything:
`organizationId?`, `schoolId?`, `schoolYearId?`, `actorId?`, `actorLabel`,
`actorEmail?`, `action`, `entity`, `entityId?`, `entityLabel?`,
`changes Json?`, `metadata Json?`, `createdAt`.
Indexes: `[organizationId, createdAt]`, `[schoolId, createdAt]`,
`[actorId, createdAt]`, `[action, createdAt]`, `[entity, entityId, createdAt]`.

**No foreign keys, and labels are copied.** The log must survive the deletion of
what it describes — a log saying "Karim deleted family F-2026-0007" is worthless
if it breaks when the family goes. Put that sentence in a `///` comment; it is
the whole design.

**`lib/audit.ts`** — a **Prisma client extension** wrapping writes, so modules do
not each remember to log:
- `auditExtension(base)` intercepting `create`/`update`/`delete`/`upsert` on the
  models listed in a per-model config (which fields to diff, how to label a row),
- `recordEvent(event)` for the things a CRUD diff cannot express — signed in,
  signed out, permission granted, session closed, payment cancelled, payslip
  approved,
- `parseChanges` / `parseMetadata` for reading them back,
- `type ChangeSet = Record<string, { from: unknown; to: unknown }>`.

**Never log a secret.** `passwordHash` is redacted at the extension level, not at
call sites. Same for anything you would not want in a support export. Test it.

**Actor comes from `getAuthContext()`**, never from an argument — an action
cannot claim to be someone else. Seed and migration writes log with a system
actor label.

**Permissions:** `audit.view` (org-scoped) and `audit.security` for the
authentication events, which are a narrower need than "who edited this pupil".
**Nav:** `/audit`, icon `audit`, `administration`, order 50.

**Screens:** a filterable timeline — actor, action, entity, date range, school —
with a diff view per entry, and an entity history panel reusable from any detail
page ("last 10 changes to this pupil").

**Retention:** a documented `prisma/scripts/prune-audit.ts` deleting entries past
N months, not run automatically. Say why in the README: an audit log that silently
deletes itself is worse than none.

**Gate:** edit a pupil, delete a family, sign in with a wrong password, and show
me all three in the timeline with correct diffs. Confirm the deleted family's
entry still renders. Grep the table for `passwordHash` and show zero rows.
