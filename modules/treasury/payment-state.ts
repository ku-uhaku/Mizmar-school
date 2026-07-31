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

  // End of today: an instalment falling due today is not late yet.
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const due = dueDate ? new Date(dueDate) : null;
  const late = due !== null && !Number.isNaN(due.getTime()) && due <= endOfToday;

  if (late) return "OVERDUE";
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
