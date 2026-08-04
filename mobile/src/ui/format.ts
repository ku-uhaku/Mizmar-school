/**
 * Formatting, in French — the school's working language.
 *
 * Money is the one that matters: the server speaks centimes everywhere, and a
 * screen that divides by 100 on its own is a screen that will eventually forget
 * to.
 */

const MONEY = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 2,
});

export function money(centimes: number): string {
  return MONEY.format(centimes / 100);
}

const DATE = new Intl.DateTimeFormat("fr-MA", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const SHORT_DATE = new Intl.DateTimeFormat("fr-MA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function longDate(value: string | Date): string {
  return DATE.format(new Date(value));
}

export function shortDate(value: string | Date): string {
  return SHORT_DATE.format(new Date(value));
}

/** `2026-08-04`, the form the API's `?date=` expects. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Labels for the enum-like strings the API returns. */
export const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "En retard",
  EXCUSED: "Excusé",
  LEFT_EARLY: "Parti tôt",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Prévu",
  DEPARTED: "Parti",
  ARRIVED: "Arrivé",
  CANCELLED: "Annulé",
};

export const DIRECTION_LABELS: Record<string, string> = {
  MORNING: "Ramassage",
  AFTERNOON: "Retour",
  BOTH: "Aller-retour",
};

export const STUDENT_STATUS_LABELS: Record<string, string> = {
  PRE_REGISTERED: "Préinscrit",
  ENROLLED: "Inscrit",
  LEFT: "Parti",
  GRADUATED: "Diplômé",
};

export function label(
  dictionary: Record<string, string>,
  value: string | null,
): string {
  if (!value) return "—";
  return dictionary[value] ?? value;
}
