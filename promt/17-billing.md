# 17 — `billing`

**Prereqs:** 08, 15.
**Tables:** `FeeType`, `FeeRate`, `Discount`. **No route** — edited under
`/configuration` (prompt 18).

---

The **price list**. It decides what is owed. It does **not** touch money that has
moved — that is `treasury` (prompts 26–27). Hold that line: nothing in this
module ever reads a `Payment`.

**`FeeType`** — the catalogue of charges. `schoolId` (Cascade), `code`, `name`,
`nameAr?`, `kind` (`TUITION | REGISTRATION | INSURANCE | TRANSPORT | CANTEEN |
SUPPLIES | EXAM | OTHER`), `billingCycle` (`ANNUAL | MONTHLY | TERM | ONE_OFF`),
`isMandatory`, `position`, `isActive`. `@@unique([schoolId, code])`.

**`FeeRate`** — the price, **per year and per level**. `schoolYearId` (Cascade),
`feeTypeId` (Cascade), `levelId?` (Cascade — null means "all levels"),
`amountCentimes Int`, `instalmentCount Int?`, `perInstalment Boolean`,
`isActive`, `notes?`, **`scopeKey`** = `nullableKey(levelId)`.
`@@unique([schoolYearId, feeTypeId, scopeKey])`.

`perInstalment` says whether `amountCentimes` is the whole year or one payment.
Getting this backwards silently doubles or divides every family's bill by nine —
put a `///` comment on it and cover it in the gate.

**`Discount`** — `schoolYearId` (Cascade), `code`, `name`, `nameAr?`,
`kind` (`PERCENTAGE | FIXED_AMOUNT`), `percentBps Int?`, `amountCentimes Int?`,
`reason` (`SIBLING | STAFF_CHILD | MERIT | HARDSHIP | EARLY_PAYMENT | OTHER`),
`feeTypeId?` (Cascade — null means "any fee"), `isStackable`, `isActive`,
`notes?`. `@@unique([schoolYearId, code])`.

**Invariants (`service.ts`):** a `PERCENTAGE` discount has `percentBps` and no
`amountCentimes`, and the reverse for `FIXED_AMOUNT` — enforce it, do not trust
the form. `percentBps` is 0–10000. Amounts are never negative.

**The function prompt 21 will call:**
`resolveSchedule(ctx, { schoolYearId, levelId, discountIds })` → the list of
charges a pupil at that level owes this year: for each applicable `FeeRate`, the
instalments with their due dates (from `SchoolSettings.feeDueDayOfMonth` and
`defaultInstalmentCount`), base amount, discount applied, final amount. **Pure
computation, no writes.** Enrolment persists the result; billing only computes
it. That separation is what lets you change next year's prices without rewriting
this year's bills.

**No permission codes** — `configuration.manage`.

**Gate:** unit-check `resolveSchedule` against a worked example: 9 instalments of
800 MAD with a 10% sibling discount, first due 5 October. Show me the rows it
returns and confirm the total reconciles to the centime — no rounding drift
across nine instalments.
