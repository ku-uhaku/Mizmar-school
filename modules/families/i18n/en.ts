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
    profession: "Occupation",
    noParentJobs:
      "No occupation is configured for this school yet — add one under Configuration.",
    employer: "Employer",
    ownAddress: "Own address",
    ownAddressHint: "Only if different from the family address.",
    isPrimaryContact: "First contact",
    isEmergencyContact: "Emergency contact",
    canPickUp: "May collect children",
    makePrimary: "Make first contact",
    portalAccount: "Portal account",
    portalAccountHint:
      "One login per family. It opens the parents' app onto every child on this file.",
    portalBadge: "App access",
    portalRevoked: "Access withdrawn",
    openPortalAccount: "Open portal account",
    resetPortalPassword: "Reset password",
    revokePortalAccount: "Withdraw access",
    portalUsername: "Username",
    portalPassword: "Password",
    portalOpened: "Portal account opened.",
    portalPasswordReset: "New password issued.",
    portalAccountRevoked: "Portal access withdrawn.",
    portalAlreadyOpen:
      "This family already has a portal account, on {name}. Withdraw it before opening another.",
    portalNoAccount: "This guardian has no portal account.",
    portalNoUsername:
      "No username could be built from this name. Give the guardian a name in Latin script, or a file number.",
    portalCredentialsTitle: "Hand these to the parent",
    portalCredentialsBody:
      "The password is shown once and cannot be recovered. Write it down or copy it before closing this window.",
    portalCopy: "Copy",
    portalCopied: "Copied",

    // The access card on the dossier
    portalAccess: "Family access",
    portalDormant: "Switched off",
    portalDormantHint:
      "No child on this file is enrolled for the current school year, so the parents' app is closed to them. It reopens by itself at the next enrolment.",
    portalAccessHint:
      "Every family should have one login. It is how marks, absences, notices and bills reach the parents.",
    portalNoAccess: "This family has no access yet",
    portalHeldBy: "Held by",
    portalOpenAccess: "Open the access",
    portalChangePassword: "Change the password",
    portalGeneratePassword: "Issue a random password",
    portalWhichGuardian: "Which parent signs in?",

    // Choosing the password rather than generating one
    portalChooseTitle: "Choose the family's password",
    portalChooseBody:
      "Type the password you are going to hand over, or leave it empty for a random one. It must be at least 8 characters.",
    portalChooseReset:
      "This replaces the current password and signs the family out of the app everywhere.",
    portalPasswordPlaceholder: "Leave empty to generate one",
    portalShowPassword: "Show the password",
    portalHidePassword: "Hide the password",

    // The printed slip
    portalPrint: "Print",
    portalSlipTitle: "Parents' app — your access",
    portalSlipIntro:
      "Install the {app} app on your telephone and sign in with these.",
    portalSlipChange:
      "Change this password in the app: Profile → Change password. If you forget it, the school office will issue a new one.",
    portalSlipWarning: "Keep this slip. Do not pass it on.",
    revokePortalTitle: "Withdraw portal access?",
    revokePortalBody:
      "“{name}” will be signed out of the parents' app immediately and will not be able to sign in again.",
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

    // Moving a dossier opened against the wrong school.
    transfer: "Move to another school",
    transferHint:
      "For a dossier opened against the wrong school. The adults and the children move with it; nothing already enrolled or paid for can.",
    transferSchool: "New school",
    transferConfirm: "Move this dossier",
    transferred:
      "Dossier moved as {code}, with {children} children. {cleared} references to the old school's own lists were cleared.",
    transferBlocked: "This dossier cannot be moved: {reasons}.",
    transferSameSchool: "It is already at that school.",
    transferOtherOrganisation: "That school belongs to another organisation.",
  },
  familyOptions: {
    /** Why a dossier is stuck where it is — see `transferFamily`. */
    transferBlockers: {
      enrolments: "a child is enrolled here",
      payments: "receipts have been made out to it here",
      requests: "papers have been asked of this school",
      documents: "it holds pièces of a type the other school does not keep",
    },
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
    "family.portal": "Open and withdraw parent portal accounts",
  },
} as const;

export default en;
