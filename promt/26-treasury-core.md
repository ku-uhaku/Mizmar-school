# 26 — `treasury`, part 1: the till

**Prereqs:** 07, 09, 10.
**Tables (this half):** `CashRegister`, `CashSession`, `CashOperation`, `Bank`,
`OperationCategory`, `OperationSubcategory`, `OperationMotif`, `Supplier`.
**Routes:** `/caisse`, `/caisse/decaissement`, `/caisse/transfert`,
`/caisse/registers`, `/caisse/registers/sessions/[sessionId]`.

---

`treasury` is the module that must be right. Read this whole prompt before
writing anything.

## The one rule

**`CashOperation` is the only table on which a balance is ever computed.** No
table anywhere in this app stores a running balance — not `CashRegister`, not
`CashSession`, not `Family`. Every balance in every screen is a `SUM` over
operations. Write that in a `///` comment on `CashRegister` and on
`CashOperation`, because the first person to "optimise" it will break the
reconciliation.

## Tables

**`CashRegister`** — a physical drawer. `schoolId` (Cascade), `code`, `name`,
`nameAr?`, `holderId? @unique` (→ `User`, SetNull), `position`, `isActive`,
`notes?`. `@@unique([schoolId, code])`. Holds no balance.

**`CashSession`** — one opening of a till. `cashRegisterId` (Cascade),
`openedById` (**Restrict**), `openedAt`, `openingFloatCentimes Int`,
`closedById?` (Restrict), `closedAt?`, `countedCentimes Int?`,
`expectedCentimes Int?`, `varianceCentimes Int?`, `status` (`OPEN | CLOSED`),
`wasAutoClosed Boolean`, `notes?`, plus **`openKey String? @unique`**.

`openKey` is the register id while the session is open and `null` once closed —
a partial unique that makes "**one open session per register**" a database
guarantee rather than a race between two tabs. Set it in `lib/db-keys.ts`.
`expectedCentimes` is computed at close from the operations, `varianceCentimes =
counted − expected`, and both are frozen on the row as the record of the count.

**`CashOperation`** — one movement. `schoolId` (Cascade), `cashSessionId?`
(**Restrict**), `kind` (`COLLECTION | DISBURSEMENT | TRANSFER_IN | TRANSFER_OUT |
ADJUSTMENT`), `method` (`CASH | CHEQUE | BANK_TRANSFER`), `amountCentimes Int`,
**`cashImpactCentimes Int @default(0)`**, `label`, `reference?`, `notes?`,
`occurredAt`, `status` (`POSTED | CANCELLED`), `createdById` (**Restrict**),
plus the optional links: `paymentId? @unique` (prompt 27), `categoryId?`,
`subcategoryId?`, `motifId?`, `beneficiaryStaffId?`, `beneficiaryName?`,
`supplierId?`, `bankId?`, `bankAccountLabel?`, `chequeId?`,
`transferGroupId?`, `counterpartRegisterId?`,
`reversesOperationId? @unique` (self-relation `OperationReversal`).

**`amountCentimes` is what moved; `cashImpactCentimes` is what changed in the
drawer.** A 2000 MAD payment by cheque has `amountCentimes = 200000` and
`cashImpactCentimes = 0`. The till balance sums `cashImpactCentimes`; the
revenue figures sum `amountCentimes`. Conflating them is the single most likely
bug in this module — comment both columns.

**Referentials:** `Bank` (`schoolId`, `code`, `name`, `nameAr?`, `agency?`,
`accountNumber?`), `OperationCategory` (`schoolId`, `code`, `name`, `kind`:
`IN | OUT | BOTH`), `OperationSubcategory` (`categoryId` Cascade, `code`, `name`
— `@@unique([categoryId, code])`), `OperationMotif` (`schoolId`, `categoryId?`
SetNull, `code`, `name`), `Supplier` (`schoolId`, `code`, `name`, `kind`:
`VENDOR | LANDLORD | UTILITY | SERVICE | OTHER`, `defaultCategoryId?` Restrict,
`defaultSubcategoryId?` Restrict, `accountRef?`, `phone?`).

Rubriques are **two levels, not a tree** ("Fournitures › Papeterie"). Do not
build a recursive structure; nobody needs the third level and it costs every
query. Register all five referentials in `configuration` under a **Caisse**
section.

## Behaviour

**Opening a session:** `treasury.session`, one per register, opening float
recorded, `openKey` set. Refuse if one is open, naming who opened it and when.

**Closing:** compute expected from the session's operations plus the float,
prompt for the physical count, store both plus the variance. A variance over a
configurable threshold requires a note. **A closed session is immutable** — no
operation may be attached to it afterwards; that is what the `Restrict` on
`cashSessionId` is for.

**Décaissement** (`/caisse/decaissement`, `treasury.disburse`): amount, method,
rubrique › sous-rubrique, motif, beneficiary (a `Supplier`, a `Staff` from
prompt 32, or a free-text name), reference, date. Writes one `CashOperation` with
`kind = DISBURSEMENT` and a **negative** `cashImpactCentimes` when the method is
`CASH`, zero otherwise.

**Transfert** (`/caisse/transfert`, `treasury.transfer`): register → register or
register → bank. Writes **two** operations sharing a `transferGroupId`, in one
transaction: `TRANSFER_OUT` on the source, `TRANSFER_IN` on the destination (for
a bank target, the second carries `bankId` and no counterpart register). Neither
half may exist without the other.

**Cancelling** (`treasury.cancel`): **never delete, never edit.** Write a
reversing operation pointing at the original through `reversesOperationId` and
flip the original's `status` to `CANCELLED` in the same transaction. The `@unique`
on `reversesOperationId` means an operation can be reversed once. A cancellation
in a **closed** session posts the reversal into the currently open one, and says
so on screen.

**Permissions:** `treasury.view|session|disburse|transfer|cancel` here;
`collect` and `cheques` arrive in prompt 27. All **school-scoped**.

**Nav:** section `finance` — `/caisse` (icon `cashRegister`, order 10),
`/caisse/decaissement` (30), `/caisse/transfert` (40), `/caisse/registers` (60).

**Screens:** `/caisse` is the day's dashboard — open sessions, today's in/out,
the till balance, recent operations. `/caisse/registers` lists tills with their
current state; the session detail page is the closing sheet and the printable
count.

**Gate:** open a session, post three décaissements (one cash, one cheque),
transfer to another till, cancel one operation, close the session. Show me:
the SQL for the balance, that it matches the closing count, that the transfer
netted to zero across the two tills, and that the cancelled pair sums to zero.
Then open two sessions on one register from two tabs and show the database
refusing the second.
