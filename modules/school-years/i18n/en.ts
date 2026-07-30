/**
 * School years translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  schoolYear: {
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
    defaultBadge: "Default",
    created: "School year created.",
    updated: "School year updated.",
    deleted: "School year deleted.",
    deleteTitle: "Delete this school year?",
    deleteBody: "“{name}” will be permanently removed.",
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
