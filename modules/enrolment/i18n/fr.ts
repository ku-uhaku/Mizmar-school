/**
 * Enrolment translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  enrolment: {
    title: "Inscription",
    subtitle: "La place de l'élève pour {year} — niveau, classe et frais.",
    enrol: "Inscrire",
    enrolTitle: "Inscrire cet élève",
    notEnrolled: "Non inscrit pour cette année.",
    notEnrolledHint:
      "L'inscription fixe le niveau et génère l'échéancier de l'année.",
    level: "Niveau",
    levelHint: "Les niveaux ouverts par cette école cette année.",
    track: "Filière",
    schoolClass: "Classe",
    classHint: "Peut attendre septembre — la place est réelle sans elle.",
    group: "Groupe",
    groupHint: "Pour les matières enseignées en demi-groupes.",
    noClass: "Pas encore de classe",
    noGroup: "Aucun groupe",
    status: "Statut",
    enrolledOn: "Inscrit le",
    leftOn: "Parti le",
    isRepeating: "Redoublant",
    options: "Options",
    usesTransport: "Transport scolaire",
    usesCanteen: "Cantine",
    optionsHint:
      "Les frais optionnels ne sont facturés qu'aux familles abonnées.",
    optionStartsOn: "Facturé à partir de",
    optionStartsWithYear: "Le début de l'année",
    optionStartsOnHint:
      "Les échéances antérieures à ce mois ne sont pas générées : une famille qui s'abonne en cours d'année ne paie que les mois utilisés.",
    notes: "Remarques",
    capacity: "{enrolled} / {capacity}",
    seatsLeft: "{count} places restantes",
    full: "Complète",
    enrolled: "Élève inscrit.",
    enrolledWithFees: "Élève inscrit et échéancier de l'année généré.",
    updated: "Inscription mise à jour.",
    updatedWithFees:
      "Inscription mise à jour · {added} échéances ajoutées, {removed} retirées.",
    deleted: "Inscription supprimée.",
    alreadyEnrolled: "Cet élève est déjà inscrit pour cette année.",
    offeringUnavailable: "Ce niveau n'est pas ouvert cette année.",
    classUnavailable: "Cette classe n'appartient pas à cette année.",
    classAssigned: "Classe affectée.",
    classCleared: "Élève retiré de la classe.",
    deleteTitle: "Supprimer cette inscription ?",
    deleteBody: "Tout l'échéancier de l'année sera supprimé avec elle.",

    fees: "Frais",
    feesSubtitle: "Ce que cette famille doit pour l'année, mois par mois.",
    feesEmpty: "Aucun échéancier.",
    feesEmptyHint:
      "L'échéancier est généré à l'inscription à partir du tarif de l'année.",
    generateFees: "Générer l'échéancier",
    rebuildFees: "Régénérer depuis le tarif",
    rebuildTitle: "Régénérer l'échéancier ?",
    rebuildBody:
      "Les montants modifiés à la main sur cet échéancier seront perdus.",
    feesGenerated: "Échéancier généré.",
    feesUnchanged: "Rien à ajouter — l'échéancier est déjà complet.",
    feeUpdated: "Ligne de frais mise à jour.",
    applyToFollowing: "Appliquer aussi aux mois suivants",
    applyToFollowingHint:
      "Reporte cette réduction sur les {count} échéances suivantes de ce frais. Chaque mois garde son montant.",
    feeUpdatedCarried: "Ligne mise à jour, et reportée sur {count} mois suivants.",
    legendClick: "Cliquez sur une case pour changer son montant ou sa réduction",
    legendReduced: "Réduit",
    legendNotDue: "Exonéré ou annulé",
    editFee: "Modifier ce montant",
    editFeeHint: "Le montant et la réduction pour un mois.",
    baseAmount: "Montant avant réduction",
    discount: "Réduction",
    discountPercent: "Pourcentage",
    discountAmount: "Montant fixe",
    discountRule: "Réduction accordée",
    discountRuleHint:
      "Au titre de laquelle des réductions de l'année elle est accordée.",
    discountTooLarge: "La réduction dépasse le montant facturé.",
    netAmount: "À payer",
    feeStatus: "Statut",
    dueOn: "Échéance {date}",
    instalment: "Échéance {index}",
    monthTotal: "Total du mois",
    rowTotal: "Total",
    grandTotal: "Total de l'année",
    beforeDiscount: "Avant réductions",
    totalDiscount: "Réductions accordées",
    noCharge: "—",
    feeType: "Frais",
  },
  enrolmentOptions: {
    statuses: {
      PENDING: "En attente",
      ACTIVE: "Actif",
      TRANSFERRED: "Transféré",
      WITHDRAWN: "Radié",
      COMPLETED: "Terminé",
    },
    lineStatuses: {
      DUE: "Dû",
      WAIVED: "Exonéré",
      CANCELLED: "Annulé",
    },
    months: {
      "1": "Jan",
      "2": "Fév",
      "3": "Mar",
      "4": "Avr",
      "5": "Mai",
      "6": "Juin",
      "7": "Juil",
      "8": "Août",
      "9": "Sept",
      "10": "Oct",
      "11": "Nov",
      "12": "Déc",
    },
  },
};

export const permissions = {
  groups: {
    enrolment: "Inscriptions",
  },
  codes: {
    "enrolment.view": "Consulter les inscriptions",
    "enrolment.create": "Inscrire des élèves",
    "enrolment.update": "Modifier les inscriptions et les affectations",
    "enrolment.delete": "Supprimer des inscriptions",
    "enrolment.fees": "Gérer les échéanciers et les réductions",
  },
};

export default fr;
