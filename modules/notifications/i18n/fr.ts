/** Notifications translations (fr). */
const fr = {
  notification: {
    title: "Notifications",
    subtitle: "Ce qui s’est passé et que vous n’avez pas encore lu.",
    empty: "Rien à lire.",
    emptyHint:
      "Vous serez prévenu ici dès qu’il se passe quelque chose qui vous concerne.",
    emptyUnread: "Vous êtes à jour.",
    unread: "{count} non lues",
    markAllRead: "Tout marquer comme lu",
    markedAllRead: "Tout a été marqué comme lu.",
    markRead: "Marquer comme lu",
    open: "Ouvrir",
    viewAll: "Voir toutes les notifications",
    filterAll: "Toutes",
    filterUnread: "Non lues",
    bell: "Notifications",
    bellUnread: "Notifications, {count} non lues",
    loadError: "Vos notifications n’ont pas pu être chargées.",

    kinds: {
      EVENT_PUBLISHED: "Nouvel événement : {title}",
      REQUEST_HANDLED: "{document} : {status}",
      MARKS_PUBLISHED: "Nouvelles notes de {child} en {subject}",
      BULLETIN_PUBLISHED: "Le bulletin de {child} du {term} est disponible",
      REMARK_SHARED: "Une remarque au sujet de {child}",
      PAYMENT_RECORDED: "Règlement de {amount} enregistré — reçu {code}",
      REQUEST_FILED: "{document} demandé par la famille de {child}",
      ASSESSMENT_VALIDATED: "« {assessment} » a été validé",
    },
  },
} as const;

export const nav = {
  notifications: "Notifications",
};

export default fr;
