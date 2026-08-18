/**
 * Timetable translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  timetable: {
    endedAtWeek:
      "Terminée après la semaine {week}. Les semaines précédentes sont intactes.",
    savedFromWeek:
      "Modifié à partir de la semaine {week}. Les semaines précédentes gardent ce qui a été enseigné.",
    applyToFollowing: "Appliquer aux semaines suivantes",
    applyToFollowingHint:
      "Activé : la séance vaut à partir de cette semaine, jusqu'à nouvel ordre. Désactivé : cette semaine seulement — un échange ponctuel qui ne touche pas au schéma.",
    teacherUnavailable: "Cet enseignant ne travaille pas sur ce créneau. {class}",
    weeksGenerated: "{count} semaines calées pour l'année.",
    generateWeeks: "Caler les semaines de l'année",
    generateWeeksHint:
      "Numérote chaque semaine effectivement enseignée, saute les vacances et alterne A et B. Relançable sans risque — cela renumérote au lieu de dupliquer.",
    generateTimeSlots: "Caler un bloc de créneaux",
    generateTimeSlotsHint:
      "Une heure de début, une durée de créneau, une pause — appliquées à l'identique sur chaque jour coché. Relancez pour l'après-midi, ou pour corriger un jour. Sans risque à relancer : cela corrige les créneaux au lieu de les dupliquer.",
    timeSlotsGenerated: "{count} créneaux calés.",
    session: "Séance",
    startTime: "Débute à",
    periodMinutes: "Durée d'un créneau (minutes)",
    periodCount: "Nombre de créneaux",
    breakAfterPeriod: "Pause après le créneau",
    breakAfterPeriodHint: "0 pour aucune pause dans ce bloc.",
    breakMinutes: "Durée de la pause (minutes)",
    daysToApply: "Jours",
    chooseAtLeastOneDay: "Cochez au moins un jour.",
    weekParity: "Semaines",
    weekParityHint:
      "Les semaines de la rotation où cette séance a lieu. À laisser sur « toutes » sauf si elle est en quinzaine.",
    title: "Emploi du temps",
    subtitle:
      "La semaine d'une classe. Cliquez sur une case pour placer un cours.",
    pickClass: "Choisir une classe",
    pickClassHint: "Chaque classe a sa propre grille.",
    noClasses: "Aucune classe pour cette année.",
    noClassesHint: "Ouvrez d'abord un niveau et créez ses classes.",
    noSlots: "Aucune grille horaire pour cette année.",
    noSlotsHint:
      "Définissez les créneaux dans la configuration avant de dessiner une grille.",
    scheduleKind: "Horaire",
    lessons: "{count} cours",
    free: "Libre",
    breakLabel: "Récréation",
    closed: "Fermé",
    addLesson: "Placer un cours",
    editLesson: "Modifier ce cours",
    subject: "Matière",
    subjectHint: "Le programme propre à la classe.",
    teacher: "Enseignant",
    teacherHint: "Renseigné depuis l'affectation lorsqu'il y en a une.",
    room: "Salle",
    roomHint: "À défaut, la salle attitrée de la classe.",
    group: "Groupe",
    groupHint: "À renseigner quand une seule moitié de la classe assiste.",
    term: "Semestre",
    termHint: "Laisser vide pour un cours qui dure toute l'année.",
    allYear: "Toute l'année",
    wholeClass: "Classe entière",
    saved: "Cours placé.",
    duration: "Durée",
    durationHint: "Un cours double occupe deux créneaux consécutifs.",
    periods: "{count} créneaux",
    repeatOn: "Répéter sur d'autres jours",
    repeatOnHint:
      "Place le même cours sur ce créneau les jours cochés. Le jour cliqué est toujours inclus.",
    savedMany: "Cours placé sur {count} créneaux.",
    classClash: "Cette classe a déjà un cours à {slot}.",
    cleared: "Case vidée.",
    clearSlot: "Vider cette case",
    teacherClash: "Cet enseignant assure déjà {class} à {slot}.",
    roomClash: "Cette salle est déjà occupée par {class} à {slot}.",
    slotUnavailable: "Ce créneau n'appartient pas à cette année.",
    slotIsBreak: "Ce créneau est une récréation — aucun cours ne peut y être placé.",
    openClass: "Ouvrir la classe",
    weekCoverage: "{filled} créneaux remplis sur {total}",
    day: "Jour",
    teacherWeekTitle: "L'emploi du temps de l'enseignant",
    teacherWeekSummary: "{lessons} séances réparties sur {classes} classes.",
    teacherWeekEmpty: "{name} n'a encore aucune séance sur cet horaire.",
    weekNumber: "Semaine {number}",
    exceptionSaved: "Emploi du temps de la semaine mis à jour.",
    exceptionCleared: "Retour à l'emploi du temps habituel.",
    weekOutsideYear: "Cette semaine ne fait pas partie de l'année scolaire.",
    thisWeekOnly: "Cette semaine seulement",
    thisWeekOnlyHint:
      "Ne modifie que la semaine {number}. L'emploi du temps habituel reste inchangé.",
    cancelLesson: "Annuler ce cours",
    reason: "Motif",
    reasonPlaceholder: "Sortie scolaire, rattrapage…",
    replaceLesson: "Remplacer ce cours",
    backToUsual: "Revenir au cours habituel",
    cancelledThisWeek: "Annulé",
    teacherAway: "{name} est absent(e)",
    coveredBy: "Remplacé par {name}",
    notCovered: "Non remplacé",
    previousWeek: "Semaine précédente",
    nextWeek: "Semaine suivante",
    holidayWeek: "Pas de cours cette semaine — {name}.",
    holidayDay: "{name}",
    availabilityTitle: "Horaires des enseignants",
    availabilitySubtitle:
      "Les séances travaillées par chaque enseignant. Aucun cours ne peut être placé en dehors — le générateur en tient compte et la grille le refuse.",
    availabilityHint:
      "Cliquez une séance pour la basculer. Cliquez un jour ou une heure pour basculer toute la ligne ou la colonne.",
    availabilitySaved: "Horaires enregistrés — {count} séance(s) bloquée(s).",
    availableAllWeek: "Disponible toute la semaine",
    working: "Travaille",
    notWorking: "Absent",
    periodsWorked: "Travaille {worked} séances sur {total}",
    periodsOff: "{count} bloquées",
    pickTeacher: "Enseignant",
    noTeachers: "Aucun enseignant dans cet établissement.",
    teacherHours: "Horaires des enseignants",
    generateGrid: "Générer l'emploi du temps",
    generateGridHint:
      "Construit la semaine à partir des heures hebdomadaires du programme, en tenant compte de ce que chaque enseignant et chaque salle font déjà. Rien n'est enregistré tant que vous ne validez pas.",
    generateDraw: "Proposer un emploi du temps",
    reroll: "En proposer un autre",
    applyGrid: "Valider cet emploi du temps",
    gridApplied:
      "{written} séances écrites sur {classes} classe(s) ; {cleared} remplacées.",
    gridAppliedAssigned:
      "{written} séances écrites sur {classes} classe(s) ; {cleared} remplacées, {assigned} enseignant(s) affecté(s).",
    teachersAssigned: "{count} enseignant(s) seront affectés",
    generateScope: "Portée",
    scopeThisClass: "Cette classe uniquement",
    scopeAllClasses: "Toutes les classes ({count})",
    lessonLength: "Dur\u00e9e d\u2019un cours",
    maxPerDay: "Même matière par jour",
    periodsPerDay: "{count} séance(s) au maximum",
    replaceExisting: "Repartir d'une semaine vide",
    replaceExistingHint:
      "Les séances actuelles de la classe sont effacées et toute la semaine est retracée.",
    fillGapsHint:
      "Les séances actuelles sont conservées ; seules les heures manquantes du programme sont placées.",
    allowDoubles: "Autoriser les séances doubles",
    allowDoublesHint:
      "Place deux heures consécutives d'une matière quand la journée le permet. Jamais à cheval sur une récréation.",
    periodsPlaced: "{placed} séances placées sur {requested}",
    classesCovered: "{count} classes",
    understaffed: "Effectif enseignant insuffisant pour ce programme",
    understaffedHint:
      "Le programme demande {demand}h de cours par semaine et les enseignants disponibles peuvent en assurer {available}h. {missing}h ne peuvent être couvertes quelle que soit l'organisation de la semaine — la grille ci-dessous est ce qui tient.",
    shortfalls: "N'ont pas pu être placées",
    periodsMissing: "{count} séance(s) manquante(s)",
    noWeeklyHours: "Aucun volume horaire déclaré, donc écartées",
    noTeacherAssigned: "Placées, mais sans enseignant affecté",

    // ── Ce que la semaine doit encore au programme ──────────────────────────
    programmeGaps: "Reste à placer à la main",
    programmeGapsHint:
      "Le programme en demande plus que la semaine n'en contient — ce que le tirage n'a pas pu caser, et ce qui a été retiré depuis. Cliquez sur une période libre pour les placer vous-même.",
    gapUnstaffed: "sans enseignant",
    undeclaredHours:
      "Aucun volume horaire n'est déclaré pour {subjects} : rien ne peut être placé tant que le programme ne dit pas leur durée.",
    days: {
      "1": "Lundi",
      "2": "Mardi",
      "3": "Mercredi",
      "4": "Jeudi",
      "5": "Vendredi",
      "6": "Samedi",
    },
    daysShort: {
      "1": "Lun",
      "2": "Mar",
      "3": "Mer",
      "4": "Jeu",
      "5": "Ven",
      "6": "Sam",
    },
    weekParities: {
      ALL: "Toutes les semaines",
      A: "Semaine A",
      B: "Semaine B",
    },
    scheduleKinds: {
      STANDARD: "Standard",
      RAMADAN: "Ramadan",
    },
  },
};

export const nav = {
  timetable: "Emploi du temps",
};

export const permissions = {
  groups: {
    timetable: "Emploi du temps",
  },
  codes: {
    "timetable.view": "Consulter les emplois du temps",
    "timetable.manage": "Placer et retirer des cours",
  },
};

export default fr;
