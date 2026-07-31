/**
 * School-life translations (fr). Same shape as `en.ts`, which is canonical — a
 * key added there is a compile error here until it is supplied.
 */
const fr = {
  schoolLife: {
    title: "Vie scolaire",
    subtitle: "{school} — {year}, à ce jour.",
    noYear: "Sélectionnez une année scolaire pour voir les chiffres.",
    students: "Élèves",
    studentsDetail: "{count} inscrits",
    families: "Dossiers familiaux",
    familiesDetail: "Foyers enregistrés",
    pending: "Inscriptions en attente",
    pendingDetail: "Demandées, non confirmées",
    unplaced: "En attente de classe",
    unplacedDetail: "Inscrits mais non affectés",
    billed: "Facturé cette année",
    billedDetail: "Net de réductions",
    discounted: "Réductions accordées",
    byLevel: "Élèves par niveau",
    byLevelHint: "Sur les niveaux ouverts par cette école cette année.",
    classFill: "Remplissage des classes",
    classFillHint: "Effectif par rapport à la capacité.",
    noClasses: "Aucune classe ouverte.",
    noLevels: "Aucun niveau ouvert pour cette année.",
    pipeline: "À traiter",
    pipelineHint: "Les dossiers dont le parcours n'est pas terminé.",
    allDone: "Rien en attente.",
    openStudents: "Ouvrir la liste des élèves",
    openClasses: "Ouvrir la liste des classes",

    search: "Rechercher",
    searchPlaceholder: "Rechercher élèves, familles, classes…",
    searchHint: "Saisissez au moins deux caractères.",
    searchEmpty: "Aucun résultat.",
    searchStudents: "Élèves",
    searchFamilies: "Familles",
    searchClasses: "Classes",
  },
};

export const nav = {
};

export const permissions = {
  groups: {
    schoolLife: "Vie scolaire",
  },
  codes: {
    "schoolLife.view": "Consulter la vue d'ensemble de la vie scolaire",
  },
};

export default fr;
