/**
 * Requests translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  request: {
    title: "Demandes de documents",
    subtitle:
      "Ce que les familles ont demandé à l'école, et où en est chaque demande.",

    // ── La file ─────────────────────────────────────────────────────────────
    queue: "À traiter",
    archive: "Clôturées",
    empty: "Rien à traiter. Toutes les demandes ont reçu une réponse.",
    emptyArchive: "Aucune demande clôturée.",
    pupil: "Élève",
    document: "Document",
    askedBy: "Demandé par",
    askedOn: "Demandé le",
    copies: "Exemplaires",
    copiesCount: "{count} exemplaires",
    reason: "Motif",
    noReason: "Aucune précision.",
    status: "État",
    readyOn: "Prêt le",
    officeNote: "Réponse à la famille",
    handledBy: "Traité par {name}",
    collectedOn: "Retiré le {date}",
    overdue: "Date promise dépassée",
    overdueCount: "En retard",
    pendingCount: "En attente de réponse",
    readyCount: "À retirer",

    // ── Traiter une demande ─────────────────────────────────────────────────
    handle: "Traiter",
    accept: "Accepter et fixer une date",
    acceptTitle: "Accepter cette demande",
    acceptHelp:
      "Indiquez à la famille quand venir le retirer. La date s'affiche sur son téléphone.",
    markReady: "Le document est prêt",
    markReadyTitle: "Marquer comme prêt",
    markReadyHelp:
      "Le document est rédigé et disponible au guichet. La famille est informée qu'elle peut venir.",
    markCollected: "Remis",
    markCollectedTitle: "Enregistrer la remise",
    markCollectedHelp:
      "La famille est venue le retirer. Cela clôture la demande.",
    reject: "Refuser",
    rejectTitle: "Refuser cette demande",
    rejectHelp: "Indiquez le motif. La famille le lit, écrivez-le pour elle.",
    noteToFamily: "Message à la famille",
    noteOptional:
      "Facultatif — ce qu'il faut apporter, quel guichet, les horaires.",
    confirm: "Confirmer",
    handled: "Demande mise à jour.",

    // ── Ce que le serveur refuse ────────────────────────────────────────────
    dateRequired: "Indiquez la date à laquelle la famille doit venir le retirer.",
    noteRequired: "Indiquez le motif du refus — la famille le lit.",
    staleMove:
      "Quelqu'un a déjà traité cette demande. Actualisez l'écran.",

    // ── Le catalogue ────────────────────────────────────────────────────────
    usualDelay: "Habituellement {count} jours",
    usualDelayOne: "Habituellement le lendemain",
    noDelayPromised: "Délai non garanti",
  },

  requestOptions: {
    statuses: {
      PENDING: "En attente de réponse",
      ACCEPTED: "Acceptée",
      READY: "Prête",
      COLLECTED: "Retirée",
      REJECTED: "Refusée",
      CANCELLED: "Annulée",
    },
  },
};

export const nav = {
  requests: "Demandes",
} as const;

export const permissions = {
  groups: {
    request: "Demandes de documents",
  },
  codes: {
    "request.view": "Consulter les demandes de documents",
    "request.handle": "Traiter, accepter et refuser les demandes",
  },
} as const;

export default fr;
