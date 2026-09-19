/**
 * Messaging translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  messaging: {
    title: "Relances de paiement",
    subtitle:
      "Envoyez un rappel WhatsApp aux parents des familles en retard de paiement.",
    backToCaisse: "Caisse",

    gateway: {
      READY: "Connecté",
      DISCONNECTED: "Déconnecté — reconnectez le téléphone puis reprenez",
      UNCONFIGURED: "Non configuré sur ce serveur",
    },

    credits: {
      label: "Crédits de messages",
      left: "{count} restants",
      contactOwner:
        "Crédits insuffisants. Contactez le propriétaire de la plateforme pour en acheter — un crédit, un message.",
      manage: "Gérer les crédits",
    },

    filters: {
      title: "Qui",
      minAmount: "En retard d'au moins",
      level: "Niveau",
      class: "Classe",
      allLevels: "Tous les niveaux",
      allClasses: "Toutes les classes",
      search: "Rechercher une famille ou un parent",
    },

    columns: {
      family: "Famille",
      contact: "Parent",
      phone: "Téléphone",
      overdue: "En retard",
      status: "Statut",
    },

    skip: {
      NO_PHONE: "Aucun mobile valide",
      COOL_DOWN: "Déjà relancée récemment",
    },
    willSend: "Sera relancée",
    noneLate: "Aucune famille n'est en retard de paiement.",

    selection: {
      leftOut: "Exclue",
      skipped: "{count} ignorées",
      summary: "{count} seront relancées · {skipped} ignorées",
      exclude: "Exclure",
      include: "Inclure",
    },

    compose: {
      title: "Le message",
      template: "Message",
      variablesHint:
        "Variables : {parent} {famille} {montant} {enfants} {ecole} {remarque}",
      remark: "Remarque",
      remarkHint: "Texte libre, inséré à l'endroit où vous écrivez {remarque}.",
      preview: "Aperçu",
      previewFor: "Pour {family}",
      unknownVariables: "Variable inconnue : {names}",
      defaultTemplate:
        "Bonjour {parent}, sauf erreur de notre part, un paiement de scolarité de {montant} est en retard pour {enfants}. {remarque} Merci, {ecole}.",
    },

    print: "Imprimer",
    send: "Envoyer",
    sendConfirm:
      "Envoyer {count} messages ? Cela utilise {count} crédits ; les crédits des messages en échec sont rendus.",
    sending: "Mise en file…",
    queued: "{count} messages en file. L'envoi se fait en arrière-plan.",
    cancelled: "Campagne annulée. {count} crédits rendus.",
    cancel: "Annuler",
    resume: "Reprendre",
    activeCampaign: "Une campagne est en cours",
    viewCampaign: "Voir l'avancement",

    campaigns: {
      title: "Envois",
      empty: "Rien n'a encore été envoyé.",
      recipients: "Destinataires",
      sent: "Envoyés",
      failed: "Échecs",
      pending: "En attente",
      cancelled: "Annulés",
      back: "Relances",
    },

    creditsPage: {
      title: "Crédits de messages",
      subtitle: "Réservé au propriétaire. Un crédit, un message.",
      balance: "Solde",
      amount: "Crédits à ajouter",
      note: "Note (ce qui a été acheté)",
      submit: "Ajouter les crédits",
      ledger: "Historique",
      emptyLedger: "Aucun mouvement.",
    },
    toppedUp: "Crédits ajoutés. Solde : {balance}.",

    gatewayLabel: "WhatsApp",
    campaignStatus: {
      QUEUED: "En file",
      RUNNING: "En cours d'envoi",
      PAUSED: "En pause — WhatsApp déconnecté",
      DONE: "Terminée",
      CANCELLED: "Annulée",
    },
    deliveryStatus: {
      PENDING: "En attente",
      SENDING: "Envoi",
      SENT: "Envoyé",
      FAILED: "Échec, crédit rendu",
      CANCELLED: "Annulé",
    },
    creditReasons: {
      TOPUP: "Recharge",
      RESERVE: "Réservé pour une campagne",
      REFUND: "Remboursé",
      ADJUST: "Ajustement",
    },

    errors: {
      templateInvalid: "Écrivez un message de 1 000 caractères au plus.",
      notConfigured: "WhatsApp n'est pas configuré sur ce serveur.",
      noRecipients: "Personne à relancer avec ces filtres.",
      insufficientCredits:
        "Crédits insuffisants : {available} disponibles, {needed} nécessaires. Contactez le propriétaire de la plateforme pour en acheter.",
      campaignInProgress:
        "Une campagne est déjà en cours pour cette école. Attendez sa fin ou annulez-la.",
      amountInvalid: "Saisissez un nombre entier de crédits supérieur à zéro.",
    },
  },
};

export const nav = {
  reminders: "Relances",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    messaging: "Relances WhatsApp",
  },
  codes: {
    "messaging.send": "Envoyer des relances WhatsApp",
  },
};

export default fr;
