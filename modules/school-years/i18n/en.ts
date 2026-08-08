/**
 * School years translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  schoolYear: {
    createdFromCopy:
      "Year created from the previous one — {classes} classes, {rates} fee lines, {weeks} weeks.",
    copyFrom: "Start from a previous year",
    copyFromHint:
      "Copies the configuration only. No pupil, no enrolment and no bus subscription is ever carried across.",
    copyNothing: "Start empty",
    copyParts: "What to copy",
    copyCalendar: "Calendar — terms, periods, holidays",
    copyCalendarHint:
      "Dates move by whole weeks so a Monday stays a Monday. Aïd and Mawlid follow the Islamic calendar and will need correcting.",
    copyStructure: "Structure — levels, classes, groups",
    copyStructureHint: "The shape of the school. The professeur principal is not carried.",
    copyFees: "Fees — price list and discounts",
    copyFeesHint: "At last year's amounts. Nothing is uprated.",
    copyTransport: "Transport — runs, circuits, stops",
    copyTransportHint: "The lines and what they serve. No subscription is copied.",
    title: "School years",
    subtitle: "Academic years for {school}.",
    subtitleNoSchool: "Pick a school to manage its academic years.",
    newYear: "New school year",
    editYear: "Edit school year",
    createYear: "Create school year",
    name: "Label",
    nameHint: "For example 2025-2026",
    startDate: "Start date",
    endDate: "End date",
    status: "Status",
    isDefault: "Default year",
    makeDefault: "Set as default",
    configure: "Configure",
    defaultBadge: "Default",
    created: "School year created.",
    updated: "School year updated.",
    deleted: "School year deleted.",
    deleteTitle: "Delete this school year?",
    deleteBody: "“{name}” will be permanently removed.",
    hasEnrolments:
      "{count} pupils are enrolled for this year. Close it instead — deleting it would remove their inscriptions and their fee schedules.",
    nameTaken: "That label already exists for this school.",
    endBeforeStart: "The end date must come after the start date.",
    noYears: "No school years yet for this school.",
    statuses: {
      PLANNED: "Planned",
      ACTIVE: "Active",
      CLOSED: "Closed",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  schoolYears: "School years",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    schoolYear: "School years",
  },
  codes: {
    "schoolYear.view": "View school years",
    "schoolYear.create": "Create school years",
    "schoolYear.update": "Update school years",
    "schoolYear.delete": "Delete school years",
  },
} as const;

export default en;
