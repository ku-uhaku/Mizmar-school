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
