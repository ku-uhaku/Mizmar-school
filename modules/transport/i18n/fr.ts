/**
 * Transport translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 *
 * The vocabulary is that of a Moroccan private school's ramassage scolaire :
 * matricule, visite technique, ligne, arrêt, abonnement.
 */
const fr = {
  transport: {
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

    // ── Zones ───────────────────────────────────────────────────────────────
    zones: "Zones tarifaires",
    zone: "Zone",
    newZone: "Nouvelle zone",
    editZone: "Modifier la zone",
    zonesHint:
      "Le transport se tarifie à la distance : la zone de l'arrêt détermine ce que paient ses usagers.",
    zonePrice: "Tarif annuel",
    zoneCodeTaken: "Ce code de zone est déjà utilisé cette année.",
    zoneSaved: "Zone enregistrée.",
    zoneRepriced: "Zone enregistrée — {count} élèves retarifés.",
    noZones:
      "Aucune zone déclarée. Les abonnements ne peuvent pas être tarifés sans zone.",
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
    noZoneOnStop: "Sans zone — les abonnés d'ici ne peuvent pas être tarifés.",

    // ── Riders ──────────────────────────────────────────────────────────────
    addRider: "Abonner un élève",
    editRider: "Modifier l'abonnement",
    rider: "Abonné",
    noRiders: "Aucun élève sur cette ligne.",
    pupil: "Élève",
    subscriptionStatus: "État",
    startsOn: "À partir du",
    endsOn: "Jusqu'au",
    pricePerYear: "Tarif annuel",
    riderAdded: "Élève abonné.",
    riderAddedBilled: "Élève abonné — {count} échéances tarifées.",
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
      "L'abonnement inscrit le tarif de la zone sur les échéances de transport de l'élève. Ce qui est dû reste sur l'échéancier.",

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
  },
  transportOptions: {
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
  transportRoutes: "Lignes",
  transportFleet: "Flotte",
  transportZones: "Zones",
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
  },
};

export default fr;
