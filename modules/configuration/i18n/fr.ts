/**
 * Configuration translations (fr). Same shape as `en.ts`, which is canonical —
 * a key added there is a compile error here until it is supplied.
 */
const fr = {
  configuration: {
    title: "Configuration",
    subtitle: "Paramétrez le fonctionnement de cette école.",
    scopeSchool: "Configuration de {school}.",
    scopeYear: "{school} — {year}.",
    newItem: "Nouvelle entrée",
    editItem: "Modifier l'entrée",
    created: "Entrée créée.",
    updated: "Entrée mise à jour.",
    deleted: "Entrée supprimée.",
    empty: "Rien de configuré pour le moment.",
    deleteTitle: "Supprimer cette entrée ?",
    deleteBody: "Elle sera retirée de la configuration de cette école.",
    outOfContext:
      "Ce choix n'appartient pas à l'école dans laquelle vous travaillez.",

    arrivalBeforeDeparture: "L'arrivée doit suivre le départ.",
    codeFormatNeedsSequence:
      "Incluez {seq} — sans lui, toutes les références de l'année seraient identiques.",

    sections: {
      school: "Établissement",
      academics: "Structure pédagogique",
      facilities: "Locaux",
      year: "Année scolaire",
      classes: "Classes",
      billing: "Frais",
      treasury: "Caisse",
      logistique: "Transport",
    },

    groups: {
      grading: "Notation",
      calendar: "Semaine scolaire",
      regional: "Langue et monnaie",
      codes: "Matricules",
      billing: "Échéanciers",
      payroll: "Paie",
      other: "Autres",
    },

    resources: {
      schoolWeeks: "Semaines de l'année",
      teacherUnavailability: "Horaires des enseignants",
      transportSchedules: "Horaires de transport",
      banks: "Banques",
      operationCategories: "Rubriques",
      operationSubcategories: "Sous-rubriques",
      operationMotifs: "Motifs",
      schoolSettings: "Réglages",
      educationLevels: "Cycles",
      levels: "Niveaux",
      tracks: "Filières",
      subjects: "Matières",
      programme: "Programme",
      assessmentTypes: "Types de contrôle",
      rooms: "Salles",
      cities: "Villes",
      neighbourhoods: "Quartiers",
      terms: "Semestres",
      holidays: "Vacances et fériés",
      teacherAbsences: "Absences enseignants",
      timeSlots: "Créneaux horaires",
      levelOfferings: "Niveaux ouverts",
      schoolClasses: "Classes",
      classGroups: "Groupes",
      feeTypes: "Types de frais",
      feeRates: "Grille tarifaire",
      discounts: "Remises",
    },

    fields: {
      weekNumber: "Semaine",
      weekParity: "Rotation",
      weekLabel: "Libellé",
      teacher: "Enseignant",
      timeSlot: "Créneau",
      unavailabilityReason: "Motif",
      scheduleDirection: "Sens",
      departureTime: "Départ",
      arrivalTime: "Arrivée",
      region: "Région",
      city: "Ville",
      landmark: "Rue ou repère",
      agency: "Agence",
      accountNumber: "Numéro de compte",
      categoryKind: "Sens",
      operationCategory: "Rubrique",
      gradingMaxScore: "Notes sur",
      passMark: "Moyenne de passage",
      teachingDays: "Jours de classe",
      currencyCode: "Monnaie",
      defaultLocale: "Langue par défaut",
      defaultAccent: "Couleur par défaut",
      studentCodeFormat: "Matricule élève",
      familyCodeFormat: "Numéro de dossier",
      staffCodeFormat: "Matricule personnel",
      defaultInstalmentCount: "Échéances par an",
      feeDueDayOfMonth: "Exigible le",
      payrollWorkingDays: "Jours ouvrables par mois",
      name: "Nom",
      nameAr: "Nom (arabe)",
      code: "Code",
      shortName: "Abréviation",
      massarCode: "Code MASSAR",
      position: "Ordre",
      isActive: "Actif",
      cycle: "Cycle",
      educationLevel: "Cycle",
      level: "Niveau",
      track: "Filière",
      subject: "Matière",
      parentSubject: "Matière parente",
      gradeYear: "Année du cycle",
      defaultCoefficient: "Poids par défaut",
      defaultMaxScore: "Noté sur",
      countsTowardAverage: "Compte dans la moyenne",
      allowTeacherCreate: "Les enseignants peuvent en donner",
      colorHex: "Couleur",
      isLanguage: "Matière de langue",
      requiresLab: "Nécessite un laboratoire",
      coefficient: "Coefficient",
      weeklyMinutes: "Minutes par semaine",
      isGraded: "Notée",
      isEliminatory: "Éliminatoire",
      roomKind: "Type",
      building: "Bâtiment",
      floor: "Étage",
      capacity: "Capacité",
      notes: "Notes",
      termNumber: "Numéro",
      startDate: "Date de début",
      holidayKind: "Type",
      absenceKind: "Motif",
      substitute: "Remplacé par",
      endDate: "Date de fin",
      status: "Statut",
      dayOfWeek: "Jour",
      session: "Séance",
      startTime: "Début",
      endTime: "Fin",
      scheduleKind: "Horaire",
      isBreak: "Récréation",
      levelOffering: "Niveau ouvert",
      plannedCapacity: "Places prévues",
      section: "Section",
      mainTeacher: "Professeur principal",
      room: "Salle habituelle",
      schoolClass: "Classe",
      purpose: "Motif",
      feeKind: "Type",
      billingCycle: "Encaissement",
      isMandatory: "Obligatoire",
      feeType: "Frais",
      amount: "Montant (MAD)",
      instalmentCount: "Échéances",
      discountKind: "Type",
      percentBps: "Pourcentage",
      discountReason: "Motif",
      isStackable: "Cumulable",
    },

    hints: {
      weekNumber:
        "Compte les semaines réellement enseignées — les vacances sont sautées, pas numérotées.",
      weekParity:
        "Alterne A et B pour qu'une séance en quinzaine tienne dans une seule grille. Modifiez une ligne pour décaler la rotation.",
      weekLabel: "Seulement pour les semaines qui en ont un — « Examens », « Rentrée ».",
      timeSlot: "Le créneau où cet enseignant ne travaille pas.",
      unavailabilityReason:
        "Pour qui construit la grille — « cours à l'autre établissement », « temps partiel ».",
      scheduleDirection:
        "Un horaire va dans un seul sens. Un élève qui fait l'aller et le retour est inscrit sur deux d'entre eux, ou sur le circuit lui-même.",
      arrivalTime:
        "À laisser vide tant que la tournée n'a pas été chronométrée.",
      region: "Facultatif — utile seulement pour regrouper une longue liste.",
      holidayEnd: "Inclus — pour un seul jour, répétez la date de début.",
      substitute: "Laisser vide si personne ne remplace.",
      landmark: "Ce qui le situe quand le nom seul ne suffit pas.",
      agency: "L'agence où l'école tient effectivement son compte.",
      accountNumber: "Le compte de l'école, pour les virements qu'elle émet.",
      categoryKind:
        "Le sens dans lequel elle peut être utilisée. Les deux, pour une rubrique comme Régularisation.",
      subcategoryParent:
        "La rubrique dont elle dépend. Une sous-rubrique ne se choisit jamais seule.",
      motifCategory: "Laissez vide pour le proposer sous toutes les rubriques.",
      gradingMaxScore:
        "Le barème par défaut d'un nouveau devoir. Un devoir peut toujours être noté autrement.",
      passMark:
        "En pourcentage du barème : 50 % font 10 sur 20. Détermine les notes affichées en échec.",
      teachingDays: "Jours affichés sur l'emploi du temps et au pointage.",
      currencyCode:
        "Ne change que le libellé — les montants restent enregistrés au centime.",
      defaultLocale:
        "Langue de départ des nouveaux utilisateurs de cette école. Ils peuvent en changer.",
      defaultAccent:
        "Couleur de départ des nouveaux utilisateurs. Ils peuvent en changer.",
      codeFormat:
        "{year} vaut 2025, {yy} vaut 25, {seq:4} vaut 0007. Le reste est repris tel quel.",
      defaultInstalmentCount:
        "Utilisé lorsque un tarif du barème n'en fixe pas lui-même.",
      feeDueDayOfMonth: "Jour du mois où tombe une échéance. Plafonné au 28.",
      payrollWorkingDays:
        "Divise le salaire mensuel pour suggérer un taux journalier. Jamais appliqué d'office.",
      allowTeacherCreate:
        "À activer pour ce qu\u2019un enseignant donne lui-même — les devoirs. Les contrôles restent désactivés : seul le responsable pédagogique les programme.",
      defaultCoefficient:
        "Poids de départ d\u2019un nouveau contrôle de ce type, dans la note de la matière pour le semestre.",
      defaultMaxScore:
        "Les notes sont sur 20 au Maroc, mais un oral ou un TP est souvent sur 10.",
      countsTowardAverage:
        "À désactiver pour un travail noté et montré à la famille mais qui ne doit jamais peser sur la moyenne.",
      position: "Le plus petit s'affiche en premier.",
      massarCode:
        "Le code correspondant dans MASSAR. Laissez vide tant qu'il n'est pas rattaché.",
      levelCode: "Code court du Ministère, ex. 1AP, 3AC, TC, 2BAC.",
      gradeYear: "Rang dans le cycle : 1AP vaut 1, 6AP vaut 6.",
      trackLevel: "Les filières ne concernent que le cycle qualifiant.",
      parentSubject:
        "À renseigner pour en faire une composante, ex. la lecture sous l'arabe.",
      programmeTrack:
        "Laissez vide pour l'appliquer à toutes les filières du niveau.",
      coefficient:
        "Poids dans la moyenne du niveau — ou, pour une composante, à l'intérieur de sa matière parente.",
      weeklyMinutes: "Volume horaire. 2h30 correspond à 150.",
      termNumber: "1 ou 2 pour une année à deux semestres.",
      dayOfWeek: "La semaine va du lundi au samedi.",
      scheduleKind:
        "Conservez une grille de Ramadan à côté de la grille standard.",
      isBreak: "Occupe la grille sans accueillir de cours.",
      offeringTrack: "Laissez vide pour le primaire et le collégial.",
      plannedCapacity:
        "Places à ouvrir sur l'ensemble des classes de ce niveau.",
      mainTeacher: "Responsable de la classe : bulletins, conseil, familles.",
      classRoom: "Là où la classe se tient par défaut.",
      groupSubject:
        "À renseigner lorsque le groupe existe pour une seule matière.",
      billingCycle:
        "La façon dont le montant est encaissé, pas dont il est annoncé.",
      isMandatory: "Les frais obligatoires sont facturés à tout élève inscrit.",
      feeRateLevel:
        "Laissez vide pour appliquer le même tarif à tous les niveaux.",
      amount: "En dirhams. Enregistré au centime près.",
      instalmentCount: "Répartir le montant sur ce nombre de versements.",
      discountKind: "Pourcentage, ou montant fixe en dirhams.",
      percentBps: "En pourcentage : 12,5 correspond à un huitième de remise.",
      discountFeeType: "Laissez vide pour l'autoriser sur tous les frais.",
      isStackable: "Peut être cumulée avec une autre remise.",
    },
  },

  configOptions: {
    weekParities: {
      A: "Semaine A",
      B: "Semaine B",
    },
    scheduleDirections: {
      MORNING: "Matin",
      AFTERNOON: "Après-midi",
    },
    categoryKinds: {
      IN: "Encaissement",
      OUT: "Décaissement",
      BOTH: "Les deux",
    },
    cycles: {
      PRESCHOOL: "Préscolaire",
      PRIMARY: "Primaire",
      SECONDARY_COLLEGE: "Secondaire collégial",
      SECONDARY_QUALIFYING: "Secondaire qualifiant",
    },
    absenceKinds: {
      SICK: "Congé maladie",
      LEAVE: "Congé",
      TRAINING: "Formation",
      OTHER: "Autre",
    },
    holidayKinds: {
      SCHOOL_HOLIDAY: "Vacances scolaires",
      PUBLIC_HOLIDAY: "Jour férié",
      EXAM_PERIOD: "Période d'examens",
      CLOSURE: "Fermeture",
    },
    roomKinds: {
      CLASSROOM: "Salle de classe",
      LAB_SCIENCE: "Laboratoire",
      LAB_COMPUTER: "Salle informatique",
      WORKSHOP: "Atelier",
      SPORTS: "Sport",
      LIBRARY: "Bibliothèque",
      MULTIPURPOSE: "Salle polyvalente",
      OUTDOOR: "Extérieur",
    },
    termStatuses: {
      PLANNED: "Planifié",
      ACTIVE: "En cours",
      CLOSED: "Clôturé",
    },
    days: {
      "1": "Lundi",
      "2": "Mardi",
      "3": "Mercredi",
      "4": "Jeudi",
      "5": "Vendredi",
      "6": "Samedi",
      // Proposé pour l'école qui fait classe le dimanche. Le choix des
      // créneaux ne liste que les jours effectivement déclarés.
      "7": "Dimanche",
    },
    currencies: {
      MAD: "Dirham (MAD)",
      EUR: "Euro (EUR)",
      USD: "Dollar US (USD)",
    },
    locales: {
      fr: "Français",
      en: "English",
      ar: "العربية",
    },
    accents: {
      blue: "Bleu",
      emerald: "Émeraude",
      violet: "Violet",
      amber: "Ambre",
      rose: "Rose",
      teal: "Sarcelle",
      neutral: "Neutre",
    },
    sessions: {
      MORNING: "Matin",
      AFTERNOON: "Après-midi",
    },
    scheduleKinds: {
      STANDARD: "Standard",
      RAMADAN: "Ramadan",
    },
    groupPurposes: {
      LAB: "Travaux pratiques",
      LANGUAGE: "Langue",
      SPORTS: "Sport",
      SUPPORT: "Soutien",
      OTHER: "Autre",
    },
    feeKinds: {
      TUITION: "Scolarité",
      REGISTRATION: "Inscription",
      INSURANCE: "Assurance",
      TRANSPORT: "Transport",
      CANTEEN: "Cantine",
      CLUB: "Club",
      SUPPLIES: "Fournitures",
      UNIFORM: "Tenue",
      EXAM: "Examen",
      OTHER: "Autre",
    },
    billingCycles: {
      ANNUAL: "Annuel",
      MONTHLY: "Mensuel",
      TERM: "Par semestre",
      ONE_OFF: "Ponctuel",
    },
    discountKinds: {
      PERCENTAGE: "Pourcentage",
      FIXED_AMOUNT: "Montant fixe",
    },
    discountReasons: {
      SIBLING: "Fratrie",
      STAFF: "Enfant du personnel",
      EARLY_PAYMENT: "Paiement anticipé",
      SCHOLARSHIP: "Bourse",
      MERIT: "Mérite",
      HARDSHIP: "Cas social",
      OTHER: "Autre",
    },
  },
};

/** Sidebar label this module contributes to the `nav` namespace. */
export const nav = { configuration: "Configuration" };

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: { configuration: "Configuration" },
  codes: {
    "configuration.view": "Consulter la configuration",
    "configuration.manage": "Gérer la configuration",
  },
};

export default fr;
