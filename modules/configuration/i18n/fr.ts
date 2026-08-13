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
    inUse:
      "Impossible de supprimer — {count} autre(s) fiche(s) l'utilisent encore. Retirez-les ou réaffectez-les d'abord.",

    sections: {
      school: "Établissement",
      academics: "Structure pédagogique",
      facilities: "Locaux",
      staff: "Personnel",
      year: "Année scolaire",
      classes: "Classes",
      billing: "Frais",
      treasury: "Caisse",
      supplies: "Fournitures",
      logistique: "Transport",
    },

    scopeGroups: {
      general: "Configuration générale",
      year: "Année scolaire",
    },

    groups: {
      billing: "Échéances",
      parents: "Espace parents",
    },

    resources: {
      schoolWeeks: "Semaines de l'année",
      teacherUnavailability: "Horaires des enseignants",
      transportSchedules: "Horaires de transport",
      supplyArticles: "Catalogue de fournitures",
      documentTypes: "Pi\u00e8ces du dossier",
      requestTypes: "Documents demandables",
      suppliers: "Fournisseurs",
      banks: "Banques",
      operationCategories: "Rubriques",
      operationSubcategories: "Sous-rubriques",
      operationMotifs: "Motifs",
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
      schoolSettings: "Règles de facturation",
      feeTypes: "Types de frais",
      feeRates: "Grille tarifaire",
      discounts: "Remises",
    },

    fields: {
      parentChatEnabled: "Groupe de tous les parents",
      parentClassChatEnabled: "Groupes par classe",
      defaultInstalmentCount: "Échéances par an",
      feeDueDayOfMonth: "Exigible le",
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
      teacherSubjects: "Qui enseigne quoi",
      preferenceRank: "Priorité",
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
      gradesWholeSubject: "Porte sur la matière entière",
      allowTeacherCreate: "Les enseignants peuvent en donner",
      supplyCategory: "Famille",
      defaultQuantity: "Quantit\u00e9 habituelle",
      supplyArticleNotes: "D\u00e9tail",
      supplierKind: "Type",
      defaultCategory: "Impute sur",
      accountRef: "N\u00b0 de contrat",
      isRequiredDocument: "Obligatoire",
      copies: "Exemplaires",
      documentNotes: "Pr\u00e9cision",
      requestDescription: "À quoi il sert",
      requestDescriptionAr: "À quoi il sert (arabe)",
      usualDelayDays: "Délai habituel (jours)",
      requiresReason: "Demander le motif",
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
      perInstalment: "Même montant à chaque échéance",
      discountKind: "Type",
      percentBps: "Pourcentage",
      discountReason: "Motif",
      isStackable: "Cumulable",
    },

    hints: {
      parentChatEnabled:
        "Une discussion entre tous les parents de l'école. Désactivé, personne ne peut la lire ni y écrire.",
      parentClassChatEnabled:
        "Une discussion par classe, entre les parents de cette classe seulement. Indépendante de celle de l'école.",
      defaultInstalmentCount:
        "En combien d'échéances un frais mensuel est réparti. Laissez 0 pour suivre l'année scolaire — une année de douze mois est alors facturée douze fois. Un tarif qui fixe son propre nombre l'emporte.",
      feeDueDayOfMonth:
        "Jour du mois où chaque échéance tombe. Plafonné à 28 pour qu'il existe en février.",
      supplierKind:
        "Les r\u00e9gies, le bailleur et les prestataires apparaissent sur l\u2019\u00e9cran Factures ; les fournisseurs sur Achats.",
      defaultCategory:
        "La rubrique sur laquelle ses paiements sont imput\u00e9s. Pr\u00e9-remplie, pour n\u2019avoir plus \u00e0 la choisir.",
      accountRef:
        "Le num\u00e9ro de contrat ou de police \u2014 affich\u00e9 \u00e0 c\u00f4t\u00e9 du montant pour v\u00e9rifier la facture.",
      isRequiredDocument:
        "Seule une pi\u00e8ce obligatoire peut bloquer une inscription. Une pi\u00e8ce facultative est tout de m\u00eame demand\u00e9e et affich\u00e9e.",
      copies:
        "Combien en apporter \u2014 \u00ab 2 photos d'identit\u00e9 \u00bb. \u00c0 laisser vide lorsqu\u2019un seul exemplaire suffit.",
      documentNotes:
        "O\u00f9 l\u2019obtenir, de quand elle doit dater \u2014 ce que le nom ne dit pas.",
      requestDescription:
        "Affiché à la famille sous le nom, là où elle choisit entre quatre documents qu'elle connaît mal.",
      usualDelayDays:
        "Propose la date lorsque le secrétariat accepte une demande. Laissez vide pour ne rien promettre.",
      requiresReason:
        "Pour les documents que vous ne rédigez pas sans savoir — la formulation dépend du destinataire.",
      supplyCategory:
        "Le rayon de papeterie o\u00f9 l\u2019article se trouve. Le s\u00e9lecteur des listes s\u2019y regroupe.",
      defaultQuantity:
        "Pr\u00e9-remplie quand un enseignant choisit l\u2019article. \u00c0 laisser vide pour ce qui se compte \u00e0 l\u2019\u0153il.",
      supplyArticleNotes:
        "Format, r\u00e9glure, taille \u2014 ce qui appartient \u00e0 l\u2019article et non \u00e0 une liste.",
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
      preferenceRank:
        "Le plus bas passe en premier quand plusieurs enseignants peuvent prendre la matière. 0 pour un spécialiste, plus haut pour un remplaçant.",
      payrollWorkingDays:
        "Divise le salaire mensuel pour suggérer un taux journalier. Jamais appliqué d'office.",
      gradesWholeSubject:
        "\u00c0 activer pour ce qui se passe sur la mati\u00e8re enti\u00e8re en une \u00e9preuve \u2014 contr\u00f4les et oraux. D\u00e9sactiv\u00e9, c\u2019est une \u00e9preuve par composante, comme pour un devoir.",
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
      perInstalment:
        "Désactivé : le montant ci-dessus est le total, réparti sur les échéances (scolarité). Activé : il est facturé en entier à chacune (cantine ou transport à tarif mensuel fixe).",
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
    supplyCategories: {
      ECRITURE: "\u00c9criture",
      CAHIERS: "Cahiers",
      COUVERTURES: "Couvertures",
      CLASSEMENT: "Classement",
      GEOMETRIE: "G\u00e9om\u00e9trie",
      ARTS: "Arts plastiques",
      CARTABLE: "Cartable et trousse",
      SPORT: "Sport",
      HYGIENE: "Hygi\u00e8ne",
      AUTRE: "Divers",
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
