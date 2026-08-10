import { feeRateScopeKey, splitIntoInstalments } from "@/modules/billing/enums";
import {
  defaultInstalmentCount,
  instalmentDueDates,
  monthOrdinal,
  monthsOfYear,
  netAmount,
} from "@/modules/enrolment/enums";

/**
 * How a year's échéancier is worked out, as a pure function.
 *
 * Kept apart from `service.ts` — which does the loading and the writing — so
 * the rule has exactly one implementation. The seed builds schedules too, and a
 * seed that priced pupils by its own logic would produce demo data that the app
 * could never have produced itself.
 *
 * No database, no `server-only`: everything it needs is passed in.
 */

export type FeeTypeInput = {
  id: string;
  /** See modules/billing/enums.ts. Grouping and reporting only — what a charge
   * is *for* no longer decides whether it is billed. */
  kind: string;
  billingCycle: string;
  isMandatory: boolean;
};

/** One charge a family has opted into. See EnrollmentOption. */
export type OptionInput = {
  feeTypeId: string;
  /** Null = from the start of the year. See the note on the column. */
  startsOn: Date | null;
};

export type FeeRateInput = {
  id: string;
  feeTypeId: string;
  amountCentimes: number;
  instalmentCount: number | null;
  /** True: `amountCentimes` is owed on every instalment, not divided across
   * them. See the note on the column. */
  perInstalment: boolean;
  /** `feeRateScopeKey(levelId)` — "" for the every-level price. */
  scopeKey: string;
};

export type ScheduleInput = {
  /** The level the pupil is admitted to, for resolving the level-specific price. */
  levelId: string;
  /**
   * The optional charges this family has signed up for, and from when.
   *
   * This used to be two booleans and two dates, and `isSubscribed` switched on
   * `FeeType.kind` to decide which gated what — so the catalogue was
   * configurable and the opt-ins were not. A charge absent from this list is
   * simply not billed, whatever its kind. See EnrollmentOption.
   */
  options: OptionInput[];
  yearStart: Date;
  yearEnd: Date;
  termCount: number;
  feeTypes: FeeTypeInput[];
  rates: FeeRateInput[];
  /**
   * The school's own billing conventions. Passed in rather than read here, so
   * this stays the pure function the seed and the service both call — see the
   * note at the top.
   */
  instalmentsPerYear: number;
  dueDayOfMonth: number;
};

export type ScheduleLine = {
  feeTypeId: string;
  feeRateId: string | null;
  periodIndex: number;
  dueDate: Date;
  dueMonth: number;
  dueYear: number;
  baseAmountCentimes: number;
  discountBps: number;
  discountCentimes: number;
  amountCentimes: number;
  status: string;
};

/**
 * The opt-in for a charge, or null when the family has not taken it.
 *
 * One lookup where there used to be two `switch (feeKind)` statements — one
 * deciding whether a charge was subscribed, one finding its start month. Both
 * knew the names TRANSPORT and CANTEEN, and neither could be taught a third.
 */
function optionFor(
  feeTypeId: string,
  options: readonly OptionInput[],
): OptionInput | null {
  return options.find((option) => option.feeTypeId === feeTypeId) ?? null;
}

/**
 * Whether a charge's lines are wholly decided by an opt-in, and may therefore
 * be withdrawn again when the family changes their mind.
 *
 * `isMandatory` is the whole test now. It used to be a hardcoded
 * `FLAG_GATED_FEE_KINDS = ["TRANSPORT", "CANTEEN"]`, which meant a school's own
 * optional charge — a club, a uniform — could be subscribed to by nobody and
 * un-subscribed from by nobody: the resync did not recognise it, so a line once
 * added by hand could never be taken off again.
 *
 * Everything mandatory is billed to everyone and is not the subscriber's to
 * drop, which is exactly what this excludes. See `resyncOptionalCharges`.
 */
export function isSubscribable(feeType: { isMandatory: boolean }): boolean {
  return !feeType.isMandatory;
}

export function buildScheduleLines(input: ScheduleInput): ScheduleLine[] {
  const monthsInYear = monthsOfYear(input.yearStart, input.yearEnd).length;
  const levelScope = feeRateScopeKey(input.levelId);
  const allLevelsScope = feeRateScopeKey(null);

  const lines: ScheduleLine[] = [];

  for (const feeType of input.feeTypes) {
    // A charge is billed when the school makes it compulsory, or when this
    // family has asked for it. Nothing here knows what kind of charge it is.
    const option = isSubscribable(feeType)
      ? optionFor(feeType.id, input.options)
      : null;
    if (isSubscribable(feeType) && option === null) continue;

    // The level's own price wins over the "every level" one — that is what
    // makes a null `levelId` on a rate mean a default rather than a competing
    // price.
    const rate =
      input.rates.find(
        (candidate) =>
          candidate.feeTypeId === feeType.id &&
          candidate.scopeKey === levelScope,
      ) ??
      input.rates.find(
        (candidate) =>
          candidate.feeTypeId === feeType.id &&
          candidate.scopeKey === allLevelsScope,
      ) ??
      null;

    // No price this year means the school has not decided what to charge, which
    // is not the same as charging nothing — leave the line out rather than
    // raise a zero the bursar has to hunt down.
    if (!rate || rate.amountCentimes <= 0) continue;

    const count =
      rate.instalmentCount ??
      defaultInstalmentCount(
        feeType.billingCycle,
        monthsInYear,
        input.termCount,
        input.instalmentsPerYear,
      );

    const amounts = rate.perInstalment
      ? Array.from({ length: count }, () => rate.amountCentimes)
      : splitIntoInstalments(rate.amountCentimes, count);
    const dueDates = instalmentDueDates(
      input.yearStart,
      input.yearEnd,
      count,
      input.dueDayOfMonth,
    );

    // A family that joins the canteen in January owes it from January. The
    // instalments before that month are dropped and the rest keep their own
    // amount, so the pro-rata falls out of the calendar rather than being a
    // second, differently-rounded division of the annual figure.
    //
    // `periodIndex` still counts from the top of the year, and deliberately: it
    // is half the (enrolment, feeType, periodIndex) unique the schedule is made
    // idempotent by, so a mid-year start must not renumber January to 1 and
    // collide with the September line of a family that started on time.
    const startsFrom = option?.startsOn ?? null;
    const firstBillableMonth =
      startsFrom === null ? null : monthOrdinal(startsFrom);

    amounts.forEach((amount, index) => {
      const dueDate = dueDates[index];
      if (
        firstBillableMonth !== null &&
        monthOrdinal(dueDate) < firstBillableMonth
      ) {
        return;
      }

      lines.push({
        feeTypeId: feeType.id,
        feeRateId: rate.id,
        periodIndex: index + 1,
        dueDate,
        dueMonth: dueDate.getMonth() + 1,
        dueYear: dueDate.getFullYear(),
        baseAmountCentimes: amount,
        discountBps: 0,
        discountCentimes: 0,
        // No reduction at generation time: who qualifies is decided per pupil,
        // afterwards, in the fee grid.
        amountCentimes: netAmount(amount, 0, 0),
        status: "DUE",
      });
    });
  }

  return lines;
}
