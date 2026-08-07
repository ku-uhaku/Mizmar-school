# 27 — `treasury`, part 2: encaissement

**Prereqs:** 26, 21 (`EnrollmentFee`), 19 (families).
**Tables:** `Payment`, `PaymentTender`, `PaymentAllocation`, `Cheque`.
**Routes:** `/caisse/encaissement`, `/caisse/familles`, `/caisse/cheques`.

---

The other half of the caisse: money coming in from families. This is where
`billing` (what is owed) meets `treasury` (what moved).

## Tables

**`Payment`** — one receipt: a family handing over money on one day.
`schoolId` (Cascade), `schoolYearId` (**Restrict**), `familyId?` (SetNull),
`code` (sequential, unique per school), `paidAt`, `totalCentimes Int`,
`status` (`POSTED | CANCELLED`), `cancelledAt?`, `cancelReason?`,
`cancelledById?` (SetNull), `cashSessionId?` (**Restrict**),
`createdById` (**Restrict**), `notes?`. `@@unique([schoolId, code])`.

**`PaymentTender`** — a form of money inside one receipt. `paymentId` (Cascade),
`method` (`CASH | CHEQUE | BANK_TRANSFER`), `amountCentimes Int`, `reference?`,
`bankId?` (SetNull), `bankName?`, `chequeId? @unique` (SetNull).
This is what makes "500 en espèces + 1500 par chèque" **one** receipt instead of
two. Sum of tenders must equal `Payment.totalCentimes` — enforce in the
transaction.

**`PaymentAllocation`** — which fee line this receipt settles.
`paymentId` (Cascade), `enrollmentFeeId` (**Restrict** — a settled line can never
be deleted out from under a receipt), `amountCentimes Int`.
`@@unique([paymentId, enrollmentFeeId])`.

**`Cheque`** — `schoolId` (Cascade), `direction` (`INCOMING | OUTGOING`),
`number`, `bankId?` (SetNull), `bankName?`, `drawerName?`, `amountCentimes Int`,
`issuedOn?`, `dueOn?`, `status` (`PENDING | DEPOSITED | CLEARED | BOUNCED |
CANCELLED`), `depositedOn?`, `settledOn?`, `bounceReason?`, `notes?`.
Indexed on `[schoolId, status]` and `dueOn`.

## Invariants — every one of these in one transaction

1. **Σ tenders = `Payment.totalCentimes`.**
2. **Σ allocations ≤ `Payment.totalCentimes`.** An unallocated remainder is an
   advance on account and is allowed; an over-allocation is not.
3. **No fee line may be over-paid**: for each allocation, Σ of all allocations
   against that `EnrollmentFee` ≤ its `amountCentimes`. Check inside the
   transaction with the row locked, not before it.
4. **Every posted payment writes exactly one `CashOperation`** with
   `kind = COLLECTION`, `paymentId` set (the `@unique` guarantees one-to-one),
   `amountCentimes` = the receipt total, and **`cashImpactCentimes` = the CASH
   tenders only**. A cheque receipt increases revenue and not the drawer.
5. A `CHEQUE` tender **creates a `Cheque` row** in `PENDING` and links it.
6. `assertYearOpen(schoolYearId)` — a closed year takes no payments.
7. A payment can only be attached to an **open** session belonging to the current
   school.

**Cancelling a payment**: `status = CANCELLED` + reason + author, a reversing
`CashOperation` (the mechanism from prompt 26), allocations released so the fee
lines are due again, and any linked cheque cancelled. **Never delete a receipt.**
The receipt code is never reused.

**Cheque lifecycle** (`treasury.cheques`): `PENDING → DEPOSITED → CLEARED`, or
`→ BOUNCED`. A bounce writes a reversing operation for its amount and puts the
fee lines back to due — the money never arrived. Make that a single action, not
three manual steps.

## Screens

**`/caisse/encaissement`** — the till operator's main screen and the one to make
fast:
1. find the family (the `cmdk` search from prompt 25, or by child),
2. see every open `EnrollmentFee` across **all their children**, oldest first,
   with what is already allocated,
3. tick lines or type a total and let it **auto-allocate oldest-due-first**,
4. compose tenders,
5. post, and go straight to the printable receipt (`/print/payment/[id]`,
   prompt 36).

Keyboard-first. A secretary posts sixty of these on the 5th of the month.

**`/caisse/familles`** — balances by family: total owed, total paid, remainder,
oldest unpaid, with filters for "en retard" and "soldé". Every figure derived
from `EnrollmentFee` and `PaymentAllocation`; no stored balance column anywhere.

**`/caisse/cheques`** — the cheque register, filterable by status and due date,
with the deposit and bounce actions and an alert for cheques due this week.

**Permissions:** `treasury.collect`, `treasury.cheques`. Nav under `finance`:
encaissement (20), familles (25), cheques (50).

**Gate — do this one properly:**
- pay a 3-child family 5000 MAD as 2000 cash + 3000 cheque, auto-allocated;
  show me the tenders, the allocations, the single `CashOperation`, and that
  `cashImpactCentimes` is 200000 and not 500000;
- try to allocate 1 centime more than a line owes and show the refusal;
- bounce the cheque and show the fee lines returning to due and the reversal;
- cancel a payment and show that all four tables agree afterwards;
- confirm the till balance still equals the sum of `cashImpactCentimes`.
