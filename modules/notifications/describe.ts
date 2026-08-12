import type { Locale } from "@/lib/i18n/config";
import { formatAmount, formatDate, interpolate } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";
import type { NotificationItem } from "@/modules/notifications/queries";

/**
 * Turns a stored row into the sentence a reader sees.
 *
 * Isomorphic and takes the dictionary, the same way `validation.ts` does in
 * every other module: the bell is a client component and the page is a server
 * one, and both must word a notification identically or the list will disagree
 * with the dropdown that opened it.
 *
 * ── Why one function and not a template per surface ─────────────────────────
 * Because two of the kinds need more than a substitution. A request's answer is
 * "Attestation: Ready", and "Ready" is a *word*, not a proper noun — the row
 * stores the status code and the wording comes from the requests module's own
 * labels. Duplicating those here would mean a school renaming a status in one
 * place and not the other.
 */
export function describeNotification(
  item: NotificationItem,
  t: Dictionary,
  locale: Locale,
): string {
  const template = t.notification.kinds[item.kind];
  return interpolate(template, resolveParams(item, t, locale));
}

/**
 * The row's params, with the two sorts that are not proper nouns resolved.
 *
 * Everything else passes through untouched — a title and a child's name are the
 * same string in all three languages, which is the whole reason they are what
 * gets stored.
 */
function resolveParams(
  item: NotificationItem,
  t: Dictionary,
  locale: Locale,
): Record<string, string> {
  const params = { ...item.params };

  /*
    `status` means five different things, and is deliberately five lookups.

    A dossier's status comes from the requests module, a register's from the
    classroom module, a leave's from RH — and the vocabularies overlap in
    neither direction while sharing values that look interchangeable and are
    not. "APPROVED" is a supply list the office agreed to buy and a leave the
    directrice granted; "REJECTED" is a refused list and a refused congé. One
    merged map would render whichever was declared last, and the bug would show
    up as a single wrong word in a sentence that otherwise reads perfectly.

    Falls back to the raw code rather than an empty slot: a status this build
    has never heard of should read badly, not read as nothing.
  */
  if (params.status) {
    params.status =
      statusVocabulary(item.kind, t)[params.status] ?? params.status;
  }

  // Dates travel as ISO for the same reason money travels in centimes: the
  // school writes 04/03/2026 and an Arabic reader should not be shown the
  // cashier's or the teacher's formatting of it.
  if (params.date) {
    params.date = formatDate(params.date, locale);
  }

  // Money is stored in centimes and worded here, for the same reason the labels
  // are: "1 200,00" and "١٢٠٠٫٠٠" are one fact in two scripts, and a receipt
  // formatted by whoever took the payment would reach the family in the
  // cashier's locale rather than their own.
  if (params.amountCentimes) {
    const centimes = Number(params.amountCentimes);
    if (Number.isFinite(centimes)) {
      params.amount = formatAmount(centimes, locale);
    }
  }

  return params;
}

/**
 * Which module's words a kind's `status` is spelled in.
 *
 * Each entry points at the owning module's own labels rather than restating
 * them, so a school renaming a status renames it everywhere at once — that is
 * the whole reason the row stores a code.
 */
function statusVocabulary(
  kind: NotificationItem["kind"],
  t: Dictionary,
): Record<string, string> {
  switch (kind) {
    case "ATTENDANCE_MISSED":
    case "TRANSPORT_MISSED":
      // The bus register and the classroom one share a vocabulary by design —
      // see RIDER_ATTENDANCE_STATUSES, which mirrors ATTENDANCE_STATUSES.
      return t.classroomOptions.attendanceStatuses;
    case "SUPPLY_LIST_REVIEWED":
      return t.supplyOptions.statuses;
    case "LEAVE_DECIDED":
      return t.hrOptions.leaveStatuses;
    case "ADVANCE_DECIDED":
      return t.hrOptions.advanceStatuses;
    default:
      return t.requestOptions.statuses;
  }
}
