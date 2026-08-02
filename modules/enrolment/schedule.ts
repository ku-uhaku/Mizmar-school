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
  /** See modules/billing/enums.ts — decides which opt-in flag gates it. */
  kind: string;
  billingCycle: string;
  isMandatory: boolean;
};

export type FeeRateInput = {
  id: string;
  feeTypeId: string;
  amountCentimes: number;
  instalmentCount: number | null;
  /** `feeRateScopeKey(levelId)` — "" for the every-level price. */
  scopeKey: string;
};

export type ScheduleInput = {
  /** The level the pupil is admitted to, for resolving the level-specific price. */
  levelId: string;
  usesTransport: boolean;
  usesCanteen: boolean;
  /**
   * When each opt-in begins, for a family that signs up after the rentrée. Null
   * means from the start of the year — see the note on `Enrollment`.
   */
  transportStartsOn: Date | null;
  canteenStartsOn: Date | null;
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

/** A charge only some families take. Everything else is billed to everyone. */
function isSubscribed(
  feeKind: string,
  options: { usesTransport: boolean; usesCanteen: boolean },
): boolean {
  switch (feeKind) {
    case "TRANSPORT":
      return options.usesTransport;
    case "CANTEEN":
      return options.usesCanteen;
    // Any other optional charge (a club, a uniform) is opted into per pupil by
    // adding its line by hand; there is no flag for it, and inventing one per
    // charge would put a boolean column on Enrollment for every club a school
    // ever opens.
    default:
      return false;
  }
}

/**
 * The month a subscribed charge starts being owed from, when it is not the
 * start of the year.
 *
 * Only the flag-gated charges can have one: a mandatory fee is owed by everyone
 * from the rentrée, and a club added by hand is added with the months it is
 * wanted for. Null for everything else, which means "from the top".
 */
function subscriptionStartOf(
  feeKind: string,
  options: { transportStartsOn: Date | null; canteenStartsOn: Date | null },
): Date | null {
  switch (feeKind) {
    case "TRANSPORT":
      return options.transportStartsOn;
    case "CANTEEN":
      return options.canteenStartsOn;
    default:
      return null;
  }
}

/**
 * The kinds whose lines are wholly decided by an opt-in flag and its start
 * month, and which may therefore be withdrawn again when either changes.
 *
 * Everything else on a schedule was either billed to everyone or put there by
 * hand, and a resync that removed those would quietly delete a bursar's work —
 * see `resyncOptionalCharges`.
 */
export const FLAG_GATED_FEE_KINDS = ["TRANSPORT", "CANTEEN"] as const;

export function buildScheduleLines(input: ScheduleInput): ScheduleLine[] {
  const monthsInYear = monthsOfYear(input.yearStart, input.yearEnd).length;
  const levelScope = feeRateScopeKey(input.levelId);
  const allLevelsScope = feeRateScopeKey(null);

  const lines: ScheduleLine[] = [];

  for (const feeType of input.feeTypes) {
    if (!feeType.isMandatory && !isSubscribed(feeType.kind, input)) continue;

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

    const amounts = splitIntoInstalments(rate.amountCentimes, count);
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
    const startsFrom = subscriptionStartOf(feeType.kind, input);
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
