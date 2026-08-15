/**
 * Classroom translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * there is a compile error until this file supplies it.
 */
const fr = {
  classroom: {
    attendanceStatus: "Statut",
    date: "Date",
    attendanceRate: "Assiduité",
    ofMarkedDays: "sur {count} relevés",
    unjustified: "Non justifié",
    unjustifiedCount: "{count} non justifié(s)",
    excusedHint: "Absences acceptées par l'établissement.",
    minutesLateShort: "{count} min",
    recordedBy: "Relevé par",
    noAttendanceYet: "Aucun appel effectué.",
    noAttendanceHint: "Les appels se font dans l'espace enseignant.",
    noRemarksYet: "Rien d'écrit pour le moment.",
    title: "Espace enseignant",
    subtitle: "Vos classes, vos appels et vos corrections.",

    // ── L'accueil de l'espace ───────────────────────────────────────────────
    myClasses: "Mes classes",
    myTimetable: "Mon emploi du temps",
    myTimetableHint: "Où vous êtes attendu, semaine par semaine.",
    lessonsPerWeek: "Heures par semaine",
    freePeriods: "Heures libres",
    freePeriodsHint: "Quand on peut vous trouver.",
    noLessonsThisWeek: "Rien à votre emploi du temps pour cet horaire.",
    noLessonsThisWeekHint:
      "Les cours apparaissent ici dès que l'emploi du temps de vos classes est établi.",
    myClassesHint:
      "Chaque classe et matière qui vous est affectée cette année.",
    noClasses: "Vous n'êtes affecté à aucune classe cette année.",
    noClassesHint:
      "Une classe apparaît ici dès que le responsable pédagogique vous y affecte.",
    classesCount: "{count} classes",
    pupilsTaught: "Élèves suivis",
    lessonsToday: "Cours aujourd'hui",
    registersLeft: "Appels à faire",
    papersToMark: "Copies à corriger",
    remarksThisMonth: "Remarques ce mois-ci",
    today: "Aujourd'hui",
    noLessonsToday: "Aucun cours à votre emploi du temps aujourd'hui.",
    takeRegister: "Faire l'appel",
    registerTaken: "Appel fait",
    openMarkSheet: "Ouvrir la feuille de notes",

    // ── L'appel ─────────────────────────────────────────────────────────────
    attendance: "Appel",
    attendanceHint: "Qui était en classe, et qui est arrivé en retard.",
    register: "Feuille d'appel",
    lesson: "Cours",
    wholeDay: "Journée entière",
    pupil: "Élève",
    status: "Statut",
    minutesLate: "Minutes de retard",
    reason: "Motif",
    saveRegister: "Enregistrer l'appel",
    registerSaved: "{count} élèves enregistrés.",
    markAllPresent: "Tous présents",
    notYourClass: "Vous n'enseignez pas dans cette classe.",
    minutesOutOfRange: "Le retard doit être compris entre 0 et 120 minutes.",
    thisYear: "Cette année",
    absencesShort: "{count} abs.",
    latesShort: "{count} ret.",
    pickLesson: "Choisissez une classe et une matière",
    pickLessonHint:
      "Prenez une de vos classes, puis le jour et l'heure concernés.",
    justified: "Justifié",
    justificationSaved: "Justificatif mis à jour.",

    // ── Devoirs ─────────────────────────────────────────────────────────────
    devoirs: "Devoirs",
    devoirsHint: "Le travail que vous avez donné, et les notes qui vont avec.",
    newDevoir: "Donner un devoir",
    newDevoirTitle: "Donner un devoir",
    newDevoirHint:
      "Pour une de vos classes. Il est publié aussitôt, vous pouvez donc saisir les notes dès la remise.",
    devoirCreated: "Devoir créé.",
    devoirTitle: "Intitulé",
    dueOn: "À rendre le",
    noDevoirs: "Vous n'avez encore donné aucun devoir.",
    noDevoirsHint:
      "Donnez-en un et il apparaîtra ici avec sa feuille de notes.",
    kindNotAllowed:
      "Votre école n'autorise pas les enseignants à donner ce type de travail.",
    noTeacherKinds:
      "Aucun type de travail n'est ouvert aux enseignants. Demandez-en un dans la configuration.",
    papersToMarkHint:
      "Vos contrôles et vos propres devoirs. Saisissez les notes, puis remettez les contrôles.",

    // ── Le sujet ────────────────────────────────────────────────────────────
    questions: "Questions",
    questionsHint:
      "Facultatif. Rédigez le sujet ici : la note maximale suit le barème que vous donnez à chaque question.",
    questionPlaceholder: "Énoncé de la question",
    questionPoints: "Points",
    addQuestion: "Ajouter une question",
    removeQuestion: "Supprimer cette question",
    questionsTotal: "Barème : {total} points",
    noQuestions: "Aucun sujet n'a été rédigé pour ce devoir.",

    // ── Remarques ───────────────────────────────────────────────────────────
    remarks: "Remarques",
    remarksHint: "Ce que vous avez noté sur vos élèves.",
    newRemark: "Écrire une remarque",
    newRemarkTitle: "Écrire une remarque",
    remarkAbout: "Concerne",
    remarkKind: "Type",
    remarkTone: "Ton",
    remarkBody: "Remarque",
    remarkBodyHint: "Une phrase qu'un collègue — ou un parent — comprendrait.",
    occurredOn: "Constaté le",
    visibleToFamily: "Communiquer à la famille",
    visibleToFamilyHint:
      "Désactivé par défaut. Une note interne reste entre vous et vos collègues.",
    internalOnly: "Interne",
    shared: "Communiquée à la famille",
    remarkSaved: "Remarque enregistrée.",
    remarkDeleted: "Remarque supprimée.",
    remarkPublished: "Remarque transmise à la famille.",
    remarkUnpublished: "Remarque retirée de la famille.",
    awaitingRelease: "En attente de validation",
    releaseToFamily: "Transmettre à la famille",
    withdrawFromFamily: "Retirer",
    deleteRemarkTitle: "Supprimer cette remarque ?",
    deleteRemarkBody: "Votre remarque sur {name} sera supprimée.",
    notYourRemark: "Vous ne pouvez supprimer que vos propres remarques.",
    notYourPupil: "Vous n'enseignez pas à cet élève.",
    sharedWithFamily: "{count} transmises \u00e0 la famille",
    noRemarks: "Aucune remarque pour le moment.",
    noRemarksHint:
      "Une remarque, c'est la phrase que vous garderiez sinon dans votre carnet.",
    mineOnly: "Les miennes seulement",
    remarksReview: "Suivi des remarques",
    showingFirst: "Les {count} plus récentes. Affinez les filtres pour voir les autres.",
    remarksReviewHint: "Ce que les enseignants ont écrit sur les élèves, et ce qui attend une décision.",
    filterTeacher: "Enseignant",
    allTeachers: "Tous les enseignants",
    filterClass: "Classe",
    allClasses: "Toutes les classes",
    searchRemarks: "Rechercher une remarque…",
    chooseClass: "Choisir une classe",
    choosePupil: "Choisir un élève",
    chooseClassFirst: "Choisissez d'abord une classe",
  },
  classroomOptions: {
    attendanceStatuses: {
      PRESENT: "Présent",
      LATE: "En retard",
      ABSENT: "Absent",
      EXCUSED: "Absence justifiée",
    },
    remarkKinds: {
      BEHAVIOUR: "Comportement",
      WORK: "Travail",
      PROGRESS: "Progrès",
      ATTENDANCE: "Assiduité",
      OTHER: "Autre",
    },
    remarkTones: {
      POSITIVE: "Positif",
      NEUTRAL: "Neutre",
      CONCERN: "Préoccupant",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  remarksReview: "Suivi des remarques",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    classroom: "Espace enseignant",
  },
  codes: {
    "classroom.workspace": "Ouvrir l'espace enseignant sur l'application",
    "classroom.attendanceView": "Consulter l'appel",
    "classroom.attendanceMark": "Faire l'appel",
    "classroom.attendanceJustify": "Justifier une absence",
    "classroom.remarkView": "Lire les remarques",
    "classroom.remarkWrite": "Écrire des remarques",
    "classroom.remarkPublish": "Communiquer une remarque à la famille",
  },
};

export default fr;
