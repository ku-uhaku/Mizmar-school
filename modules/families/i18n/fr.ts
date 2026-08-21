/**
 * Families translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  family: {
    title: "Familles",
    subtitle: "Les dossiers familiaux de l'école — tuteurs et enfants.",
    newFamily: "Nouvelle famille",
    editFamily: "Modifier la famille",
    createFamily: "Créer la famille",
    code: "N° de dossier",
    codeHint: "Laisser vide pour attribuer le suivant, ex. F-2025-0142.",
    name: "Nom de famille",
    nameHint: "Le nom seul \u2014 le dossier est ouvert au nom de \u00ab Famille Bennis \u00bb.",
    nameAr: "Nom de famille (arabe)",
    situation: "Situation",
    address: "Adresse",
    addressLine: "Adresse",
    city: "Ville",
    postalCode: "Code postal",
    phone: "Téléphone",
    email: "E-mail",
    notes: "Remarques",
    contact: "Contact",
    household: "Foyer",
    primaryContact: "Contact principal",
    primaryContactHint: "La personne que l'école appelle en premier.",
    noContact: "Aucun contact",
    firstContactSectionHint:
      "Le parent que l'école appellera en premier. Un accès à l'application des parents lui est ouvert automatiquement, avec un mot de passe aléatoire affiché une fois le dossier créé.",
    guardianPhoneHint: "Laisser vide pour reprendre le téléphone de la famille ci-dessus.",
    guardians: "Tuteurs",
    guardiansHint: "Le père, la mère et toute autre personne responsable des enfants.",
    children: "Enfants",
    childrenHint: "Élèves rattachés à ce dossier.",
    noChildren: "Aucun enfant sur ce dossier.",
    noGuardians: "Aucun tuteur sur ce dossier.",
    addGuardian: "Ajouter un tuteur",
    editGuardian: "Modifier le tuteur",
    relationship: "Lien",
    firstName: "Prénom",
    lastName: "Nom",
    guardianNameAr: "Nom complet (arabe)",
    nationalId: "CIN",
    phoneAlt: "Second téléphone",
    profession: "Profession",
    noParentJobs:
      "Aucune profession n'est configurée pour cet établissement — ajoutez-en une sous Configuration.",
    employer: "Employeur",
    ownAddress: "Adresse personnelle",
    ownAddressHint: "Uniquement si différente de l'adresse de la famille.",
    isPrimaryContact: "Contact principal",
    isEmergencyContact: "Contact d'urgence",
    canPickUp: "Autorisé à récupérer les enfants",
    makePrimary: "Définir comme contact principal",
    portalAccount: "Accès à l'application",
    portalAccountHint:
      "Un seul accès par famille. Il ouvre l'application des parents sur tous les enfants du dossier.",
    portalBadge: "Accès application",
    portalRevoked: "Accès retiré",
    openPortalAccount: "Ouvrir un accès",
    resetPortalPassword: "Réinitialiser le mot de passe",
    revokePortalAccount: "Retirer l'accès",
    portalUsername: "Identifiant",
    portalPassword: "Mot de passe",
    portalOpened: "Accès ouvert.",
    portalPasswordReset: "Nouveau mot de passe généré.",
    portalAccountRevoked: "Accès retiré.",
    portalAlreadyOpen:
      "Cette famille a déjà un accès, au nom de {name}. Retirez-le avant d'en ouvrir un autre.",
    portalNoAccount: "Ce tuteur n'a pas d'accès à l'application.",
    portalNoUsername:
      "Impossible de composer un identifiant à partir de ce nom. Saisissez le nom en caractères latins, ou utilisez le numéro de dossier.",
    portalCredentialsTitle: "À remettre au parent",
    portalCredentialsBody:
      "Le mot de passe n'est affiché qu'une fois et ne peut pas être retrouvé. Notez-le ou copiez-le avant de fermer cette fenêtre.",
    portalCopy: "Copier",
    portalCopied: "Copié",

    portalAccess: "Accès famille",
    portalDormant: "Désactivé",
    portalDormantHint:
      "Aucun enfant de ce dossier n'est inscrit pour l'année en cours : l'espace parents leur est fermé. Il se rouvre de lui-même à la prochaine inscription.",
    portalAccessHint:
      "Chaque famille devrait avoir un accès. C'est par là que les notes, les absences, les annonces et les factures parviennent aux parents.",
    portalNoAccess: "Cette famille n'a pas encore d'accès",
    portalHeldBy: "Au nom de",
    portalOpenAccess: "Ouvrir l'accès",
    portalChangePassword: "Changer le mot de passe",
    portalGeneratePassword: "Générer un mot de passe",
    portalWhichGuardian: "Quel parent se connecte ?",

    portalChooseTitle: "Choisir le mot de passe de la famille",
    portalChooseBody:
      "Saisissez le mot de passe que vous allez remettre, ou laissez vide pour en générer un. Au moins 8 caractères.",
    portalChooseReset:
      "Remplace le mot de passe actuel et déconnecte la famille de l'application sur tous ses appareils.",
    portalPasswordPlaceholder: "Laissez vide pour en générer un",
    portalShowPassword: "Afficher le mot de passe",
    portalHidePassword: "Masquer le mot de passe",

    portalPrint: "Imprimer",
    portalSlipTitle: "Application des parents — votre accès",
    portalSlipIntro:
      "Installez l'application {app} sur votre téléphone et connectez-vous avec ces identifiants.",
    portalSlipChange:
      "Changez ce mot de passe dans l'application : Profil → Changer le mot de passe. En cas d'oubli, le secrétariat vous en remettra un nouveau.",
    portalSlipWarning: "Conservez ce document. Ne le transmettez à personne.",
    revokePortalTitle: "Retirer l'accès à l'application ?",
    revokePortalBody:
      "« {name} » sera déconnecté immédiatement de l'application des parents et ne pourra plus s'y connecter.",
    created: "Famille créée.",
    updated: "Famille mise à jour.",
    deleted: "Famille supprimée.",
    guardianAdded: "Tuteur ajouté.",
    guardianUpdated: "Tuteur mis à jour.",
    guardianDeleted: "Tuteur retiré.",
    codeTaken: "Ce numéro de dossier est déjà utilisé.",
    relationshipTaken: "Cette famille en a déjà un.",
    hasChildren: "Détachez les enfants de ce dossier avant de le supprimer.",
    deleteTitle: "Supprimer ce dossier familial ?",
    deleteBody: "« {name} » et ses tuteurs seront supprimés.",
    deleteGuardianTitle: "Retirer ce tuteur ?",
    deleteGuardianBody: "« {name} » sera retiré du dossier.",
    noFamilies: "Aucun dossier familial.",
    searchPlaceholder: "Rechercher par nom, n° de dossier ou téléphone…",
    familyColumn: "Famille",
    countLabel: "{count} enfants",
    attachTitle: "Rattacher à une famille",

    transfer: "Transférer vers une autre école",
    transferHint:
      "Pour un dossier ouvert dans la mauvaise école. Les adultes et les enfants le suivent ; ce qui est déjà inscrit ou payé ne le suit pas.",
    transferSchool: "Nouvelle école",
    transferConfirm: "Transférer ce dossier",
    transferred:
      "Dossier transféré sous le numéro {code}, avec {children} enfants. {cleared} références aux listes de l'ancienne école ont été vidées.",
    transferBlocked: "Ce dossier ne peut pas être transféré : {reasons}.",
    transferSameSchool: "Il est déjà dans cette école.",
    transferOtherOrganisation: "Cette école appartient à une autre organisation.",
  },
  familyOptions: {
    transferBlockers: {
      enrolments: "un enfant y est inscrit",
      payments: "des reçus y ont été établis à son nom",
      requests: "des documents ont été demandés à cette école",
      documents: "il contient des pièces d'un type que l'autre école ne tient pas",
    },
    situations: {
      MARRIED: "Marié(e)",
      DIVORCED: "Divorcé(e)",
      SEPARATED: "Séparé(e)",
      WIDOWED: "Veuf / veuve",
      OTHER: "Autre",
    },
    relationships: {
      FATHER: "Père",
      MOTHER: "Mère",
      STEPFATHER: "Beau-père",
      STEPMOTHER: "Belle-mère",
      GRANDFATHER: "Grand-père",
      GRANDMOTHER: "Grand-mère",
      BROTHER: "Frère",
      SISTER: "Sœur",
      UNCLE: "Oncle",
      AUNT: "Tante",
      GUARDIAN: "Tuteur légal",
    },
  },
};

export const nav = {
  families: "Familles",
};

export const permissions = {
  groups: {
    family: "Familles",
  },
  codes: {
    "family.view": "Consulter les dossiers familiaux",
    "family.create": "Créer des dossiers familiaux",
    "family.update": "Modifier les dossiers et les tuteurs",
    "family.delete": "Supprimer des dossiers familiaux",
    "family.portal": "Ouvrir et retirer les accès des parents",
  },
};

export default fr;
