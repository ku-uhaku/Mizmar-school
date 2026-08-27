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
    searchPlaceholder: "Rechercher par code de classe, niveau ou cycle…",
    classColumn: "Classe",
    level: "Niveau",
    cycle: "Cycle",
    mainTeacher: "Professeur principal",
    room: "Salle",
    capacity: "Capacité",
    enrolled: "Effectif",
    fill: "{enrolled} / {capacity}",
    noCapacity: "Sans limite",
    overCapacity: "Effectif dépassé",
    groups: "Groupes",
    lessons: "Cours",

    tabOverview: "Aperçu",
    tabRoster: "Élèves",
    tabTeaching: "Enseignants",
    tabTimetable: "Emploi du temps",
    tabRegister: "Appel",
    tabControls: "Contrôles",
    tabDevoirs: "Devoirs",

    // ── L'onglet aperçu : la classe, et le niveau où elle se situe ──────────
    overviewStaffed: "Matières couvertes",
    overviewOfSubjects: "sur {count} au programme",
    overviewProgrammeHours: "{hours} h par semaine au programme",
    overviewGroups: "Groupes",
    overviewAverageAge: "Âge moyen {age}",
    overviewRepeating: "Redoublants",
    overviewFill: "Remplissage",
    overviewProgramme: "Le programme du niveau",
    overviewProgrammeHint:
      "Ce que {level} suit, et qui en répond dans cette classe — {hours} h par semaine.",
    overviewWeeklyHours: "Heures",
    overviewUnstaffed: "Sans enseignant",
    overviewNoProgramme:
      "Ce niveau n'a pas encore de programme. Déclarez ses matières dans la configuration.",
    overviewSameProgramme: "même programme",
    overviewSisters: "Classes de ce niveau",
    overviewSistersHint: "{classes} classes en {level}, {enrolled} élèves au total.",
    // ── Les résultats et le carnet ─────────────────────────────────────────
    overviewAverage: "Moyenne de la classe",
    overviewOutOf: "sur {outOf} — {term}",
    overviewHoursBySubject: "Heures par matière",
    overviewHoursHint: "{hours} h par semaine sur {subjects} matières.",
    overviewCoverage: "Couverture",
    overviewCoverageHint:
      "Ce que le niveau promet, et ce qui est réellement en place.",
    overviewStaffedCaption: "{staffed} matières sur {subjects} ont un enseignant.",
    overviewCoverageCaption: "{placed} séances placées sur {needed}.",
    overviewResults: "Résultats",
    overviewResultsHint:
      "{term} : {computed} bulletins calculés, {published} édités.",
    overviewNoResults: "Pas encore de bulletins",
    overviewNoResultsHint:
      "Rien à moyenner pour l'instant. Les bulletins se calculent pour le conseil de classe, et cet onglet se remplit à partir d'eux.",
    overviewSpread: "plus basse {lowest} · plus haute {highest}",
    overviewPassRate: "Taux de réussite",
    overviewPassMark: "À {mark} sur {outOf} ou plus.",
    overviewBySubject: "Moyenne de la classe par matière",
    overviewNoSubjectAverages: "Aucune matière n'a encore été notée.",
    overviewRemarks: "Remarques",
    overviewRemarksHint: "{count} remarques récentes, dont {concerns} signalements.",
    overviewNoRemarks: "Rien n'a encore été écrit sur cette classe.",
    // ── La semaine, les absences et les périodes, en graphiques ────────────
    overviewLoadByDay: "Séances par jour",
    overviewLoadByDayHint:
      "Comment les {placed} séances placées se répartissent sur la semaine.",
    overviewPeriods: "Séances",
    overviewDay: "Jour",
    overviewNoTimetable: "Aucun emploi du temps n'a encore été dressé pour cette classe.",
    overviewAttendance: "Assiduité",
    overviewAttendanceHint:
      "{marked} appels faits cette année, {unjustified} absences encore non justifiées.",
    overviewAttendanceByMonth: "Assiduité mois par mois",
    overviewNoAttendance: "Aucun appel n'a encore été fait pour cette classe.",
    overviewAverageByTerm: "Moyenne par période",
    overviewAverageByTermHint:
      "La moyenne de la classe, telle que chaque période l'a calculée.",
    overviewSistersFill: "Élèves par classe",
    newControl: "Nouveau contrôle",
    newDevoir: "Nouveau devoir",

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
    viewList: "Vue liste",
    viewCards: "Vue cartes",
    setGroup: "Changer de groupe",

    teaching: "Affectations pédagogiques",
    subjectColumn: "Unité scolaire",
    teacherColumn: "Enseignant(e)",
    pickTeacher: "Choisir un enseignant",
    unstaffedSubjects: "{count} matières n'ont pas encore d'enseignant.",
    teacherCleared: "Enseignant retiré.",
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
