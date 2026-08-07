# 21 — `enrolment`

**Prereqs:** 17 (billing), 20 (students), 08 (years). Needs `LevelOffering` from
prompt 22 — **build 22 first if you prefer**, or stub the relation and come back.
**Tables:** `Enrollment`, `EnrollmentFee`.
**No route of its own** — reached through the pupil or the class.

---

The heart of the model. An enrolment is **what is true of a pupil in one year**.

**`Enrollment`** — `studentId` (Cascade), `schoolYearId` (Cascade),
`levelOfferingId` (**Restrict**), `schoolClassId?` (SetNull), `classGroupId?`
(SetNull), `status` (`ACTIVE | SUSPENDED | LEFT | GRADUATED | CANCELLED`),
`enrolledOn`, `leftOn?`, `isRepeating`, `usesTransport`, `usesCanteen`,
`transportStartsOn?`, `canteenStartsOn?`, `notes?`.
**`@@unique([studentId, schoolYearId])`** — one enrolment per pupil per year, and
that constraint is the whole reason a repeating pupil works.
Index `[schoolYearId, status]`.

**`EnrollmentFee`** — one row **per charge per instalment**, written at enrolment.
`enrollmentId` (Cascade), `feeTypeId` (**Restrict**), `feeRateId?` (SetNull),
`periodIndex Int`, `dueDate`, `dueMonth Int`, `dueYear Int`,
`baseAmountCentimes Int`, `discountBps Int @default(0)`,
`discountCentimes Int @default(0)`, `discountId?` (SetNull),
`amountCentimes Int` (the final amount owed),
`status` (`DUE | WAIVED | CANCELLED`), `cancelledAt?`, `cancelReason?`,
`cancelledById?` (SetNull), `notes?`.
`@@unique([enrollmentId, feeTypeId, periodIndex])`, `@@index([dueYear, dueMonth])`.

**Why the schedule is copied, not referenced:** a pupil's bill must not change
when next year's price list is edited. `billing.resolveSchedule()` computes;
enrolment **persists the result**. Put that sentence in a comment on the model.

`dueMonth`/`dueYear` are denormalised from `dueDate` because every ageing report
groups by them and nobody wants `EXTRACT` in a hot query. Say so.

**Service invariants — all in one transaction:**
- `assertYearOpen(schoolYearId)` from prompt 08 — a `CLOSED` year takes no
  enrolments,
- the level offering belongs to that year and that school,
- the class, if given, belongs to that level offering,
- class capacity is not exceeded (warn, do not block — schools overfill),
- the fee schedule is generated once, at creation; re-running must not duplicate,
- **`refreshStudentStatus(studentId)` is called at the end of every write.**

**Cancelling a fee line is not deleting it.** Set `status = CANCELLED` with a
reason and an author. A line with any `PaymentAllocation` (prompt 27) cannot be
cancelled — refuse with a translated message.

**Permissions:** `enrolment.view|create|update|delete|fees`. `enrolment.fees` is
separate because editing what a family owes is a different trust level from
seating a child in a class.

**Screens:** an enrolment sheet opened from the pupil detail and from the class
roster. It shows the generated échéancier before saving — the secretary must see
the nine lines and the total before committing.

**Gate:** enrol a pupil, show me the nine `EnrollmentFee` rows and that they sum
exactly to the expected total. Enrol the same pupil twice and show the
constraint. Enrol them in the next year and confirm two enrolments, one student.
