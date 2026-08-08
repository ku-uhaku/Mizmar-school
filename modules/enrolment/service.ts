import "server-only";

import { db } from "@/lib/db";
import { dueDayOf } from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import {
  monthKeyFromString,
  monthOrdinal,
  netAmount,
  startOfMonth,
} from "@/modules/enrolment/enums";
import {
  buildScheduleLines,
  FLAG_GATED_FEE_KINDS,
  type ScheduleLine,
} from "@/modules/enrolment/schedule";
import { refreshStudentStatus } from "@/modules/students/service";

/**
 * Writes and invariants for the enrolment module.
 *
 * The centrepiece is `generateFeeSchedule`: enrolling a child writes the whole
 * year's échéancier in one go, from the price list in force that day. Everything
 * else here exists to keep that schedule and the placement honest.
 */

export type { ScheduleLine };

/**
 * Either the ordinary client or a transaction's.
 *
 * Declared here rather than imported from the treasury so the enrolment module
 * keeps no dependency on it: what is owed is this module's business, and the
 * allocations it reads are reached through the relation it already owns.
 */
type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** The sliver of a client `paidOnFeeLine` needs, so it can run either way. */
type AllocationReader = Pick<TxClient, "paymentAllocation">;

/**
 * Works out what a pupil owes for the year, without writing anything.
 *
 * Split out from the write so the enrolment form can show the family exactly
 * what it is signing before it signs, and so the figures on that preview are
 * produced by the code that will produce the rows. The rule itself lives in
 * `schedule.ts`, which is pure — this function only fetches what it needs.
 */
export async function buildFeeSchedule(
  enrollmentId: string,
): Promise<ScheduleLine[]> {
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      usesTransport: true,
      usesCanteen: true,
      transportStartsOn: true,
      canteenStartsOn: true,
      levelOffering: { select: { levelId: true } },
      schoolYear: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          schoolId: true,
          _count: { select: { terms: true } },
        },
      },
    },
  });
  if (!enrolment) return [];

  const { schoolYear } = enrolment;

  const [feeTypes, rates] = await Promise.all([
    db.feeType.findMany({
      where: { schoolId: schoolYear.schoolId, isActive: true },
      orderBy: [{ position: "asc" }, { code: "asc" }],
      select: { id: true, kind: true, billingCycle: true, isMandatory: true },
    }),
    db.feeRate.findMany({
      where: { schoolYearId: schoolYear.id, isActive: true },
      select: {
        id: true,
        feeTypeId: true,
        amountCentimes: true,
        instalmentCount: true,
        perInstalment: true,
        scopeKey: true,
      },
    }),
  ]);

  // The school's own billing conventions, read for the year's school rather
  // than whichever one is selected in the header.
  const settings = await loadSchoolSettings(schoolYear.schoolId);

  return buildScheduleLines({
    levelId: enrolment.levelOffering.levelId,
    usesTransport: enrolment.usesTransport,
    usesCanteen: enrolment.usesCanteen,
    transportStartsOn: enrolment.transportStartsOn,
    canteenStartsOn: enrolment.canteenStartsOn,
    yearStart: schoolYear.startDate,
    yearEnd: schoolYear.endDate,
    termCount: schoolYear._count.terms,
    feeTypes,
    rates,
    instalmentsPerYear: settings.defaultInstalmentCount,
    dueDayOfMonth: dueDayOf(settings),
  });
}

/**
 * Writes the year's échéancier for one enrolment.
 *
 * Default behaviour **adds only what is missing**: re-running after a fee type
 * is added bills the new charge without restating a line whose amount was
 * renegotiated at the desk. `replace` wipes the schedule first, which is the
 * "rebuild from the price list" the bursar asks for after correcting a rate —
 * and which does lose manual edits, deliberately and on request.
 *
 * Returns how many lines were written.
 */
