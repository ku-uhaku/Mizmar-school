/**
 * School years translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  schoolYear: {
    title: "Années scolaires",
    subtitle: "Années scolaires de {school}.",
    subtitleNoSchool: "Choisissez une école pour gérer ses années scolaires.",
    newYear: "Nouvelle année scolaire",
    editYear: "Modifier l'année scolaire",
    createYear: "Créer l'année scolaire",
    name: "Libellé",
    nameHint: "Par exemple 2025-2026",
    startDate: "Date de début",
    endDate: "Date de fin",
    status: "Statut",
    isDefault: "Année par défaut",
    makeDefault: "Définir par défaut",
    defaultBadge: "Par défaut",
    created: "Année scolaire créée.",
    updated: "Année scolaire mise à jour.",
    deleted: "Année scolaire supprimée.",
    deleteTitle: "Supprimer cette année scolaire ?",
    deleteBody: "« {name} » sera définitivement supprimée.",
    nameTaken: "Ce libellé existe déjà pour cette école.",
    endBeforeStart: "La date de fin doit être postérieure à la date de début.",
    noYears: "Aucune année scolaire pour cette école.",
    statuses: {
      PLANNED: "Planifiée",
      ACTIVE: "En cours",
      CLOSED: "Clôturée",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  schoolYears: "Années scolaires",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    schoolYear: "Années scolaires",
  },
  codes: {
    "schoolYear.view": "Consulter les années scolaires",
    "schoolYear.create": "Créer des années scolaires",
    "schoolYear.update": "Modifier les années scolaires",
    "schoolYear.delete": "Supprimer des années scolaires",
  },
};

export default fr;
