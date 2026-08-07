# 19 — `families`

**Prereqs:** 07, 09.
**Tables:** `Family`, `Guardian`. **Routes:** `/families`, `/families/new`,
`/families/[familyId]`.

---

The household. It is the billing counterparty — a receipt is issued to a family,
not to a child — so this comes before pupils.

**`Family`** — `schoolId` (Cascade), `code` (generated from
`SchoolSettings.familyCodeFormat`), `name`, `nameAr?`,
`situation` (`MARRIED | DIVORCED | WIDOWED | SEPARATED | OTHER`),
`addressLine?`, `city?`, `postalCode?`, `country @default("MA")`, `phone?`,
`email?`, `notes?`, `isActive`.
`@@unique([schoolId, code])`, `@@index([schoolId, name])`.

**`Guardian`** — `familyId` (Cascade), `relationship` (`FATHER | MOTHER |
GUARDIAN`), `firstName`, `lastName`, `nameAr?`, `nationalId?` (CIN), `phone?`,
`phoneAlt?`, `email?`, `profession?`, `employer?`, `addressLine?`, `city?`,
`isPrimaryContact`, `isEmergencyContact`, `canPickUp Boolean @default(true)`,
`userId?` (→ `User`, **SetNull**, relation `GuardianAccount`), `notes?`,
`isActive`. `@@index([familyId])`, `@@index([lastName])`.

`userId` is how a parent gets a login later. It is nullable and `SetNull`:
deleting a user account must not delete the guardian record.

**Invariants (`service.ts`):**
- exactly one `isPrimaryContact` per family — setting one clears the others in
  the same transaction,
- at least one guardian with a phone number before the family can be saved,
- `code` is generated server-side via `formatEntityCode`, never submitted,
  and allocated inside the transaction so two concurrent creates cannot collide.

**Permissions:** `family.view|create|update|delete`, **school-scoped**.

**Nav:** `/families`, icon `families`, section `vieScolaire`, order 20.

**Screens:**
- list — data-table: code, name, primary contact, phone, number of children,
  balance placeholder (filled in prompt 27). Search by name, phone or code.
- create/detail — the family form with guardians as a repeatable sub-form,
  children listed (read-only here; they are created from `students`), and tabs.

**Gate:** create a family with two guardians, flip the primary contact, confirm
the old one cleared. Confirm two families in different schools can share a code.