export async function generateFeeSchedule(
  enrollmentId: string,
  { replace = false }: { replace?: boolean } = {},
): Promise<number> {
  const lines = await buildFeeSchedule(enrollmentId);

  return db.$transaction(async (tx) => {
    if (replace) {
      await tx.enrollmentFee.deleteMany({ where: { enrollmentId } });
    }

    if (lines.length === 0) return 0;

    // What makes this idempotent: only the lines that are not already there get
    // written, so the second run of an unchanged year writes nothing at all.
    //
    // Filtered in memory against the (enrollment, feeType, periodIndex) unique
    // rather than with `createMany({ skipDuplicates })`, which the SQLite
    // connector does not support. Both the read and the write are inside the
    // transaction, so a concurrent generation cannot slip between them — and if
    // one did, the unique index is still there to refuse it.
    const existing = await tx.enrollmentFee.findMany({
      where: { enrollmentId },
      select: { feeTypeId: true, periodIndex: true },
    });
    const taken = new Set(
      existing.map((line) => `${line.feeTypeId}:${line.periodIndex}`),
    );

    const fresh = lines.filter(
      (line) => !taken.has(`${line.feeTypeId}:${line.periodIndex}`),
    );
    if (fresh.length === 0) return 0;

    const created = await tx.enrollmentFee.createMany({
      data: fresh.map((line) => ({ ...line, enrollmentId })),
    });

    return created.count;
  });
}

/**
 * Turns a `YYYY-MM` from an option's start-month picker into the date stored on
 * the enrolment, refusing anything the school year does not contain.
 *
 * The month comes from a request, so it is checked against the year rather than
 * trusted: a month before the rentrée would bill an opt-in for months that do
 * not exist, and one after the year ends would bill it for none at all and read
 * as a silently free canteen.
 *
 * The first month of the year is normalised back to null — "from the start" is
 * what null already means, and storing a copy of the year's opening month would
 * stop tracking it if the year's dates are later corrected.
 */
export async function resolveOptionStart(
  schoolYearId: string,
  monthValue: string | null,
): Promise<Date | null> {
  if (!monthValue) return null;

  const key = monthKeyFromString(monthValue);
  if (!key) return null;

  const year = await db.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { startDate: true, endDate: true },
  });
  if (!year) return null;

  const chosen = startOfMonth(key);
  const first = monthOrdinal(year.startDate);
  const last = monthOrdinal(year.endDate);
  const at = monthOrdinal(chosen);

  if (at <= first || at > last) return null;
  return chosen;
}

/**
 * Brings the opt-in charges back in line with the enrolment's flags and start
 * months, after either has been edited.
 *
 * Needed because `generateFeeSchedule` only ever *adds*: it is deliberately
 * add-only so that re-running it cannot restate an amount renegotiated at the
 * desk. But un-ticking the canteen, or moving the bus start from September to
 * January, has to take lines *away*, and leaving them would go on billing a
 * family for a service they told the school they were not taking.
 *
 * Three things keep that from being dangerous:
 *
 *   1. **Only the flag-gated kinds.** Scolarité is billed to everyone and a
 *      club was added by hand; neither is decided by these switches, so neither
 *      is touched. See `FLAG_GATED_FEE_KINDS`.
 *   2. **Only unpaid lines.** A line a receipt has settled is history. It stays,
 *      and the bursar waives or refunds it deliberately — silently deleting it
 *      would leave a posted allocation pointing at nothing. A *cancelled*
 *      receipt has already put its money back, so it holds nothing down.
 *   3. **Only lines the price list would not raise today.** The rebuild is the
 *      authority on what is owed, and anything it still produces is kept as it
 *      stands, discounts and negotiated amounts included.
 *   4. **Only where the rebuild still says something about that charge.** If a
 *      fee type the family is still subscribed to produces no lines at all —
 *      because its rate was retired or deactivated after they signed — the
 *      whole charge is left untouched. A price corrected in November must not
 *      erase what was agreed in September; that is the same rule the copied
 *      `baseAmountCentimes` on EnrollmentFee exists to keep.
 */
