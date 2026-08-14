/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/supplies/*.prisma`. Labels live in `i18n/*.ts` under
 * `supplyOptions`.
 */

/**
 * The families a catalogue article belongs to.
 *
 * What the picker groups by, and the only reason a catalogue of eighty articles
 * is usable: a teacher looking for a pen opens "Écriture" rather than reading
 * the whole list. Broad on purpose — these are the shelves of a Moroccan
 * papeterie, not an inventory taxonomy, and a category nobody can place an
 * article in is a category that gets used wrongly.
 *
 * Labels live in `i18n/*.ts` under `supplyOptions.categories`, and the column
 * that holds one is `SupplyArticle.category`.
 */
export const SUPPLY_CATEGORIES = [
  /** Stylos, crayons, gommes, taille-crayons, feutres. */
  "ECRITURE",
  /** Cahiers, blocs, feuilles, papier millimétré. */
  "CAHIERS",
  /** Protège-cahiers, couvre-livres, étiquettes. */
  "COUVERTURES",
  /** Classeurs, chemises, pochettes, intercalaires. */
  "CLASSEMENT",
  /** Règle, équerre, compas, rapporteur, calculatrice. */
  "GEOMETRIE",
  /** Peinture, pinceaux, pâte à modeler, ciseaux, colle. */
  "ARTS",
  /** Cartable, trousse, boîte à goûter. */
  "CARTABLE",
  /** Tenue de sport, chaussures, sac de piscine. */
  "SPORT",
  /** Mouchoirs, gel hydroalcoolique, blouse. */
  "HYGIENE",
  /** Anything the shelves above do not cover. */
  "AUTRE",
] as const;
export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];

/**
 * Where a liste de fournitures has got to.
 *
 *   DRAFT      the teacher is still writing it; nobody else need look
 *   SUBMITTED  handed to the office, waiting on a decision
 *   APPROVED   released — the only status a family may ever see
 *   REJECTED   refused, with a reason the teacher can read and act on
 *
 * REJECTED is a status rather than a deletion on purpose: a list that simply
 * vanished would be rewritten identically the following week, and the reason it
 * was refused is the only thing that stops that.
 */
export const SUPPLY_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;
export type SupplyStatus = (typeof SUPPLY_STATUSES)[number];

/**
 * The deadline as it is stored: the end of the day the school named.
 *
 * A list due "le 15 septembre" is due *all* of the 15th. Stored at midnight it
 * would retire itself on the morning it matters most, which is the one morning
 * a parent opens it to check they have everything. Same reasoning as the
 * all-day event in modules/events/enums.ts.
 */
export function dueOnValue(day: Date | null): Date | null {
  if (day === null) return null;
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Whether the deadline has gone by, as of `now`.
 *
 * A list with no deadline never passes — that is a general list handed out at
 * the rentrée, and it stands until the year does.
 */
export function isPassed(dueOn: Date | null, now: Date = new Date()): boolean {
  return dueOn !== null && dueOn < now;
}

/**
 * The clause that keeps a list on a family's phone.
 *
 * A `where` fragment rather than a predicate for the same reason the events one
 * is: filtering after the read would hand a parent a screen of lists they can
 * no longer act on, and the office is the only party that needs the passed
 * ones. `null` deadlines are kept — see `isPassed`.
 */
export function stillDueWhere(now: Date = new Date()): {
  OR: [{ dueOn: null }, { dueOn: { gte: Date } }];
} {
  return { OR: [{ dueOn: null }, { dueOn: { gte: now } }] };
}

/** The only status whose contents reach a family. */
export function isVisibleToFamilies(status: string): boolean {
  return status === "APPROVED";
}

/**
 * Whether the author may still edit the list.
 *
 * An approved list is closed to its author: it has been agreed and families may
 * already have bought against it, so changing it is a new decision and a new
 * review. A rejected one stays editable, because acting on the reason is the
 * whole point of sending it back.
 */
export function isEditableByAuthor(status: string): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

/**
 * The statuses the office can move a list *to*, from where it is now.
 *
 * Expressed as a table rather than scattered `if`s so the action and the UI
 * cannot disagree about what buttons should exist — a screen offering a
 * transition the service refuses is worse than no button at all.
 */
export const REVIEW_TRANSITIONS: Record<string, readonly SupplyStatus[]> = {
  DRAFT: [],
  // Approving or refusing is the decision the office was asked for.
  SUBMITTED: ["APPROVED", "REJECTED"],
  // An approved list can still be withdrawn — a price rise, a change of mind —
  // which takes it back to the office's own queue rather than to the teacher.
  APPROVED: ["SUBMITTED"],
  REJECTED: ["APPROVED"],
};

const NO_TRANSITIONS: readonly SupplyStatus[] = [];

/**
 * The moves the office may make from where a list stands.
 *
 * A function rather than a bare lookup, for the reason the table exists at all:
 * the service and the review dialog each spelled `REVIEW_TRANSITIONS[status] ??
 * []` for themselves, which is two implementations of the sentence "so the
 * action and the UI cannot disagree about what buttons should exist".
 *
 * `Object.hasOwn` because the table is a plain object: `REVIEW_TRANSITIONS
 * ["constructor"]` answers a function, so the `?? []` never fired and calling
 * `.includes` on it threw. Nothing reaches it with such a value — a status is
 * one of four strings the app itself wrote — and a transition table should
 * still answer "no moves" rather than explode when asked about a state it has
 * never heard of.
 */
export function allowedReviewTransitions(
  status: string,
): readonly SupplyStatus[] {
  return Object.hasOwn(REVIEW_TRANSITIONS, status)
    ? (REVIEW_TRANSITIONS[status] ?? NO_TRANSITIONS)
    : NO_TRANSITIONS;
}

/** Whether the office may move a list from `from` to `next`. */
export function canReviewTo(from: string, next: string): boolean {
  return allowedReviewTransitions(from).includes(next as SupplyStatus);
}
