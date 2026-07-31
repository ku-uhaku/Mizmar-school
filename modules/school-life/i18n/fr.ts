/**
 * School-life translations (fr). Same shape as `en.ts`, which is canonical — a
 * key added there is a compile error here until it is supplied.
 */
const fr = {
  schoolLife: {
    assessmentsHint: "Les épreuves de l'année et les notes qui vont avec.",
    attendanceHint: "Absences et retards, sur la fiche de chaque élève.",
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
    familiesHint: "Les dossiers, qui appeler, et les enfants de chacun.",
    studentsHint: "Tous les enfants inscrits, leur niveau et leur classe.",
    classesHint: "Les classes de l'année, et leur remplissage.",
    timetableHint: "La semaine que suit chaque classe, heure par heure.",
    unplacedCount: "{count} à affecter",
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
