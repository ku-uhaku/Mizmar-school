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
    chooseImage: "Choose an image",
    removeImage: "Remove",
    imageChosen: "Image chosen",
    imageHint: "Choose a file, or paste a link to one.",
    noResults: "No results.",
    reset: "Reset",
    columns: "Columns",
    clearFilter: "Clear filter",
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
    imageTooLarge: "That image is too large — keep it under {max}.",
    notAnImage: "That file is not an image.",
    tooShort: "Must be at least {min} characters.",
    tooLong: "Must be at most {max} characters.",
    passwordTooShort: "Password must be at least {min} characters.",
    invalidNumber: "Enter a valid number.",
    invalidDate: "Enter a valid date.",
    invalidChoice: "Choose one of the available options.",
    codeFormat: "Use letters, numbers and dashes only.",
  },
  /** Wording shared by every printable document. */
  print: {
    download: "Download / Print",
    generatedBy: "Issued by the school administration system",
    signatureAndStamp: "Signature and stamp",
    receipt: "Payment receipt",
    receiptFor: "Received from",
    settles: "This receipt settles",
    tenders: "Paid by",
    receiptCancelled: "CANCELLED — this receipt has been voided",
    attestation: "Certificate of enrolment",
    attestationBody:
      "The undersigned certifies that the pupil named below is enrolled at this school for the {year} school year, in the class shown.",
    schedule: "Fee schedule",
    classList: "Class list",
    pupilCount: "{count} pupils",
    total: "Total",
    dueOn: "Due",
    issuedOn: "Issued on",
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
  /** Every section's landing entry. The group title says which section. */
  overview: "Overview",
  main: "Main",
  vieScolaire: "School life",
  finance: "Cash desk",
  logistique: "Logistics",
  rh: "Human resources",
  enseignant: "Teaching",
  administration: "Administration",
  account: "Account",
} as const;

export default core;