export async function resyncOptionalCharges(
  enrollmentId: string,
): Promise<{ added: number; removed: number }> {
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { usesTransport: true, usesCanteen: true },
  });
  if (!enrolment) return { added: 0, removed: 0 };

  const lines = await buildFeeSchedule(enrollmentId);
  const wanted = new Set(
    lines.map((line) => `${line.feeTypeId}:${line.periodIndex}`),
  );
  // The charges the rebuild still has an opinion about. A fee type absent from
  // this set is one the price list has gone quiet on — see reason 4.
  const spokenFor = new Set(lines.map((line) => line.feeTypeId));

  /** Whether the family has withdrawn from a charge outright. */
  const dropped = (kind: string) =>
    (kind === "TRANSPORT" && !enrolment.usesTransport) ||
    (kind === "CANTEEN" && !enrolment.usesCanteen);

  return db.$transaction(async (tx) => {
    const existing = await tx.enrollmentFee.findMany({
      where: { enrollmentId },
      select: {
        id: true,
        feeTypeId: true,
        periodIndex: true,
        feeType: { select: { kind: true } },
        // Only money that still counts, exactly as `canChangeLevel` reads it.
        // Counting every allocation regardless of its receipt meant a cancelled
        // one went on pinning the line for ever: the family withdrew from the
        // bus, the receipt that had paid for it was struck out, and the charge
        // could never be taken off the schedule again — so they kept being
        // billed for a service nobody was providing.
        _count: {
          select: { allocations: { where: { payment: { status: "POSTED" } } } },
        },
      },
    });

    const stale = existing.filter((line) => {
      const kind = line.feeType.kind;

      if (
        !FLAG_GATED_FEE_KINDS.includes(
          kind as (typeof FLAG_GATED_FEE_KINDS)[number],
        )
      ) {
        return false;
      }
      if (line._count.allocations > 0) return false;
      if (wanted.has(`${line.feeTypeId}:${line.periodIndex}`)) return false;

      // Withdrawn outright, or moved out of range by a later start month. The
      // second only counts when the rebuild still prices this charge at all.
      return dropped(kind) || spokenFor.has(line.feeTypeId);
    });

    if (stale.length > 0) {
      await tx.enrollmentFee.deleteMany({
        where: { id: { in: stale.map((line) => line.id) } },
      });
    }

    // What survives after the removals is what the additions must not duplicate
    // — the same in-memory filter `generateFeeSchedule` uses, and for the same
    // reason: the SQLite connector has no `skipDuplicates`.
    const removed = new Set(stale.map((line) => line.id));
    const taken = new Set(
      existing
        .filter((line) => !removed.has(line.id))
        .map((line) => `${line.feeTypeId}:${line.periodIndex}`),
    );

    const fresh = lines.filter(
      (line) => !taken.has(`${line.feeTypeId}:${line.periodIndex}`),
    );

    if (fresh.length > 0) {
      await tx.enrollmentFee.createMany({
        data: fresh.map((line) => ({ ...line, enrollmentId })),
      });
    }

    return { added: fresh.length, removed: stale.length };
  });
}

/**
 * Seats a pupil in a class, or takes them out of one.
 *
 * The class is re-derived from the enrolment's own year, so a class id from
 * another year or another school matches nothing rather than moving a child
 * across the tenant boundary. The group is cleared whenever the class changes —
 * a group of a class the pupil is not in would put them in two rooms at once on
 * the timetable.
 */
