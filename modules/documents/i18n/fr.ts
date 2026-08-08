/** Documents translations (fr). Checked against `en` — see lib/i18n/types.ts. */
const fr = {
  document: {
    dossier: "Dossier",
    dossierSubtitle: "Les pièces demandées par l'école, et celles qu'elle détient.",
    piece: "Pièce",
    required: "Obligatoire",
    optional: "Facultative",
    copies: "{count} exemplaires",
    status: "État",
    receivedOn: "Reçue le",
    reference: "Référence",
    referenceHint: "Le numéro propre au document, lorsqu'il en a un.",
    notes: "Observation",
    notesHint: "Motif du refus, ou fondement de la dispense.",
    recordedBy: "Saisie par",
    record: "Enregistrer",
    recorded: "Dossier mis à jour.",
    markReceived: "Marquer comme reçu",
    markedReceived: "Marqué reçu.",
    markedMissing: "Marqué manquant.",
    complete: "Dossier complet",
    missingCount: "{count} manquantes",
    missingOptional: "{count} facultatives en attente",
    settledOf: "{settled} pièces obligatoires sur {total}",
    noTypes:
      "Aucune pièce n'a été déclarée. Ajoutez-les dans Configuration → Établissement.",
    emptyDossier: "Rien n'est encore enregistré sur ce dossier.",
  },
  documentOptions: {
    statuses: {
      MISSING: "Manquante",
      RECEIVED: "Reçue",
      REJECTED: "Refusée",
      EXEMPTED: "Dispensée",
    },
  },
} as const;

export const permissions = {
  groups: {
    document: "Dossiers des élèves",
  },
  codes: {
    "document.view": "Consulter le dossier d'un élève",
    "document.manage": "Enregistrer les pièces d'un dossier",
  },
} as const;

export default fr;
