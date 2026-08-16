import { startOfDay } from "@/modules/treasury/enums";

/**
 * How a charge stands, and the one colour that says so.
 *
 * Pure data, like `enums.ts`, so the server pages and the client panels agree
 * without either importing the other. Every screen that draws money — the
 * échéancier, the encaissement console, a pupil's payment tab, the family
 * total — resolves its colour through here, so "amber" cannot come to mean
 * *part paid* on one screen and *due soon* on another.
 *
 * The four states are deliberately not three. A family that has paid 800 of a
 * 1 200 instalment is neither settled nor untouched, and collapsing PARTIAL
 * into OVERDUE would put a paying family on the chasing list.
 */
export const PAYMENT_STATES = [
  /** Nothing left to pay on it. */
  "SETTLED",
  /** Something has been paid, the rest is not late yet. */
  "PARTIAL",
  /** Nothing paid, and the due date has not passed. */
  "UPCOMING",
  /** Still owed after the due date — the only state that means "chase this". */
  "OVERDUE",
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

/**
 * Whether a charge's due date has actually passed.
 *
 * ── The one definition of "en retard" in the app ─────────────────────────────
 * There were four, and they disagreed. Three compared the due date against
 * *this instant* (`<= now`, `< now`) and one against the end of today, so the
 * same unpaid line could read OVERDUE on the pupil's card, on time in the
 * school's dashboard total, and either way on the families list depending on
 * what o'clock it was. A family chased for an instalment due that morning is
 * the failure this closes.
 *
 * Compared by *day* and not by moment: a due date is a wall-calendar date, and
 * an instalment falling due today is not late until today is over. Anything
 * unparseable is not late — an absent date cannot make a charge overdue.
 */
export function isOverdue(
  dueDate: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return startOfDay(due).getTime() < startOfDay(now).getTime();
}

/**
 * The state of one charge.
 *
 * `dueDate` decides lateness rather than the amount: most of a year's fees are
 * outstanding in October and none of them are late, so an unpaid line is only
 * OVERDUE once the day it fell due has actually passed.
 */
export function paymentStateOf({
  amountCentimes,
  paidCentimes,
  dueDate,
  now = new Date(),
}: {
  amountCentimes: number;
  paidCentimes: number;
  dueDate: string | Date | null;
  now?: Date;
}): PaymentState {
  if (paidCentimes >= amountCentimes) return "SETTLED";
  if (isOverdue(dueDate, now)) return "OVERDUE";
  return paidCentimes > 0 ? "PARTIAL" : "UPCOMING";
}

/** Where a whole schedule stands, from its totals. */
export function standingStateOf({
  chargedCentimes,
  paidCentimes,
  overdueCentimes,
}: {
  chargedCentimes: number;
  paidCentimes: number;
  overdueCentimes: number;
}): PaymentState {
  if (overdueCentimes > 0) return "OVERDUE";
  if (chargedCentimes > 0 && paidCentimes >= chargedCentimes) return "SETTLED";
  return paidCentimes > 0 ? "PARTIAL" : "UPCOMING";
}

/**
 * Tailwind classes per state, in the three shapes money is drawn in.
 *
 * Colour never carries the meaning alone — every caller pairs these with the
 * figure itself or with a translated label, which is what keeps the screens
 * readable under colour-vision deficiency and in high contrast.
 */
export const PAYMENT_STATE_STYLES: Record<
  PaymentState,
  { text: string; bar: string; surface: string }
> = {
  SETTLED: {
    text: "text-success",
    bar: "bg-success",
    surface: "border-success/30 bg-success/5",
  },
  PARTIAL: {
    text: "text-warning",
    bar: "bg-warning",
    surface: "border-warning/30 bg-warning/5",
  },
  UPCOMING: {
    text: "text-muted-foreground",
    bar: "bg-primary",
    surface: "border-border",
  },
  OVERDUE: {
    text: "text-destructive",
    bar: "bg-destructive",
    surface: "border-destructive/30 bg-destructive/5",
  },
};

// ── Making a règlement add up ────────────────────────────────────────────────

/** One row of the règlement, reduced to what balancing it needs. */
export type TenderShare = {
  /** "CASH" | "CHEQUE" | … — see modules/treasury/enums.ts. */
  method: string;
  /** What the row currently says, in centimes. Zero for a blank row. */
  amountCentimes: number;
  /** Whether the cashier has actually typed a figure in it. */
  isBlank: boolean;
};

/**
 * What each row of a règlement should say for it to settle exactly what was
 * ticked — the "Solder" button.
 *
 * ── Which row the difference lands on ───────────────────────────────────────
 * It used to be the first, always. That is right when there is one row and
 * wrong the moment there are two, which is the ordinary case at a desk: a
 * family pays 3 000 by chèque and the rest in espèces, so the cashier types the
 * chèque on the first row and adds a second row for the cash — and "Solder" put
 * the balance onto the chèque, restating a document that has already been
 * signed for a fixed amount. The cash row it was added for stayed empty.
 *
 * So the shortfall goes where the cashier would put it:
 *
 *   1. the first row still blank — the one just added to take "the rest";
 *   2. failing that, the last row that is not a chèque, because a chèque is
 *      written for a sum somebody else decided and the app must not invent a
 *      different one;
 *   3. failing that, the last row: everything is a chèque, and the figure has
 *      to go somewhere the cashier can see and correct.
 *
 * An over-payment is handed back from the last row towards the first, each
 * clamped at zero. The old subtraction simply took the excess off row one, so
 * tendering more than was ticked left a **negative** amount on it — a receipt
 * claiming the school had handed money out.
 *
 * Everything in centimes. The old version added a parsed float to a converted
 * one, which is how a receipt ends up a centime away from the lines it says it
 * settles.
 *
 * Returns one amount per row, in the order given.
 */
export function balanceTenders(
  tenders: readonly TenderShare[],
  selectedCentimes: number,
): number[] {
  const amounts = tenders.map((tender) => tender.amountCentimes);
  const tendered = amounts.reduce((total, amount) => total + amount, 0);
  const difference = selectedCentimes - tendered;

  if (tenders.length === 0 || difference === 0) return amounts;

  if (difference > 0) {
    const blank = tenders.findIndex(
      (tender) => tender.isBlank || tender.amountCentimes === 0,
    );
    const lastNonCheque = tenders.reduce(
      (found, tender, index) => (tender.method === "CHEQUE" ? found : index),
      -1,
    );

    const target =
      blank >= 0 ? blank : lastNonCheque >= 0 ? lastNonCheque : amounts.length - 1;

    amounts[target] += difference;
    return amounts;
  }

  // Over-tendered: give it back from the last row towards the first, so no row
  // is ever left holding a negative amount.
  let excess = -difference;
  for (let index = amounts.length - 1; index >= 0 && excess > 0; index -= 1) {
    const taken = Math.min(amounts[index], excess);
    amounts[index] -= taken;
    excess -= taken;
  }

  return amounts;
}