export async function assignClass(
  enrollmentId: string,
  schoolClassId: string | null,
  classGroupId: string | null = null,
): Promise<boolean> {
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      schoolYearId: true,
      schoolClassId: true,
      levelOfferingId: true,
    },
  });
  if (!enrolment) return false;

  if (schoolClassId === null) {
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { schoolClassId: null, classGroupId: null },
    });
    return true;
  }

  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: schoolClassId,
      /*
        The class must be one of the pupil's *own* level, not merely one of the
        year's.

        Both pickers already offer only that — the enrolment form clears the
        class when the level changes, saying in its own comment that "the server
        will refuse" a class of the old level, and the roster screen only ever
        offers pupils of the class's level. The server did not refuse it: an id
        posted directly seated a 1AP child in a 2BAC class, where they would
        appear on its list, sit its timetable and be read against its programme
        — while their échéancier went on being priced for 1AP.

        That is the same mismatch `canChangeLevel` exists to prevent, arriving
        by the other door.
      */
      levelOfferingId: enrolment.levelOfferingId,
      levelOffering: { schoolYearId: enrolment.schoolYearId },
    },
    select: { id: true },
  });
  if (!schoolClass) return false;

  // A group is only kept when it belongs to the class being assigned.
  const group =
    classGroupId === null
      ? null
      : await db.classGroup.findFirst({
          where: { id: classGroupId, schoolClassId },
          select: { id: true },
        });

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { schoolClassId, classGroupId: group?.id ?? null },
  });

  return true;
}

/**
 * Recomputes a schedule line's net from its parts.
 *
 * The one place `amountCentimes` is written, so the stored total can never
 * disagree with the base and the reductions beside it.
 */
/**
 * What has actually been paid against a schedule line, cancelled receipts aside.
 *
 * Takes a client so the figure can be read *inside* the transaction that is
 * about to reprice the line. Read on its own connection it is only ever a
 * reading of the past — see the note in `repriceFeeLine` on why that is not
 * enough to decide with.
 */
export async function paidOnFeeLine(
  feeLineId: string,
  client: AllocationReader = db,
): Promise<number> {
  const settled = await client.paymentAllocation.aggregate({
    where: { enrollmentFeeId: feeLineId, payment: { status: "POSTED" } },
    _sum: { amountCentimes: true },
  });

  return settled._sum.amountCentimes ?? 0;
}

export type RepriceFeeLineResult =
  | { ok: true }
  /** The edit would leave the line owing less than has been paid on it. */
  | { ok: false; reason: "ALREADY_PAID"; paidCentimes: number };

export async function repriceFeeLine(
  feeLineId: string,
  input: {
    baseAmountCentimes: number;
    discountBps: number;
    discountCentimes: number;
    discountId: string | null;
    status: string;
    notes: string | null;
    /** Required when the line stops being owed. Ignored when it stays DUE. */
    cancelReason?: string | null;
    /** Who decided. Stamped alongside the reason. */
    actorId?: string | null;
  },
): Promise<RepriceFeeLineResult> {
  const { cancelReason, actorId, ...fields } = input;
  const cancelled = input.status !== "DUE";
  const amountCentimes = netAmount(
    input.baseAmountCentimes,
    input.discountBps,
    input.discountCentimes,
  );

  /*
    ── Money already taken pins the line ──────────────────────────────────────
    Waiving a charge a family has paid, or discounting it below what they handed
    over, used to be allowed — and it made their money disappear. Every "how
    much has this pupil paid" sum reads through lines that are still DUE, so a
    waived one takes its receipts' allocations out of the pupil's total while
    the receipts themselves, and the caisse, still count every centime. The two
    sets of books then disagree by exactly the amount somebody actually paid.

    So the edit is refused while the money is still attached. Cancelling the
    receipt is the way back — it is the one act that puts money back where it
    came from, and it leaves a trail saying so.

    ── Why the check and the write share a transaction ────────────────────────
    They used to be two statements on their own connections, and a receipt that
    committed between them walked straight through a guard that had already
    read zero. The desk waives a line at the same moment the caisse settles it,
    and the money is gone from the pupil's total with the receipt still counting
    it — the exact disagreement the paragraph above exists to prevent, reached
    by timing rather than by permission. `recordPayment` re-reads its lines
    inside its own transaction for the same reason; this is the other half of
    that.
  */
  return db.$transaction(async (tx) => {
    const paidCentimes = await paidOnFeeLine(feeLineId, tx);
    if (paidCentimes > 0 && (cancelled || amountCentimes < paidCentimes)) {
      return { ok: false as const, reason: "ALREADY_PAID" as const, paidCentimes };
    }

    await tx.enrollmentFee.update({
      where: { id: feeLineId },
      data: {
        ...fields,
        amountCentimes,
        /*
          The trail is written and cleared by the same statement that moves the
          status, so the two can never disagree. Reinstating a line wipes it
          rather than leaving a stale "cancelled by" on a charge that is owed
          again — a half-cleared row is what makes the annulations journal lie.
        */
        cancelledAt: cancelled ? new Date() : null,
        cancelReason: cancelled ? (cancelReason ?? null) : null,
        cancelledById: cancelled ? (actorId ?? null) : null,
      },
    });

    return { ok: true as const };
  });
}

