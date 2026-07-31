/**
 * Core translations (en) — the strings that belong to no single module:
 * shared UI wording, validation messages and error messages.
 *
 * Module-specific strings live in `modules/<module>/i18n/en.ts`.
 * `lib/i18n/dictionaries/en.ts` merges this file with all of them.
 */
const core = {
  common: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    deleting: "Deleting…",
    search: "Search",
    actions: "Actions",
    confirm: "Confirm",
    back: "Back",
    previous: "Previous",
    next: "Next",
    loading: "Loading…",
    none: "None",
    yes: "Yes",
    no: "No",
    active: "Active",
    inactive: "Inactive",
    all: "All",
    required: "Required",
    optional: "optional",
    close: "Close",
    noResults: "No results.",
    unknown: "Unknown",
    of: "of",
    selected: "selected",
    openMenu: "Open menu",
    notSet: "Not set",
    current: "Current",
    dangerZone: "Danger zone",
    irreversible: "This action cannot be undone.",
  },
  validation: {
    required: "This field is required.",
    email: "Enter a valid email address.",
    url: "Enter a valid URL.",
    tooShort: "Must be at least {min} characters.",
    tooLong: "Must be at most {max} characters.",
    passwordTooShort: "Password must be at least {min} characters.",
    invalidNumber: "Enter a valid number.",
    invalidDate: "Enter a valid date.",
    invalidChoice: "Choose one of the available options.",
    codeFormat: "Use letters, numbers and dashes only.",
  },
  errors: {
    unexpected: "Something went wrong. Please try again.",
    forbidden: "You do not have permission to do that.",
    notFound: "Not found.",
    noSchoolYearContext: "Select a school year first.",
    noSchoolContext: "Select a school first.",
    invalid: "Please check the highlighted fields.",
    pageNotFoundTitle: "Page not found",
    pageNotFoundBody: "The page you are looking for does not exist.",
    forbiddenTitle: "Access denied",
    forbiddenBody: "You do not have permission to view this page.",
    backToDashboard: "Back to dashboard",
  },
} as const;

/** Sidebar section titles. Modules contribute the entries inside them. */
export const nav = {
  main: "Main",
  finance: "Cash desk",
  administration: "Administration",
  account: "Account",
} as const;

export default core;
