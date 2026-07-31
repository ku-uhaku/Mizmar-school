/**
 * Core translations (fr) — the strings that belong to no single module:
 * shared UI wording, validation messages and error messages.
 *
 * Module-specific strings live in `modules/<module>/i18n/fr.ts`.
 * `lib/i18n/dictionaries/fr.ts` merges this file with all of them.
 */
const core = {
  common: {
    save: "Enregistrer",
    saving: "Enregistrement…",
    cancel: "Annuler",
    create: "Créer",
    edit: "Modifier",
    delete: "Supprimer",
    deleting: "Suppression…",
    search: "Rechercher",
    actions: "Actions",
    confirm: "Confirmer",
    back: "Retour",
    previous: "Précédent",
    next: "Suivant",
    loading: "Chargement…",
    none: "Aucun",
    yes: "Oui",
    no: "Non",
    active: "Actif",
    inactive: "Inactif",
    all: "Tous",
    required: "Obligatoire",
    optional: "facultatif",
    close: "Fermer",
    noResults: "Aucun résultat.",
    unknown: "Inconnu",
    of: "sur",
    selected: "sélectionné(s)",
    openMenu: "Ouvrir le menu",
    notSet: "Non renseigné",
    current: "Actuelle",
    dangerZone: "Zone sensible",
    irreversible: "Cette action est irréversible.",
  },
  validation: {
    required: "Ce champ est obligatoire.",
    email: "Saisissez une adresse e-mail valide.",
    url: "Saisissez une URL valide.",
    tooShort: "Doit contenir au moins {min} caractères.",
    tooLong: "Ne doit pas dépasser {max} caractères.",
    passwordTooShort: "Le mot de passe doit contenir au moins {min} caractères.",
    invalidNumber: "Saisissez un nombre valide.",
    invalidDate: "Saisissez une date valide.",
    invalidChoice: "Choisissez l'une des options proposées.",
    codeFormat: "Utilisez uniquement des lettres, chiffres et tirets.",
  },
  errors: {
    unexpected: "Une erreur est survenue. Veuillez réessayer.",
    forbidden: "Vous n'avez pas la permission d'effectuer cette action.",
    notFound: "Introuvable.",
    noSchoolYearContext: "Sélectionnez d'abord une année scolaire.",
    noSchoolContext: "Sélectionnez d'abord une école.",
    invalid: "Veuillez vérifier les champs en surbrillance.",
    pageNotFoundTitle: "Page introuvable",
    pageNotFoundBody: "La page que vous recherchez n'existe pas.",
    forbiddenTitle: "Accès refusé",
    forbiddenBody: "Vous n'avez pas la permission de consulter cette page.",
    backToDashboard: "Retour au tableau de bord",
  },
};

/** Sidebar section titles. Modules contribute the entries inside them. */
export const nav = {
  /** Every section's landing entry. The group title says which section. */
  overview: "Tableau de bord",
  main: "Principal",
  vieScolaire: "Vie scolaire",
  finance: "Caisse",
  logistique: "Logistique",
  rh: "Ressources humaines",
  administration: "Administration",
  account: "Compte",
};

export default core;
