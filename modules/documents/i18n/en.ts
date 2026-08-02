/**
 * Documents translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  document: {
    dossier: "Dossier",
    dossierSubtitle: "The pieces the school asks for, and what it holds.",
    piece: "Document",
    required: "Required",
    optional: "Optional",
    copies: "{count} copies",
    status: "Status",
    receivedOn: "Received on",
    reference: "Reference",
    referenceHint: "The document's own number, where it has one.",
    notes: "Note",
    notesHint: "Why it was refused, or on what grounds it was waived.",
    recordedBy: "Recorded by",
    record: "Record",
    recorded: "Dossier updated.",
    complete: "Dossier complete",
    missingCount: "{count} missing",
    missingOptional: "{count} optional outstanding",
    settledOf: "{settled} of {total} required pieces",
    noTypes:
      "No document has been declared. Add the pieces under Configuration → School first.",
    emptyDossier: "Nothing recorded on this dossier yet.",
  },
  documentOptions: {
    statuses: {
      MISSING: "Missing",
      RECEIVED: "Received",
      REJECTED: "Refused",
      EXEMPTED: "Waived",
    },
  },
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    document: "Pupil dossiers",
  },
  codes: {
    "document.view": "View a pupil's dossier",
    "document.manage": "Record documents on a dossier",
  },
} as const;

export default en;
