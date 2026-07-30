import { feeRateScopeKey, splitIntoInstalments } from "@/modules/billing/enums";
import {
  defaultInstalmentCount,
  instalmentDueDates,
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
  yearStart: Date;
  yearEnd: Date;
  termCount: number;
  feeTypes: FeeTypeInput[];
  rates: FeeRateInput[];
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
      );

    const amounts = splitIntoInstalments(rate.amountCentimes, count);
    const dueDates = instalmentDueDates(input.yearStart, input.yearEnd, count);

    amounts.forEach((amount, index) => {
      const dueDate = dueDates[index];
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
