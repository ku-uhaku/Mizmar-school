/**
 * Supplies translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  supply: {
    title: "School supplies",
    subtitle: "What each class is asked to bring, and who approved it.",
    newList: "New list",
    editList: "Edit list",
    list: "List",
    lists: "Lists",
    noLists: "No supply list yet.",
    noListsHint: "Write one for a class, then send it to the office to approve.",
    listTitle: "Title",
    listTitlePlaceholder: "Rentrée 2025 — 3AP",
    class: "Class",
    subject: "Subject",
    subjectHint: "Leave blank for the class's general list.",
    notes: "Notes for families",
    notesHint: "Where to buy, when to bring it — anything the items cannot say.",
    dueOn: "Bring it by",
    dueOnHint:
      "Leave blank for a list that simply stands. Once the day has gone by, families stop seeing it.",
    passed: "Past due",
    items: "Items",
    itemsHint: "One line per article, so a parent can tick them off.",
    addItem: "Add an item",
    itemLabel: "Article",
    itemLabelPlaceholder: "Cahier 96 pages, grands carreaux",
    itemLabelAr: "Article (Arabic)",
    quantity: "Qty",
    itemNotes: "Detail",
    required: "Required",
    optional: "Optional",
    itemCount: "{count} items",
    pickArticle: "Choose an article…",
    articleWithdrawn:
      "“{label}” is no longer in the catalogue — choose its replacement.",
    noArticles:
      "The supply catalogue is empty. Add articles under Configuration → Logistics first.",
    author: "Written by",
    reviewedBy: "Decided by",
    // ── The decision ────────────────────────────────────────────────────────
    submit: "Send for approval",
    submitted: "Sent to the office.",
    approve: "Approve",
    approved: "List approved — families can see it now.",
    reject: "Refuse",
    rejected: "List refused.",
    withdraw: "Withdraw",
    withdrawn: "List withdrawn from families.",
    reviewNote: "Reason",
    reviewNoteHint: "Shown to the teacher, never to a family.",
    awaitingReview: "Waiting for approval",
    awaitingReviewHint: "Lists the office has not decided on yet.",
    onlyApprovedVisible: "Only approved lists are visible to families.",
    notYourList: "This list is not yours to edit.",
    alreadyDecided: "This list has already been decided.",
    cannotEditApproved:
      "An approved list cannot be edited — withdraw it first.",
    created: "List created.",
    saved: "List saved.",
    deleted: "List deleted.",
    deleteTitle: "Delete this list?",
    deleteBody: "“{name}” will be removed.",
    print: "Print the list",
  },
  supplyOptions: {
    categories: {
      ECRITURE: "Writing",
      CAHIERS: "Exercise books",
      COUVERTURES: "Covers",
      CLASSEMENT: "Filing",
      GEOMETRIE: "Geometry",
      ARTS: "Art",
      CARTABLE: "Bag and pencil case",
      SPORT: "Sport",
      HYGIENE: "Hygiene",
      AUTRE: "Other",
    },
    statuses: {
      DRAFT: "Draft",
      SUBMITTED: "Awaiting approval",
      APPROVED: "Approved",
      REJECTED: "Refused",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  supplies: "Supplies",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    supply: "School supplies",
  },
  codes: {
    "supply.view": "View supply lists",
    "supply.write": "Write and submit supply lists",
    "supply.review": "Approve or refuse supply lists",
    "supply.delete": "Delete supply lists",
  },
} as const;

export default en;
