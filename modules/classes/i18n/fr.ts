/**
 * Classes translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  schoolClass: {
    title: "Classes",
    subtitle:
      "Les classes de l'année — qui y est affecté, qui y enseigne.",
    noClasses: "Aucune classe pour cette année.",
    noClassesHint:
      "Ouvrez un niveau dans la configuration, puis créez ses classes.",
    searchPlaceholder: "Rechercher par code de classe ou niveau…",
    classColumn: "Classe",
    level: "Niveau",
    mainTeacher: "Professeur principal",
    room: "Salle",
    capacity: "Capacité",
    enrolled: "Effectif",
    fill: "{enrolled} / {capacity}",
    noCapacity: "Sans limite",
    overCapacity: "Effectif dépassé",
    groups: "Groupes",
    lessons: "Cours",

    tabRoster: "Élèves",
    tabTeaching: "Enseignants",
    tabTimetable: "Emploi du temps",

    roster: "Effectif",
    rosterHint: "Les élèves affectés à cette classe pour l'année.",
    rosterAssignHint:
      "Déplacez les élèves d'une liste à l'autre. À gauche, tous les inscrits à ce niveau sans classe.",
    tabAssign: "Affecter",
    tabList: "Liste de classe",
    availableTitle: "Inscrits sans classe",
    assignedTitle: "Dans {class}",
    studentsRemoved: "{count} élèves retirés de la classe.",
    seatsLeftHint: "{count} places restantes dans cette classe.",
    emptyRoster: "Aucun élève dans cette classe.",
    emptyRosterHint:
      "Ajoutez des élèves inscrits à ce niveau et non encore affectés.",
    noCandidates: "Tous les inscrits à ce niveau ont déjà une classe.",
    studentsAdded: "{count} élèves ajoutés.",
    group: "Groupe",
    noGroup: "Aucun groupe",
    setGroup: "Changer de groupe",

    teaching: "Affectations pédagogiques",
    teachingHint: "Qui est responsable de chaque matière dans cette classe.",
    emptyTeaching: "Aucune matière affectée.",
    emptyTeachingHint:
      "Affectez un enseignant à chaque matière du programme.",
    assignTeacher: "Affecter un enseignant",
    editAssignment: "Modifier l'affectation",
    subject: "Matière",
    teacher: "Enseignant",
    weeklyMinutes: "Minutes par semaine",
    weeklyMinutesHint:
      "En général la charge du programme. Laissez vide pour l'utiliser.",
    isPrimary: "Responsable des notes",
    isPrimaryHint: "Un seul enseignant par matière porte cette responsabilité.",
    primaryBadge: "Notes",
    wholeClass: "Classe entière",
    assignmentSaved: "Affectation enregistrée.",
    assignmentDeleted: "Affectation supprimée.",
    assignmentExists: "Cet enseignant assure déjà cette matière ici.",
    teacherUnavailable: "Cet enseignant n'a pas accès à cette école.",
    deleteAssignmentTitle: "Supprimer cette affectation ?",
    deleteAssignmentBody: "« {name} » n'assurera plus {subject} ici.",
    openTimetable: "Ouvrir l'emploi du temps complet",
  },
};

export const nav = {
  classes: "Classes",
};

export const permissions = {
  groups: {
    class: "Classes",
  },
  codes: {
    "class.view": "Consulter les classes",
    "class.roster": "Gérer les effectifs des classes",
    "class.assignTeacher": "Affecter les enseignants aux matières",
  },
};

export default fr;
