/**
 * Families translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  family: {
    title: "Families",
    subtitle: "The household files the school keeps — guardians and children.",
    newFamily: "New family",
    editFamily: "Edit family",
    createFamily: "Create family",
    code: "File number",
    codeHint: "Leave blank to allocate the next one, e.g. F-2025-0142.",
    name: "Family name",
    nameHint: "The surname only — the file is opened as \u00ab Famille Bennis \u00bb.",
    nameAr: "Family name (Arabic)",
    situation: "Situation",
    address: "Address",
    addressLine: "Street address",
    city: "City",
    postalCode: "Postal code",
    phone: "Phone",
    email: "Email",
    notes: "Notes",
    contact: "Contact",
    household: "Household",
    primaryContact: "First contact",
    primaryContactHint: "The person the school calls first.",
    noContact: "No contact yet",
    guardians: "Guardians",
    guardiansHint: "The father, the mother, and anyone else answerable for the children.",
    children: "Children",
    childrenHint: "Pupils attached to this file.",
    noChildren: "No children on this file yet.",
    noGuardians: "No guardians on this file yet.",
    addGuardian: "Add guardian",
    editGuardian: "Edit guardian",
    relationship: "Relationship",
    firstName: "First name",
    lastName: "Last name",
    guardianNameAr: "Full name (Arabic)",
    nationalId: "National ID (CIN)",
    phoneAlt: "Second phone",
    profession: "Profession",
    employer: "Employer",
    ownAddress: "Own address",
    ownAddressHint: "Only if different from the family address.",
    isPrimaryContact: "First contact",
    isEmergencyContact: "Emergency contact",
    canPickUp: "May collect children",
    makePrimary: "Make first contact",
    created: "Family created.",
    updated: "Family updated.",
    deleted: "Family deleted.",
    guardianAdded: "Guardian added.",
    guardianUpdated: "Guardian updated.",
    guardianDeleted: "Guardian removed.",
    codeTaken: "That file number is already in use.",
    relationshipTaken: "This family already has one.",
    hasChildren: "Detach the children from this file before deleting it.",
    deleteTitle: "Delete this family file?",
    deleteBody: "“{name}” and its guardians will be removed.",
    deleteGuardianTitle: "Remove this guardian?",
    deleteGuardianBody: "“{name}” will be taken off the file.",
    noFamilies: "No family files yet.",
    searchPlaceholder: "Search by name, file number or phone…",
    familyColumn: "Family",
    countLabel: "{count} children",
    attachTitle: "Attach to a family",
  },
  familyOptions: {
    situations: {
      MARRIED: "Married",
      DIVORCED: "Divorced",
      SEPARATED: "Separated",
      WIDOWED: "Widowed",
      OTHER: "Other",
    },
    relationships: {
      FATHER: "Father",
      MOTHER: "Mother",
      STEPFATHER: "Stepfather",
      STEPMOTHER: "Stepmother",
      GRANDFATHER: "Grandfather",
      GRANDMOTHER: "Grandmother",
      BROTHER: "Brother",
      SISTER: "Sister",
      UNCLE: "Uncle",
      AUNT: "Aunt",
      GUARDIAN: "Legal guardian",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  families: "Families",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    family: "Families",
  },
  codes: {
    "family.view": "View family files",
    "family.create": "Create family files",
    "family.update": "Update family files and guardians",
    "family.delete": "Delete family files",
  },
} as const;

export default en;
