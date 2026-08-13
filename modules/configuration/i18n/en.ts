/**
 * Configuration translations (en).
 *
 * Two namespaces. `configuration` holds the screens' own wording; `configOptions`
 * holds the enum labels, kept separate because the Dictionary type widens only
 * three levels deep and `configuration.options.roomKinds.CLASSROOM` would be
 * four.
 */
const en = {
  configuration: {
    title: "Configuration",
    subtitle: "Set up how this school works.",
    scopeSchool: "Configuration for {school}.",
    scopeYear: "{school} — {year}.",
    newItem: "New entry",
    editItem: "Edit entry",
    created: "Entry created.",
    updated: "Entry updated.",
    deleted: "Entry deleted.",
    empty: "Nothing configured yet.",
    deleteTitle: "Delete this entry?",
    deleteBody: "It will be removed from this school's configuration.",
    outOfContext:
      "That choice does not belong to the school you are working in.",
    arrivalBeforeDeparture: "The arrival must come after the departure.",
    inUse:
      "Can't delete this — {count} other record(s) still use it. Remove or reassign those first.",

    sections: {
      school: "Establishment",
      academics: "Academic structure",
      facilities: "Facilities",
      staff: "Staff",
      year: "School year",
      classes: "Classes",
      billing: "Fees",
      treasury: "Caisse",
      supplies: "Supplies",
      logistique: "Transport",
    },

    /** The two tabs `sections` are clustered under — see `SCOPE_GROUPS`. */
    scopeGroups: {
      general: "General configuration",
      year: "School year",
    },

    /**
     * Fieldset headings for a singleton's form — see `FieldDef.groupKey`.
     * Empty for now: no resource is a singleton since Settings was removed
     * (it did not work and nobody used it — see the note on `RESOURCES`), but
     * the shape stays so the next one does not have to rebuild it.
     */
    groups: {
      billing: "Instalments",
      parents: "Parents' space",
    },

    resources: {
      schoolWeeks: "Weeks of the year",
      teacherUnavailability: "Teacher availability",
      transportSchedules: "Transport timetables",
      supplyArticles: "Supply catalogue",
      documentTypes: "Dossier documents",
      requestTypes: "Documents families may request",
      suppliers: "Suppliers",
      banks: "Banks",
      operationCategories: "Rubrics",
      operationSubcategories: "Sub-rubrics",
      operationMotifs: "Reasons",
      educationLevels: "Cycles",
      levels: "Levels",
      tracks: "Tracks",
      subjects: "Subjects",
      programme: "Programme",
      assessmentTypes: "Assessment kinds",
      rooms: "Rooms",
      cities: "Towns",
      neighbourhoods: "Districts",
      terms: "Terms",
      holidays: "Holidays",
      teacherAbsences: "Teacher absences",
      timeSlots: "Time slots",
      levelOfferings: "Levels offered",
      schoolClasses: "Classes",
      classGroups: "Groups",
      schoolSettings: "Billing policy",
      feeTypes: "Fee types",
      feeRates: "Price list",
      discounts: "Discounts",
    },

    fields: {
      parentChatEnabled: "School-wide parent group",
      parentClassChatEnabled: "Class parent groups",
      defaultInstalmentCount: "Instalments per year",
      feeDueDayOfMonth: "Due on the",
      weekNumber: "Week",
      weekParity: "Rotation",
      weekLabel: "Name",
      teacher: "Teacher",
      timeSlot: "Period",
      unavailabilityReason: "Reason",
      scheduleDirection: "Direction",
      departureTime: "Departs",
      arrivalTime: "Arrives",
      region: "Region",
      city: "Town",
      landmark: "Street or landmark",
      agency: "Branch",
      accountNumber: "Account number",
      categoryKind: "Side",
      operationCategory: "Rubric",
      teacherSubjects: "Who teaches what",
      preferenceRank: "Priority",
      name: "Name",
      nameAr: "Name (Arabic)",
      code: "Code",
      shortName: "Short name",
      massarCode: "MASSAR code",
      position: "Order",
      isActive: "Active",
      cycle: "Cycle",
      educationLevel: "Cycle",
      level: "Level",
      track: "Track",
      subject: "Subject",
      parentSubject: "Parent subject",
      gradeYear: "Year in cycle",
      defaultCoefficient: "Default weight",
      defaultMaxScore: "Marked out of",
      countsTowardAverage: "Counts toward the average",
      gradesWholeSubject: "Sat on the whole matière",
      allowTeacherCreate: "Teachers may set this",
      supplyCategory: "Family",
      defaultQuantity: "Usual quantity",
      supplyArticleNotes: "Detail",
      supplierKind: "Kind",
      defaultCategory: "Posts under",
      accountRef: "Account no.",
      isRequiredDocument: "Required",
      copies: "Copies",
      documentNotes: "Note",
      requestDescription: "What it is for",
      requestDescriptionAr: "What it is for (Arabic)",
      usualDelayDays: "Usual delay (days)",
      requiresReason: "Ask what it is for",
      colorHex: "Colour",
      isLanguage: "Language subject",
      requiresLab: "Needs a lab",
      coefficient: "Coefficient",
      weeklyMinutes: "Minutes per week",
      isGraded: "Graded",
      isEliminatory: "Eliminatory",
      roomKind: "Type",
      building: "Building",
      floor: "Floor",
      capacity: "Capacity",
      notes: "Notes",
      termNumber: "Number",
      startDate: "Start date",
      holidayKind: "Kind",
      absenceKind: "Reason",
      substitute: "Covered by",
      endDate: "End date",
      status: "Status",
      dayOfWeek: "Day",
      session: "Session",
      startTime: "Starts",
      endTime: "Ends",
      scheduleKind: "Schedule",
      isBreak: "Break",
      levelOffering: "Level offered",
      plannedCapacity: "Planned places",
      section: "Section",
      mainTeacher: "Main teacher",
      room: "Home room",
      schoolClass: "Class",
      purpose: "Purpose",
      feeKind: "Type",
      billingCycle: "Billing",
      isMandatory: "Mandatory",
      feeType: "Fee",
      amount: "Amount (MAD)",
      instalmentCount: "Instalments",
      perInstalment: "Same amount each instalment",
      discountKind: "Kind",
      percentBps: "Percentage",
      discountReason: "Reason",
      isStackable: "Combinable",
    },

    hints: {
      parentChatEnabled:
        "One conversation between every parent in the school. Off means nobody can read or post it.",
      parentClassChatEnabled:
        "A conversation per class, between that class's parents only. Independent of the school-wide one.",
      defaultInstalmentCount:
        "How many instalments a monthly fee is split into. Leave at 0 to follow the school year — a twelve-month year then bills twelve times. A price list that names its own count still wins.",
      feeDueDayOfMonth:
        "Day of the month each instalment falls due. Capped at 28 so it exists in February.",
      supplierKind:
        "Utilities, the landlord and service contracts appear on the Bills screen; vendors on the Purchases one.",
      defaultCategory:
        "The rubrique this supplier\u2019s payments are filed under. Filled in automatically, so nobody has to choose it each time.",
      accountRef:
        "The contract or police number the school is billed under \u2014 shown beside the amount so a facture can be checked against it.",
      isRequiredDocument:
        "Only a required piece can hold an inscription up. An optional one is still asked for and still listed.",
      copies:
        "How many to bring \u2014 \"2 photos d'identit\u00e9\". Leave blank when one is meant.",
      documentNotes:
        "Where to get it, how recent it must be \u2014 anything the name cannot say.",
      requestDescription:
        "Shown to the family under the name, where they are choosing between four things they half know.",
      usualDelayDays:
        "Suggests the day when the office accepts one. Leave blank to promise nothing.",
      requiresReason:
        "For papers you will not write blind — the wording depends on who it is for.",
      supplyCategory:
        "Which shelf of the papeterie it sits on. The list editor groups its picker by this.",
      defaultQuantity:
        "Filled in when a teacher picks this article. Leave blank for what is counted by eye.",
      supplyArticleNotes:
        "Format, ruling, size \u2014 detail that belongs to the article rather than to one list.",
      weekNumber:
        "Counts the weeks the school actually teaches in — holidays are skipped, not numbered.",
      weekParity:
        "Alternates A and B so a fortnightly lesson can sit in one grid. Flip a row to change where the rotation resumes.",
      weekLabel: "Only for the weeks that have one — \"Exams\", \"Rentrée\".",
      timeSlot: "The period this teacher does not work.",
      unavailabilityReason:
        "For whoever builds the grid — \"teaches at the other school\", \"part-time\".",
      scheduleDirection:
        "A run goes one way. A pupil riding both ways is booked on two of them, or on the line itself.",
      arrivalTime: "Leave it blank until somebody has timed the round.",
      region: "Optional — only useful for grouping a long list.",
      holidayEnd: "Inclusive — a single day repeats the start date.",
      substitute: "Leave blank if nobody is covering.",
      landmark: "What pins it down where the name alone is ambiguous.",
      agency: "The branch the school actually banks with.",
      accountNumber: "The school's own account, for the transfers it makes.",
      categoryKind:
        "Which side of the ledger may post under it. Both is for rubrics like Régularisation.",
      subcategoryParent:
        "The rubric this sits under. A sub-rubric is never chosen on its own.",
      motifCategory: "Leave empty to offer it under every rubric.",
      preferenceRank:
        "Lower goes first when several teachers could take a subject. 0 for a specialist, higher for somebody covering.",
      payrollWorkingDays:
        "Divides a monthly salary to suggest a daily rate. Only ever a suggestion.",
      allowTeacherCreate:
        "Turn on for the kinds a teacher sets themselves — devoirs. Contrôles stay off, so only the head of studies plans those.",
      gradesWholeSubject:
        "Turn on for the kinds sat on a matière as one paper — contrôles and orals. Off means one paper per component, which is how a devoir is set.",
      defaultCoefficient:
        "Starting weight for a new paper of this kind, within the subject\u2019s mark for the term.",
      defaultMaxScore:
        "Marks are out of 20 in Morocco, but an oral or a TP is often out of 10.",
      countsTowardAverage:
        "Turn off for work that is marked and shown to the family but must never move the average.",
      position: "Lower sorts first.",
      massarCode: "The code this maps to in MASSAR. Leave blank until mapped.",
      levelCode: "Ministry short code, e.g. 1AP, 3AC, TC, 2BAC.",
      gradeYear: "Position within the cycle: 1AP is 1, 6AP is 6.",
      trackLevel: "Tracks only apply to the qualifying cycle.",
      parentSubject: "Set to make this a component, e.g. reading under Arabic.",
      programmeTrack: "Leave empty to apply to every track of the level.",
      coefficient:
        "Weight in the level average — or, for a component, inside its parent.",
      weeklyMinutes: "Timetabled load. 2h30 is 150.",
      termNumber: "1 or 2 for a two-semester year.",
      dayOfWeek: "The week runs Monday to Saturday.",
      scheduleKind: "Keep a Ramadan grid alongside the standard one.",
      isBreak: "Occupies the grid but holds no lesson.",
      offeringTrack: "Leave empty for primary and lower secondary.",
      plannedCapacity: "Places to open across all classes of this level.",
      mainTeacher: "Answerable for the class: reports, council, families.",
      classRoom: "Where the class sits by default.",
      groupSubject: "Set when the group exists for one subject.",
      billingCycle: "How the amount is collected, not how it is quoted.",
      isMandatory: "Mandatory fees are billed to every enrolled student.",
      feeRateLevel: "Leave empty to price it the same at every level.",
      amount: "In dirhams. Stored to the centime.",
      instalmentCount: "Split the amount over this many payments.",
      perInstalment:
        "Off: the amount above is the total, divided over the instalments (scolarité). On: it is charged in full on every one (a flat monthly cantine or transport fee).",
      discountKind: "Percentage, or a fixed number of dirhams.",
      percentBps: "As a percentage: 12.5 is an eighth off.",
      discountFeeType: "Leave empty to allow it against any fee.",
      isStackable: "Whether it may combine with another discount.",
    },
  },

  configOptions: {
    weekParities: {
      A: "Week A",
      B: "Week B",
    },
    supplyCategories: {
      ECRITURE: "Writing",
      CAHIERS: "Exercise books",
      COUVERTURES: "Covers",
      CLASSEMENT: "Filing",
      GEOMETRIE: "Geometry",
      ARTS: "Art",
      CARTABLE: "Bag and pencil case",
      SPORT: "Sport",
      HYGIENE: "Hygiene",
      AUTRE: "Other",
    },
    scheduleDirections: {
      MORNING: "Morning",
      AFTERNOON: "Afternoon",
    },
    categoryKinds: {
      IN: "Money in",
      OUT: "Money out",
      BOTH: "Both",
    },
    cycles: {
      PRESCHOOL: "Preschool",
      PRIMARY: "Primary",
      SECONDARY_COLLEGE: "Lower secondary",
      SECONDARY_QUALIFYING: "Upper secondary",
    },
    absenceKinds: {
      SICK: "Sick leave",
      LEAVE: "Leave",
      TRAINING: "Training",
      OTHER: "Other",
    },
    holidayKinds: {
      SCHOOL_HOLIDAY: "School holiday",
      PUBLIC_HOLIDAY: "Public holiday",
      EXAM_PERIOD: "Exam period",
      CLOSURE: "Closure",
    },
    roomKinds: {
      CLASSROOM: "Classroom",
      LAB_SCIENCE: "Science lab",
      LAB_COMPUTER: "Computer room",
      WORKSHOP: "Workshop",
      SPORTS: "Sports",
      LIBRARY: "Library",
      MULTIPURPOSE: "Multipurpose",
      OUTDOOR: "Outdoor",
    },
    termStatuses: {
      PLANNED: "Planned",
      ACTIVE: "Active",
      CLOSED: "Closed",
    },
    days: {
      "1": "Monday",
      "2": "Tuesday",
      "3": "Wednesday",
      "4": "Thursday",
      "5": "Friday",
      "6": "Saturday",
      // Offered so a school that teaches Sunday can say so. The time-slot
      // picker only lists the days the school actually declared.
      "7": "Sunday",
    },
    sessions: {
      MORNING: "Morning",
      AFTERNOON: "Afternoon",
    },
    scheduleKinds: {
      STANDARD: "Standard",
      RAMADAN: "Ramadan",
    },
    groupPurposes: {
      LAB: "Practical work",
      LANGUAGE: "Language",
      SPORTS: "Sports",
      SUPPORT: "Support",
      OTHER: "Other",
    },
    feeKinds: {
      TUITION: "Tuition",
      REGISTRATION: "Registration",
      INSURANCE: "Insurance",
      TRANSPORT: "Transport",
      CANTEEN: "Canteen",
      CLUB: "Club",
      SUPPLIES: "Supplies",
      UNIFORM: "Uniform",
      EXAM: "Exam",
      OTHER: "Other",
    },
    billingCycles: {
      ANNUAL: "Annual",
      MONTHLY: "Monthly",
      TERM: "Per term",
      ONE_OFF: "One-off",
    },
    discountKinds: {
      PERCENTAGE: "Percentage",
      FIXED_AMOUNT: "Fixed amount",
    },
    discountReasons: {
      SIBLING: "Sibling",
      STAFF: "Staff child",
      EARLY_PAYMENT: "Early payment",
      SCHOLARSHIP: "Scholarship",
      MERIT: "Merit",
      HARDSHIP: "Hardship",
      OTHER: "Other",
    },
  },
} as const;

/** Sidebar label this module contributes to the `nav` namespace. */
export const nav = { configuration: "Configuration" } as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: { configuration: "Configuration" },
  codes: {
    "configuration.view": "View the configuration",
    "configuration.manage": "Manage the configuration",
  },
} as const;

export default en;