/**
 * Carries a reduction forward to every later instalment of the same charge.
 *
 * A reduction is almost never for one month: a sibling discount runs to the end
 * of the year, and granting it month by month is nine identical edits and an
 * eventual mistake. The bursar ticks a box and this writes the rest.
 *
 * Only the *reduction* travels — each month keeps its own base amount, since
 * instalments differ by a centime where the year does not divide evenly, and
 * copying one month's total over the others would quietly change what is owed.
 *
 * Lines already waived or cancelled are left alone: they are not owed, so
 * discounting them would be meaningless and would misreport what was given away.
 *
 * Returns how many later lines were changed.
 */
export async function repriceFollowingLines(
  feeLineId: string,
  input: {
    discountBps: number;
    discountCentimes: number;
    discountId: string | null;
  },
): Promise<number> {
  /*
    Everything reads and writes inside one transaction, for the reason spelled
    out in `repriceFeeLine`. It matters more here than there: this path *skips*
    a line it would underprice rather than refusing outright, so a receipt
    landing between the read and the write produces no error at all — just a
    month quietly repriced below what the family handed over, across as much as
    a year of lines at one tick of the box.
  */
  return db.$transaction(async (tx) => {
    const line = await tx.enrollmentFee.findUnique({
      where: { id: feeLineId },
      select: { enrollmentId: true, feeTypeId: true, periodIndex: true },
    });
    if (!line) return 0;

    const following = await tx.enrollmentFee.findMany({
      where: {
        enrollmentId: line.enrollmentId,
        feeTypeId: line.feeTypeId,
        periodIndex: { gt: line.periodIndex },
        status: "DUE",
      },
      select: {
        id: true,
        baseAmountCentimes: true,
        allocations: {
          where: { payment: { status: "POSTED" } },
          select: { amountCentimes: true },
        },
      },
    });

    /*
      A month the family has already paid something on keeps its price.

      The same rule as `repriceFeeLine`, applied quietly rather than as a
      refusal: a reduction granted in January is carried across the rest of the
      year in one tick, and half the point is that the bursar does not have to
      think about which of those months have been settled. Skipping the ones it
      would push below what has been paid is the answer they would have given
      anyway, and the count returned says how many actually moved.
    */
    const repriceable = following
      .map((later) => ({
        id: later.id,
        amountCentimes: netAmount(
          later.baseAmountCentimes,
          input.discountBps,
          input.discountCentimes,
        ),
        paidCentimes: later.allocations.reduce(
          (total, allocation) => total + allocation.amountCentimes,
          0,
        ),
      }))
      .filter((later) => later.amountCentimes >= later.paidCentimes);

    // One update per row rather than an `updateMany`: the net has to be computed
    // from each row's own base, and `updateMany` cannot write a per-row value.
    for (const later of repriceable) {
      await tx.enrollmentFee.update({
        where: { id: later.id },
        data: {
          discountBps: input.discountBps,
          discountCentimes: input.discountCentimes,
          discountId: input.discountId,
          amountCentimes: later.amountCentimes,
        },
      });
    }

    return repriceable.length;
  });
}

