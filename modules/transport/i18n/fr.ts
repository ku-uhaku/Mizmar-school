/**
 * Transport translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 *
 * The vocabulary is that of a Moroccan private school's ramassage scolaire :
 * matricule, visite technique, ligne, arrêt, abonnement.
 */
const fr = {
  transport: {
    voyages: "Voyages",
    voyagesHint: "Tous les voyages prévus aujourd'hui, et où en est chacun.",
    runStart: "Démarrer",
    runArrive: "Arrivé",
    runCancel: "Annuler le voyage",
    runStarted: "Voyage démarré.",
    runArrived: "Voyage clôturé.",
    runCancelled: "Voyage annulé.",
    runAlreadyMoved: "Ce voyage a déjà changé d'état — rechargez le tableau.",
    runNotItsHour:
      "Ce n'est pas l'heure de ce voyage. Prévenez l'école si le bus est tout de même sorti.",
    runUpcoming: "S'ouvre une heure avant le départ",
    runWindowClosed: "Son heure est passée",
    cancelRunReasonRequired: "Indiquez pourquoi le voyage n'a pas lieu.",
    cancelRunTitle: "Annuler ce voyage ?",
    cancelRunHint: "Il reste au tableau comme annulé, avec votre motif. Dites ce qui s'est passé : une panne, pas de chauffeur, une route coupée.",
    myVoyages: "Mes voyages",
    myVoyagesHint:
      "Les voyages du jour pour le bus où vous êtes. Démarrer un voyage ouvre son appel.",
    voyagesAll: "Toutes les lignes",
    busRegister: "Appel",
    noRunsToday: "Aucun voyage n'est prévu aujourd'hui.",
    noRunsForDriver: "Aucun bus ne vous est affecté aujourd'hui.",
    plannedAt: "Départ prévu {time}",
    leftAt: "Parti {time}",
    arrivedAt: "Rentré {time}",
    lateBy: "{count} min de retard",
    earlyBy: "{count} min d'avance",
    onTime: "À l'heure",
    runsEnRoute: "{count} en route",
    runsEnRouteOne: "En route",
    runsPending: "{count} à partir",
    riderCount: "{count} abonnés",
    title: "Transport",
    subtitle: "Le parc, les lignes qu'il dessert et les élèves transportés.",

    // ── Fleet ───────────────────────────────────────────────────────────────
    fleet: "Parc",
    vehicles: "Véhicules",
    vehicle: "Véhicule",
    newVehicle: "Nouveau véhicule",
    editVehicle: "Modifier le véhicule",
    registration: "Matricule",
    registrationHint: "Tel qu'inscrit sur la plaque, ex. 12345-A-6.",
    make: "Marque",
    model: "Modèle",
    modelYear: "Mise en circulation",
    seatCount: "Places",
    seatCountHint:
      "Les places offertes aux élèves, qui ne sont pas toujours celles du véhicule.",
    vehicleStatus: "État",
    insurance: "Assurance expire le",
    inspection: "Visite technique expire le",
    complianceHint:
      "Un bus dont les papiers ont expiré ne peut légalement transporter d'élèves.",
    driverStaff: "Chauffeur salarié",
    driverStaffHint:
      "Choisit un employé de l'école, pour que le bus et la paie désignent la même personne.",
    driverExternal: "Pas un employé",
    driverName: "Chauffeur",
    driverPhone: "Téléphone du chauffeur",
    driverHint: "La personne qu'on appelle quand le bus n'est pas arrivé.",
    attendantStaff: "Accompagnateur salarié",
    attendantStaffHint:
      "La personne qui accompagne les élèves et fait l'appel au trottoir. En se connectant, elle voit les mêmes voyages que le chauffeur.",
    attendantNone: "Pas d'accompagnateur",
    attendantName: "Accompagnateur",
    attendantPhone: "Téléphone de l'accompagnateur",
    attendantShort: "Acc.",
    noVehicles: "Aucun véhicule dans le parc.",
    vehicleCreated: "Véhicule ajouté.",
    vehicleUpdated: "Véhicule mis à jour.",
    vehicleDeleted: "Véhicule supprimé.",
    registrationTaken: "Ce matricule figure déjà dans le parc.",
    vehicleInUse:
      "Ce bus a desservi une ligne — réformez-le au lieu de le supprimer.",
    deleteVehicleTitle: "Supprimer ce véhicule ?",
    deleteVehicleBody: "« {name} » sera retiré du parc.",
    expired: "Expiré",
    expiringSoon: "Expire bientôt",
    paperworkDue: "Papiers à renouveler",
    noExpiryRecorded: "Aucune date saisie",

    riders: "Abonnés",

    // ── Lines ───────────────────────────────────────────────────────────────
    routes: "Lignes",
    route: "Ligne",
    newRoute: "Nouvelle ligne",
    editRoute: "Modifier la ligne",
    routeCode: "Code",
    routeName: "Nom",
    direction: "Dessert",
    assignedVehicle: "Bus",
    capacity: "Places offertes",
    capacityHint: "Laisser vide pour utiliser les places du bus.",
    seats: "Places",
    taken: "Occupées",
    remaining: "Libres",
    routeFull: "Cette ligne est complète.",
    routeCodeTaken: "Ce code de ligne est déjà utilisé cette année.",
    routeCreated: "Ligne créée.",
    routeUpdated: "Ligne mise à jour.",
    routeDeleted: "Ligne supprimée.",
    routeHasRiders:
      "Cette ligne a des abonnés — déplacez-les avant de la supprimer.",
    deleteRouteTitle: "Supprimer cette ligne ?",
    deleteRouteBody: "« {name} » sera supprimée.",
    noRoutes: "Aucune ligne n'a encore été tracée pour cette année.",
    noVehicleAssigned: "Aucun bus affecté",
    unassignedWarning:
      "Une ligne sans bus n'offre aucune place — affectez-en un avant d'abonner des élèves.",

    // ── Stops ───────────────────────────────────────────────────────────────
    stops: "Arrêts",
    stop: "Arrêt",
    newStop: "Nouvel arrêt",
    editStop: "Modifier l'arrêt",
    stopName: "Arrêt",
    landmark: "Repère",
    neighbourhood: "Quartier",
    landmarkHint: "Ce qu'on cherche des yeux : « devant la pharmacie ».",
    position: "Ordre",
    pickupTime: "Ramassage",
    dropoffTime: "Dépose",
    invalidTime: "Utilisez une heure sur 24 h, ex. 07:30.",
    stopSaved: "Arrêt enregistré.",
    stopDeleted: "Arrêt supprimé.",
    stopNameTaken: "Cet arrêt existe déjà sur cette ligne.",
    stopHasRiders:
      "Des élèves montent ici — déplacez-les avant de supprimer l'arrêt.",
    noStops: "Aucun arrêt sur cette ligne.",

    // ── Riders ──────────────────────────────────────────────────────────────
    addRider: "Abonner un élève",
    editRider: "Modifier l'abonnement",
    rider: "Abonné",
    noRiders: "Aucun élève sur cette ligne.",
    pupil: "Élève",
    subscriptionStatus: "État",
    startsOn: "À partir du",
    endsOn: "Jusqu'au",
    riderAdded: "Élève abonné.",
    riderAddedBilled: "Élève abonné — {count} échéances tarifées.",
    riderAddedPartly:
      "{created} trajet(s) abonné(s), {refused} refusé(s) — le bus est complet ou l'élève y circule déjà.",
    riderUpdated: "Abonnement mis à jour.",
    riderRemoved: "Abonnement résilié.",
    riderRemovedBilled:
      "Abonnement résilié — {count} échéances à venir annulées.",
    alreadySubscribed: "Cet élève est déjà abonné dans ce sens.",
    removeRiderTitle: "Retirer cet élève du bus ?",
    removeRiderBody:
      "« {name} » perd sa place. Les échéances déjà réglées sont conservées ; les échéances à venir non réglées sont annulées.",
    noSubscribable: "Tous les élèves inscrits ont déjà une place.",
    notRiding: "Cet élève ne prend pas le bus.",
    transportOf: "Transport",
    billingNote:
      "Le transport est facturé une seule fois, à l'inscription, depuis la liste des prix. Affecter un élève à un circuit ne change rien à ce que sa famille doit.",

    // ── Summary ─────────────────────────────────────────────────────────────
    seatsOffered: "Places offertes",
    seatsFree: "Places libres",
    ridersTotal: "Abonnés",
    linesRunning: "Lignes en service",

    // ── Tableau de bord de la section ───────────────────────────────────────
    routesHint: "Les lignes tracées pour l'année, leurs arrêts et qui monte où.",
    fleetHint: "Les bus, les papiers qui les autorisent à rouler et leur chauffeur.",
    paperworkCount: "{count} à renouveler",
    paperworkHint:
      "Assurance ou visite technique périmée, ou expirant dans le mois.",
    allPapersValid: "Tous les bus en service sont à jour.",
    stopsAcrossLines: "{count} arrêts",
    ofSeatsOffered: "sur {count} places offertes",
    seatsFreeHint: "Toutes lignes confondues",
    busesInService: "{count} bus en service",
    occupancy: "Remplissage des lignes",
    occupancyHint: "Abonnés par rapport aux places offertes.",
    seatsTaken: "{taken} places sur {seats}",

    // ── Horaires ────────────────────────────────────────────────────────────
    schedules: "Horaires",
    schedule: "Horaire",
    noSchedules: "Aucun horaire d\u00e9clar\u00e9 pour cette ann\u00e9e.",
    noSchedulesHint:
      "D\u00e9clarez-les dans la configuration, puis cochez ceux que chaque circuit assure.",
    schedulesSaved: "{count} horaires sur ce circuit.",
    routeSchedules: "Horaires",
    routeSchedulesHint: "Les d\u00e9parts que ce circuit assure.",
    scheduleOnRoute: "Horaire",
    noScheduleChosen: "Aucun horaire particulier",

    // ── Quartiers desservis ─────────────────────────────────────────────────
    routeNeighbourhoods: "Quartiers desservis",
    routeNeighbourhoodsHint:
      "La zone de ramassage annonc\u00e9e pour ce circuit. C'est ce que l'on confronte au quartier de la famille \u00e0 l'inscription, et cela n'attend pas que les arr\u00eats soient trac\u00e9s.",
    neighbourhoodsSaved: "{count} quartiers sur ce circuit.",
    noNeighbourhoods: "Aucun quartier d\u00e9clar\u00e9 pour cet \u00e9tablissement.",
    noNeighbourhoodsHint: "Ajoutez-les dans Configuration, \u00c9tablissement.",

    // ── L'abonnement de l'\u00e9l\u00e8ve ──────────────────────────────────
    riderNotes: "Notes",
    tabTransport: "Transport",
    arrangement: "Abonnement transport",
    arrangementHint:
      "Choisissez d'abord le quartier : seuls les circuits qui le desservent sont propos\u00e9s, et l'arr\u00eat d\u00e9coule des deux.",
    chooseNeighbourhood: "Quartier",
    chooseRoute: "Circuit",
    chooseSchedule: "Horaire",
    chooseRuns: "Horaires",
    chooseRunsHint:
      "Cochez le trajet emprunté dans chaque sens. Chacun devient un abonnement distinct.",
    noSchedulesOnRoute:
      "Aucun horaire n'est encore déclaré sur ce circuit : le sens est donc demandé directement.",
    chooseStop: "Arr\u00eat",
    stopAutoResolved: "Un seul arr\u00eat dessert ce quartier sur ce circuit.",
    stopsUnfilteredHint:
      "Aucun arr\u00eat de ce circuit n'est encore rattach\u00e9 \u00e0 ce quartier : tous les arr\u00eats sont propos\u00e9s.",
    noRoutesForNeighbourhood: "Aucun circuit ne dessert encore ce quartier.",
    notSubscribed: "Cet \u00e9l\u00e8ve ne prend pas le bus.",
    notSubscribedHint:
      "Choisissez un quartier et un circuit pour l'y inscrire. Les \u00e9ch\u00e9ances de transport sont r\u00e9\u00e9crites en cons\u00e9quence.",
    subscribe: "Inscrire au transport",
    enrolFirst:
      "Inscrivez l'\u00e9l\u00e8ve pour cette ann\u00e9e avant de l'affecter \u00e0 un circuit.",

    // ── Consommation ────────────────────────────────────────────────────────
    fuel: "Carburant",
    fuelTitle: "Demandes de consommation",
    fuelSubtitle:
      "Ce que chaque bus a consomm\u00e9, qui l'a demand\u00e9 et qui l'a valid\u00e9.",
    newFuelRequest: "Nouvelle demande",
    editFuelRequest: "Modifier la demande",
    fuelVehicle: "Bus",
    fuelDriver: "Chauffeur",
    fuelDriverHint:
      "L'employ\u00e9 \u00e0 la pompe. Laissez vide et saisissez un nom pour un prestataire.",
    fuelDriverName: "Nom du chauffeur",
    fuelDate: "Date",
    fuelLitres: "Litres",
    fuelOdometer: "Compteur",
    fuelOdometerHint:
      "Kilom\u00e9trage relev\u00e9. Sans lui, la consommation ne peut pas \u00eatre calcul\u00e9e.",
    fuelAmount: "Montant",
    fuelStatus: "Statut",
    fuelCategory: "Rubrique",
    fuelCategoryHint:
      "La rubrique sous laquelle le d\u00e9caissement est enregistr\u00e9.",
    fuelDecidedBy: "D\u00e9cid\u00e9 par",
    fuelConsumption: "Consommation",
    fuelDistance: "Distance",
    fuelPerHundred: "{value} L/100km",
    fuelLitresValue: "{value} L",
    fuelKilometres: "{value} km",
    noFuelRequests: "Aucune demande de consommation.",
    noFuelRequestsHint:
      "Un chauffeur en d\u00e9pose une ; le responsable du parc la valide.",
    fuelRequestCreated: "Demande d\u00e9pos\u00e9e.",
    fuelRequestUpdated: "Demande modifi\u00e9e.",
    fuelRequestDeleted: "Demande retir\u00e9e.",
    fuelApprove: "Valider",
    fuelReject: "Refuser",
    fuelApprovedPosted: "Valid\u00e9e. Le d\u00e9caissement est en caisse.",
    fuelRejected: "Demande refus\u00e9e.",
    fuelAlreadyDecided: "Cette demande a d\u00e9j\u00e0 \u00e9t\u00e9 tranch\u00e9e.",
    fuelNothingToPay:
      "Une demande sans montant ne peut pas \u00eatre valid\u00e9e.",
    fuelPending: "{count} en attente",
    fuelRecent: "D\u00e9pens\u00e9 sur 30 jours",
    fuelDeleteTitle: "Retirer cette demande ?",
    fuelDeleteBody: "Elle n'a pas \u00e9t\u00e9 tranch\u00e9e : rien ne change en caisse.",

    // ── L'appel du bus ──────────────────────────────────────────────────────
    attendance: "Appel du bus",
    attendanceTitle: "Appel du bus",
    attendanceSubtitle:
      "Qui est monté, sur quelle rotation. Pointé au trottoir par le chauffeur ou l'accompagnateur.",
    chooseRun: "Rotation",
    noRuns: "Aucun circuit ne roule cette année.",
    noRunsHint: "Tracez d'abord un circuit, puis déclarez ses horaires.",
    noRidersOnRun: "Personne n'est inscrit sur cette rotation.",
    noRidersHint:
      "Les élèves apparaissent ici dès qu'ils sont affectés à ce circuit à l'inscription.",
    riderMarked: "Pointé.",
    bulkMarked: "{count} élèves pointés comme montés.",
    nothingToMark: "Tout le monde est déjà pointé sur cette rotation.",
    markRest: "Tous les autres sont montés",
    unmarked: "Non pointé",
    stopColumn: "Arrêt",
    minutesWaited: "Minutes d'attente",
    reason: "Motif",
    justified: "Famille prévenue",
    notBoardedCount: "{count} absents du bus",
    allBoarded: "Tout le monde est monté sur cette rotation.",
    registerNote:
      "Cet appel ne concerne que le bus. Un élève qui l'a manqué n'est pas pour autant absent de l'école.",
  },
  transportOptions: {
    riderAttendanceStatuses: {
      PRESENT: "Monté",
      LATE: "En retard",
      ABSENT: "Non monté",
      EXCUSED: "Ne voyage pas",
    },
    scheduleDirections: {
      MORNING: "Matin",
      AFTERNOON: "Apr\u00e8s-midi",
    },
    fuelStatuses: {
      PENDING: "En attente",
      APPROVED: "Valid\u00e9e",
      REJECTED: "Refus\u00e9e",
      PAID: "Pay\u00e9e",
    },
    vehicleStatuses: {
      ACTIVE: "En service",
      MAINTENANCE: "Au garage",
      RETIRED: "Réformé",
    },
    directions: {
      MORNING: "Aller seulement",
      AFTERNOON: "Retour seulement",
      BOTH: "Aller-retour",
    },
    subscriptionStatuses: {
      ACTIVE: "Abonné",
      SUSPENDED: "Suspendu",
      CANCELLED: "Résilié",
    },
  },
};

export const nav = {
  transportVoyages: "Voyages",
  transportSchedules: "Horaires",
  transportConsumption: "Carburant",
  transportRoutes: "Lignes",
  transportFleet: "Flotte",
};

export const permissions = {
  groups: {
    transport: "Transport",
  },
  codes: {
    "transport.view": "Consulter le transport",
    "transport.manage": "Gérer le parc et les lignes",
    "transport.subscribe": "Abonner des élèves",
    "transport.delete": "Supprimer véhicules et lignes",
    "transport.attendance": "Pointer l'appel du bus",
    "transport.fuel": "D\u00e9poser des demandes de carburant",
    "transport.fuelApprove": "Valider les demandes de carburant",
  },
};

export default fr;
