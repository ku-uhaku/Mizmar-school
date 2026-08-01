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