/**
 * Changes an enrolment's status and brings the pupil's own status back in line.
 *
 * The two are written together, always, because `Student.status` is derived
 * from these rows — see modules/students/service.ts.
 */
export async function setEnrolmentStatus(
  enrollmentId: string,
  status: string,
  leftOn: Date | null = null,
): Promise<void> {
  const left = status === "TRANSFERRED" || status === "WITHDRAWN";

  /*
    ── The departure date is stamped once ─────────────────────────────────────
    `leftOn` used to be rewritten on every save, and the enrolment form calls
    this on every save — so a pupil who withdrew on 15 January had their
    departure moved to June the first time somebody edited their notes. Nothing
    said so, because no form shows the field.

    It is not a cosmetic date: it is what an accountant cancels the remaining
    instalments against, and what the radiés report prints. So it is set the day
    the pupil actually leaves and left alone afterwards, and cleared only when
    they come back onto the roll.
  */
  const current = left
    ? await db.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { leftOn: true },
      })
    : null;

  const enrolment = await db.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status,
      leftOn: left ? (current?.leftOn ?? leftOn ?? new Date()) : null,
    },
    select: { studentId: true },
  });

  await refreshStudentStatus(enrolment.studentId);
}

// ── Changing the level after the fact ────────────────────────────────────────

export type LevelChangeGuard =
  /** Nothing has been collected — the schedule may be re-priced freely. */
  | { ok: true }
  /** Money has been taken against this schedule; the level is now frozen. */
  | { ok: false; paidCentimes: number; receipts: number };

/**
 * Whether a pupil's level may still be changed.
 *
 * ── Why the level is not just another field ─────────────────────────────────
 * The whole échéancier is priced *from* the level: `buildScheduleLines` reads
 * the FeeRate for the level admitted to, and writes one row per charge per
 * instalment. Moving a child from 1AP to 2BAC after that leaves fifteen
 * thousand dirhams of tuition on a file the school now charges twenty-five
 * thousand for — silently, because nothing recomputes it. That was the bug this
 * exists to close.
 *
 * ── Why paid means frozen rather than re-priced ─────────────────────────────
 * Where nothing has been collected, re-pricing is safe and correct: no
 * allocation points at the old lines, so they can be torn down and rebuilt.
 *
 * Once a receipt has settled even one instalment, they cannot. A
 * `PaymentAllocation` points at a *particular* schedule line; deleting it would
 * orphan money the school has taken, and restating its amount would change what
 * a family was told they owed after they had paid part of it. That is a
 * re-inscription — a decision with an avoir behind it — and not something a form
 * may do quietly. So the level is refused and the change is left to somebody who
 * will do it deliberately.
 */
export async function canChangeLevel(
  enrollmentId: string,
): Promise<LevelChangeGuard> {
  const allocations = await db.paymentAllocation.findMany({
    where: {
      enrollmentFee: { enrollmentId },
      // Only money that still counts: a cancelled receipt put its money back,
      // so it must not freeze a level it no longer pays for.
      payment: { status: "POSTED" },
    },
    select: { amountCentimes: true, paymentId: true },
  });

  if (allocations.length === 0) return { ok: true };

  return {
    ok: false,
    paidCentimes: allocations.reduce(
      (total, allocation) => total + allocation.amountCentimes,
      0,
    ),
    receipts: new Set(allocations.map((allocation) => allocation.paymentId)).size,
  };
}

/**
 * Re-prices a whole schedule against the level the pupil is now admitted to.
 *
 * Only ever called once `canChangeLevel` has said yes, which is what makes the
 * `replace` safe: with no allocation pointing at any line, tearing the schedule
 * down and rebuilding it loses nothing and leaves the file priced for the level
 * it is actually at.
 *
 * Returns how many lines the new level produced, so the screen can say what it
 * did rather than claiming a silent success.
 */
export async function repriceForLevel(enrollmentId: string): Promise<number> {
  return generateFeeSchedule(enrollmentId, { replace: true });
}
