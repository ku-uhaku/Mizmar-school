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

const CLOCK = new Intl.DateTimeFormat("fr-MA", {
  hour: "2-digit",
  minute: "2-digit",
});

/** `07:12` — an instant from the server as a wall clock. */
export function clock(value: string | Date): string {
  return CLOCK.format(new Date(value));
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
  EN_ROUTE: "En route",
  ARRIVED: "Arrivé",
  CANCELLED: "Annulé",
};

/** Whether the voyage is at its hour. See TripRun.window. */
export const RUN_WINDOW_LABELS: Record<string, string> = {
  UPCOMING: "Pas encore l'heure",
  OPEN: "C'est l'heure",
  CLOSED: "Terminé",
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

/** ISO weekday (1 = Monday) → its name, for the child's timetable. */
export const WEEKDAY_LABELS: Record<string, string> = {
  "1": "Lundi",
  "2": "Mardi",
  "3": "Mercredi",
  "4": "Jeudi",
  "5": "Vendredi",
  "6": "Samedi",
  "7": "Dimanche",
};

/** What the school has, or still wants, of one pièce du dossier. */
export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  MISSING: "Manquante",
  RECEIVED: "Reçue",
  REJECTED: "Refusée",
  EXEMPTED: "Dispensée",
};

/** The kinds of announcement a school publishes. */
export const EVENT_KIND_LABELS: Record<string, string> = {
  MEETING: "Réunion",
  OUTING: "Sortie",
  CEREMONY: "Cérémonie",
  EXAM: "Examens",
  HOLIDAY_INFO: "Vacances",
  OTHER: "Autre",
};

/** `"2026-03"` → `"mars 2026"`, for the payments screen's month headings. */
const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function monthLabel(month: string): string {
  const [year, index] = month.split("-");
  const name = MONTH_NAMES[Number(index) - 1];
  return name ? `${name} ${year}` : month;
}

/** What a teacher notes about a pupil. Mirrors `REMARK_KINDS`. */
export const REMARK_KIND_LABELS: Record<string, string> = {
  BEHAVIOUR: "Comportement",
  WORK: "Travail",
  PROGRESS: "Progrès",
  ATTENDANCE: "Assiduité",
  OTHER: "Autre",
};

/** The tone of a remark, kept apart from its kind. Mirrors `REMARK_TONES`. */
export const REMARK_TONE_LABELS: Record<string, string> = {
  POSITIVE: "Positif",
  NEUTRAL: "Neutre",
  CONCERN: "Préoccupant",
};

/** How a period was spent, as a parent reads it. */
export const ABSENCE_STATUS_LABELS: Record<string, string> = {
  ABSENT: "Absence",
  LATE: "Retard",
  EXCUSED: "Excusé",
  PRESENT: "Présent",
};
