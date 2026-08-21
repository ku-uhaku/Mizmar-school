/** RH translations (fr) — the default language. Shape checked against `en`. */
const fr = {
  hr: {
    title: "Ressources humaines",
    subtitle: "Tout le personnel de l'école, et ce qui découle de l'employer.",

    // ── Personnel ───────────────────────────────────────────────────────────
    staff: "Personnel",
    employee: "Employé",
    newStaff: "Nouvel employé",
    editStaff: "Modifier l'employé",
    code: "Matricule",
    codeHint: "Laissez vide pour en générer un, ex. P-2025-0007.",
    firstName: "Prénom",
    lastName: "Nom",
    firstNameAr: "Prénom (arabe)",
    lastNameAr: "Nom (arabe)",
    gender: "Sexe",
    birthDate: "Date de naissance",
    birthPlace: "Lieu de naissance",
    nationalId: "CIN",
    cnssNumber: "Numéro CNSS",
    cnssHint:
      "Vide tant que l'affiliation n'est pas revenue, ce qui prend des semaines.",
    bankRib: "RIB",
    phone: "Téléphone",
    email: "E-mail",
    address: "Adresse",
    jobRole: "Fonction",
    jobTitle: "Intitulé au contrat",
    jobTitleHint:
      "Ce qu'imprime l'attestation, ex. « Professeur de mathématiques ».",
    department: "Service",
    staffStatus: "Statut",
    hiredOn: "Entrée",
    leftOn: "Sortie",
    account: "Compte de connexion",
    accountHint:
      "Uniquement pour les employés qui se connectent. La plupart du personnel ne le fait pas.",
    noAccount: "Aucun compte",
    accountTaken: "Ce compte appartient déjà à un autre employé.",
    createAccount: "Créer un accès pour cet employé",
    createAccountHint:
      "Il se connectera avec le nom d’utilisateur ci-dessous. À laisser décoché pour le personnel qui ne se connecte jamais — un chauffeur, un gardien.",
    accountRole: "Rôle dans cette école",
    accountRoleHint:
      "Ce qu’il pourra faire une fois connecté. Laissez vide et le poste décide — un enseignant reçoit Enseignant, un chauffeur Chauffeur.",
    accountPasswordHint:
      "Un mot de passe est généré et affiché une seule fois à la création de l’accès. Personne n’en saisit.",

    // Les identifiants, remis une seule fois
    accountCredentialsTitle: "À remettre à l’employé",
    accountCredentialsBody:
      "Le mot de passe n’est affiché qu’une fois et ne peut pas être retrouvé. Notez-le ou copiez-le avant de fermer cette fenêtre.",
    accountUsername: "Nom d’utilisateur",
    accountPassword: "Mot de passe",
    accountNoRole: "Aucune permission",
    accountNeedsUsername:
      "Saisissez un nom d’utilisateur — impossible d’en construire un à partir de ce nom.",
    accountCreated: "Employé enregistré, et son accès créé.",
    codeTaken: "Ce matricule est déjà utilisé.",
    notes: "Notes",
    staffCreated: "Employé ajouté.",
    staffUpdated: "Employé mis à jour.",
    staffDeleted: "Employé supprimé.",
    staffHasPayslips:
      "Cet employé a des bulletins de paie — indiquez son départ plutôt que de le supprimer.",
    deleteStaffTitle: "Supprimer cet employé ?",
    deleteStaffBody: "« {name} » sera retiré du personnel.",
    noStaff: "Aucun employé enregistré.",
    headcount: "Effectif",

    // ── Recrutement ─────────────────────────────────────────────────────────
    hire: "Recruter",
    hireSubtitle:
      "La fiche employé, l'accès, le contrat et ce qu'il prend en charge — en une seule fois.",
    hireHint: "Seul le nom est obligatoire. Le reste peut attendre.",
    sections: "Sections",
    identity: "Identité",
    identityHint:
      "Telle qu'elle figure sur la CIN — le contrat et la déclaration CNSS en sont issus.",
    posting: "Poste",
    postingHint: "Ce pour quoi il a été recruté, et où cela se situe.",
    contact: "Coordonnées",
    contactHint: "Comment l'école le joint.",
    contract: "Contrat",
    contractSectionHint:
      "Ce sur quoi il est engagé. Un renouvellement plus tard sera un nouveau contrat, pas une modification de celui-ci.",
    withContract: "Signer un contrat maintenant",
    withContractHint:
      "Sans cela, il est employé sans rien de signé — c'est le manque que relève une inspection.",
    access: "Accès",
    accessHint: "S'il se connecte, et ce qu'il pourra faire une fois connecté.",
    accountNotPermitted: "Vous n'êtes pas autorisé à créer des accès.",
    noPermissions: "Un accès sans permission",
    jobFunctionNeedsAccount:
      "La fonction est portée par l'accès — activez-en un pour la renseigner.",
    maxWeeklyMinutes: "Charge hebdomadaire maximale",
    maxWeeklyMinutesHint:
      "En minutes. Le générateur ne lui donnera pas une vingt-cinquième heure. Vide, c'est le plafond de la semaine qui s'applique.",
    teaching: "Matières",
    teachingHint:
      "Ce que cet enseignant peut prendre — la base sur laquelle le générateur d'emploi du temps établit ses affectations.",
    subjects: "Matières qu'il peut prendre",
    subjectsHint:
      "Ce qu'il pourrait enseigner, non ce qui lui a été confié. La préférence et les niveaux précis se règlent ensuite, sous Configuration.",
    subjectsNeedAccount:
      "Une habilitation est portée par l'accès — activez-en un pour déclarer des matières.",
    subjectsNotPermitted:
      "Vous n'êtes pas autorisé à déclarer qui enseigne quoi.",
    noSubjects: "L'école n'a encore aucune matière dans son cursus.",
    qualificationCycle: "Cycle",
    qualificationCycleHint:
      "Où l'habilitation s'applique. Laissez sur tous les cycles pour quelqu'un qui prend la matière partout où elle est enseignée.",
    everyCycle: "Tous les cycles",
    busSection: "Bus",
    busHint: "Les véhicules que ce chauffeur conduit.",
    buses: "Bus conduits",
    busesHint: "L'affecter ici remplace celui qui y était désigné.",
    busesNotPermitted: "Vous n'êtes pas autorisé à réaffecter le parc.",
    noVehicles: "L'école n'a aucun véhicule dans son parc.",

    // Ce qu'encadre un directeur ou un surveillant général
    oversight: "Encadrement",
    oversightHint:
      "La partie de l'école dont cette personne répond. Déclaré pour l'année en cours, comme le plan pédagogique.",
    oversightCycles: "Cycles encadrés",
    oversightCyclesHint:
      "Dans une petite école, un directeur en encadre souvent plusieurs. La passation se fait plus tard depuis sa fiche.",
    oversightNotPermitted:
      "Vous n'êtes pas autorisé à désigner le responsable d'un cycle.",
    oversightService: "Encadrement",
    noCycles: "L'école n'a aucun cycle dans son cursus.",

    // ── Tableau de bord de la section ───────────────────────────────────────
    staffHint: "Tous ceux que l'école paie, et le contrat de chacun.",
    attendanceHint:
      "Qui est venu aujourd'hui, et qui n'a pas encore été pointé.",
    payrollHint: "Les bulletins du mois, et leur règlement par la caisse.",
    leaveHint:
      "Les demandes en attente de décision, et les congés déjà accordés.",
    unmarkedCount: "{count} non pointés",
    registerComplete: "Tout est pointé",
    unpaidCount: "{count} à régler",
    onLeaveCount: "{count} en congé",
    unmarkedTodayHint: "Pointages manquants sur la feuille du jour",
    pendingLeaveHint: "Demandes sur lesquelles personne n'a encore tranché.",
    byRole: "Qui travaille ici",
    byRoleHint: "Employés en activité, par fonction.",
    noPendingLeave: "Aucune demande n'attend de décision.",
    withoutContract: "Sans contrat en cours",
    withoutContractHint:
      "Employé sans rien de signé — l'écart que relève une inspection.",
    monthlyPayroll: "Masse salariale mensuelle",

    // ── Contrats ────────────────────────────────────────────────────────────
    contracts: "Contrats",
    newContract: "Nouveau contrat",
    editContract: "Modifier le contrat",
    contractKind: "Type",
    startsOn: "Du",
    endsOn: "Au",
    endsOnHint:
      "Laissez vide pour un CDI — un contrat à durée indéterminée n'a pas de fin.",
    trialEndsOn: "Fin de la période d'essai",
    baseSalary: "Salaire de base mensuel",
    baseSalaryHint:
      "Brut, en dirhams. Ce qui a réellement été versé un mois donné est son bulletin.",
    weeklyHours: "Heures par semaine",
    contractStatus: "Statut",
    contractSaved: "Contrat enregistré.",
    contractEnded: "Contrat clôturé.",
    endContract: "Clôturer le contrat",
    endContractTitle: "Clôturer ce contrat ?",
    endContractBody: "« {name} » se retrouvera sans contrat en cours.",
    noContracts: "Aucun contrat signé.",
    supersededNote:
      "Activer un contrat clôture celui qu'il remplace : personne ne se retrouve avec deux contrats ni sans aucun.",
    endBeforeStart: "La date de fin ne peut pas précéder la date de début.",

    // ── Pointage ────────────────────────────────────────────────────────────
    attendance: "Présence",
    day: "Jour",
    unmarked: "Non pointé",
    unmarkedToday: "Non pointés aujourd'hui",
    attendanceStatus: "Statut",
    justified: "Justifié",
    justifiedHint:
      "Un justificatif a été fourni. Seuls les jours non justifiés sont comptabilisés.",
    minutesLate: "Minutes de retard",
    recordedBy: "Pointé par",
    attendanceSaved: "Pointage mis à jour.",
    markEveryoneElse: "Pointer présents tous les autres",
    bulkMarked: "{count} pointés présents.",
    nothingToMark: "Tout le monde a déjà été pointé.",
    bulkHint:
      "Ne comble que les manques — une absence déjà saisie n'est jamais écrasée.",
    unjustifiedAbsences: "Absences non justifiées",

    // ── Paie ────────────────────────────────────────────────────────────────
    payroll: "Paie",
    period: "Mois",
    editPayslip: "Modifier le bulletin",
    gains: "Gains",
    base: "Salaire de base",
    allowance: "Primes et indemnités",
    allowanceHint: "Transport, panier, ancienneté, responsabilité.",
    overtime: "Heures supplémentaires",
    overtimeHint: "C'est aussi là que passe toute la paie d'un vacataire.",
    bonus: "Prime exceptionnelle",
    deductions: "Retenues",
    absenceDeduction: "Absence",
    absenceDeductionHint:
      "{days} jours non justifiés ce mois-ci. Une journée vaut environ {rate}.",
    advance: "Avance récupérée",
    social: "CNSS / AMO",
    tax: "IR",
    otherDeduction: "Autre",
    deductionLabel: "Motif",
    gross: "Brut",
    net: "Net à payer",
    netHint: "Toujours calculé à partir des lignes ci-dessus, jamais saisi.",
    payslipStatus: "Statut",
    salarySaved: "Bulletin enregistré.",
    alreadyPaid: "Ce bulletin a été payé — annulez d'abord le décaissement.",
    salaryCancelled: "Ce bulletin a été annulé.",
    nothingToPay: "Rien à payer sur ce bulletin.",
    noPayslip: "Non préparé",
    behindContract: "Diffère du salaire de base du contrat.",
    payrollTotal: "Paie du mois",
    unpaidThisMonth: "En attente de paiement",

    // ── Paiement ────────────────────────────────────────────────────────────
    pay: "Payer",
    paySalary: "Payer ce bulletin",
    paySalaryBody:
      "« {name} » recevra {amount}. Un décaissement est écrit dans la caisse — cet écran ne déplace jamais d'argent tout seul.",
    method: "Mode",
    paidOn: "Payé le",
    reference: "Référence",
    chequeNumber: "Numéro de chèque",
    bankName: "Banque",
    expenseCategory: "Rubrique de dépense",
    noOpenSession:
      "Aucune caisse ouverte — ouvrez-en une avant de payer en espèces.",
    salaryPaid: "Bulletin payé.",
    ledgerNote:
      "Ce qui est dû vit ici ; ce qui est sorti vit dans la caisse. Ni l'un ni l'autre n'est calculé à partir de l'autre.",

    // ── Congés ──────────────────────────────────────────────────────────────
    leave: "Congés",
    newLeave: "Demander un congé",
    editLeave: "Modifier la demande",
    leaveKind: "Type",
    dayCount: "Jours ouvrables",
    dayCountHint:
      "Pas l'écart entre les dates — samedis, jours fériés et vacances scolaires diffèrent.",
    reason: "Motif",
    leaveStatus: "Statut",
    decisionNote: "Note sur la décision",
    decidedOn: "Décidé le",
    approve: "Accorder",
    reject: "Refuser",
    leaveSaved: "Demande enregistrée.",
    leaveApproved: "Congé accordé.",
    leaveDecided: "Décision enregistrée.",
    leaveDeleted: "Demande supprimée.",
    deleteLeaveTitle: "Supprimer cette demande ?",
    deleteLeaveBody: "La demande de « {name} » sera supprimée.",
    noLeave: "Aucune demande de congé.",
    pendingLeave: "En attente de décision",
    leaveThisYear: "Jours de congé cette année",
    leaveStatusNote:
      "Accorder un congé qui couvre aujourd'hui met l'employé en congé, pour que le pointage ne le note pas absent.",
    // ── Avances sur salaire ────────────────────────────────────────────────
    advances: "Avances sur salaire",
    advancesHint:
      "L\u2019argent avanc\u00e9 avant la paie, et ce qu\u2019il en reste d\u00fb.",
    newAdvance: "Nouvelle avance",
    editAdvance: "Modifier la demande",
    advanceAmount: "Montant",
    advanceInstalments: "R\u00e9cup\u00e9r\u00e9e sur",
    advanceInstalmentsHint:
      "Sur combien de mois la retenir. La derni\u00e8re \u00e9ch\u00e9ance solde le reste.",
    advanceReason: "Motif",
    advanceRecovered: "R\u00e9cup\u00e9r\u00e9",
    advanceOutstanding: "Reste d\u00fb",
    advanceRequested: "Avance demand\u00e9e.",
    advanceSaved: "Demande mise \u00e0 jour.",
    advanceApproved: "Avance accord\u00e9e.",
    advanceRefused: "Avance refus\u00e9e.",
    advancePaid: "Avance remise.",
    advanceLocked:
      "Cette demande a d\u00e9j\u00e0 \u00e9t\u00e9 trait\u00e9e \u2014 elle n\u2019est plus modifiable.",
    advanceAlreadyDecided:
      "Cette demande a d\u00e9j\u00e0 \u00e9t\u00e9 trait\u00e9e.",
    advanceAlreadyPaid: "Cette avance a d\u00e9j\u00e0 \u00e9t\u00e9 remise.",
    advanceNotApproved:
      "Accordez l\u2019avance avant d\u2019en remettre le montant.",
    advanceOverRecovered:
      "C\u2019est plus que ce que doit cet employ\u00e9 ({amount} restant d\u00fb).",
    noAdvances: "Aucune avance n\u2019a \u00e9t\u00e9 demand\u00e9e.",
    noAdvancesHint:
      "Cr\u00e9ez-en une lorsqu\u2019un salari\u00e9 a besoin d\u2019argent avant la paie.",
    payAdvance: "Remettre",
    payAdvanceAmount: "Remettre {amount}",
    refuse: "Refuser",
    statutorySuggested:
      "Sugg\u00e9r\u00e9 d\u2019apr\u00e8s les taux de l\u2019\u00e9cole",

    // ── Le dossier de l'employé ──────────────────────────────────────────
    tabDossier: "Dossier",
    tabService: "Service",
    tabPay: "Paie",
    weeklyLoad: "Charge hebdomadaire",
    weeklyLoadCeiling: "sur {hours}h contractuelles",
    weeklyLoadNoCeiling: "Au plafond de l’école",
    hoursShort: "h",
    hoursPerWeek: "Heures / semaine",
    pupilsTaught: "Élèves enseignés",
    pupils: "Élèves",
    classCount: "dans {count} classes",
    classLabel: "Classe",
    subject: "Matière",
    group: "Groupe",
    wholeClass: "Classe entière",
    coTeacher: "Co-enseignant",
    teachingService: "Classes enseignées",
    transportService: "Parc",
    busesDriven: "Bus",
    seatCount: "{count} places",
    lineCount: "{count} lignes cette année",
    lineLoad: "{riders} inscrits · {stops} arrêts",
    noLine: "Ce bus ne dessert aucune ligne cette année.",
    dutyDriver: "Chauffeur",
    dutyAttendant: "Accompagnateur",
    insuranceExpires: "Assurance",
    inspectionExpires: "Visite technique",
    noService: "Aucune affectation",
    noServiceHint:
      "Cet employé n’enseigne aucune classe et ne conduit aucun bus.",
    noServiceNoAccount:
      "Les affectations pédagogiques suivent le compte de connexion, et cet employé n’en a pas — créez-en un pour voir ses classes ici.",
    lastNet: "Dernier net",
    noPayslipYet: "Aucun bulletin émis.",
    leaveDaysTaken: "{count} jours de congé cette année",

    transfer: "Transférer vers une autre école",
    transferHint:
      "Pour un dossier ouvert dans la mauvaise école. Ses contrats le suivent ; ce qui s'est déjà passé ici ne le suit pas.",
    transferSchool: "Nouvelle école",
    transferConfirm: "Transférer cet employé",
    transferred: "Employé transféré.",
    transferredRecoded:
      "Employé transféré. Son matricule est désormais {code} — l'ancien était déjà utilisé dans cette école.",
    transferBlocked: "Cet employé ne peut pas être transféré : {reasons}.",
    transferSameSchool: "Il travaille déjà dans cette école.",
    transferOtherOrganisation: "Cette école appartient à une autre organisation.",
  },
  hrOptions: {
    transferBlockers: {
      payroll: "il a déjà été payé ici",
      register: "son pointage ou ses congés y sont enregistrés",
      teaching: "il enseigne ou est habilité ici",
      transport: "il fait partie du parc de cette école",
      caisse: "il tient une caisse ici",
    },
    jobRoles: {
      TEACHER: "Enseignant",
      DIRECTOR: "Directeur",
      SUPERVISOR: "Surveillant",
      SECRETARY: "Secrétaire",
      ACCOUNTANT: "Économe",
      NURSE: "Infirmier",
      DRIVER: "Chauffeur",
      MAINTENANCE: "Entretien",
      SECURITY: "Gardiennage",
      OTHER: "Autre",
    },
    departments: {
      TEACHING: "Enseignement",
      ADMINISTRATION: "Administration",
      TRANSPORT: "Transport",
      FACILITIES: "Entretien",
      HEALTH: "Santé",
    },
    staffStatuses: {
      ACTIVE: "En poste",
      ON_LEAVE: "En congé",
      SUSPENDED: "Suspendu",
      TERMINATED: "Parti",
    },
    contractKinds: {
      CDI: "CDI",
      CDD: "CDD",
      ANAPEC: "ANAPEC",
      INTERIM: "Remplacement",
      VACATAIRE: "Vacataire",
      STAGE: "Stage",
    },
    contractStatuses: {
      DRAFT: "Brouillon",
      ACTIVE: "En cours",
      ENDED: "Clôturé",
    },
    attendanceStatuses: {
      PRESENT: "Présent",
      ABSENT: "Absent",
      LATE: "En retard",
      LEAVE: "En congé",
      SICK: "Maladie",
      MISSION: "En mission",
      HOLIDAY: "École fermée",
    },
    salaryStatuses: {
      DRAFT: "Brouillon",
      APPROVED: "Validé",
      PAID: "Payé",
      CANCELLED: "Annulé",
    },
    leaveKinds: {
      ANNUAL: "Congé annuel",
      SICK: "Maladie",
      UNPAID: "Sans solde",
      MATERNITY: "Maternité",
      PATERNITY: "Paternité",
      EXCEPTIONAL: "Exceptionnel",
    },
    advanceStatuses: {
      REQUESTED: "Demand\u00e9e",
      APPROVED: "Accord\u00e9e",
      PAID: "Remise",
      RECOVERED: "R\u00e9cup\u00e9r\u00e9e",
      CANCELLED: "Refus\u00e9e",
    },
    leaveStatuses: {
      PENDING: "En attente",
      APPROVED: "Accordé",
      REJECTED: "Refusé",
      CANCELLED: "Annulé",
    },
    payoutMethods: {
      CASH: "Espèces",
      CHEQUE: "Chèque",
      BANK_TRANSFER: "Virement",
    },
  },
} as const;

export const nav = {
  hrStaff: "Personnel",
  hrAttendance: "Pointage",
  hrPayroll: "Paie",
  hrAdvances: "Avances",
  hrLeave: "Congés",
} as const;

export const permissions = {
  groups: {
    hr: "Ressources humaines",
  },
  codes: {
    "hr.view": "Consulter le personnel",
    "hr.manage": "Gérer les dossiers du personnel et les congés",
    "hr.attendance": "Faire le pointage",
    "hr.payroll": "Consulter et préparer la paie",
    "hr.delete": "Supprimer des dossiers du personnel",
  },
} as const;

export default fr;
