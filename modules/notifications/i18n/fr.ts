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
      ASSESSMENT_SCHEDULED: "{subject} : « {title} » prévu pour {child} le {date}",
      ATTENDANCE_MISSED: "{child} a été noté {status} le {date}",
      TRANSPORT_MISSED: "{child} a été noté {status} au bus le {date}",
      SUPPLY_LIST_APPROVED: "Fournitures à acheter pour {child} : {title}",
      SUPPLY_LIST_SUBMITTED: "{title} ({className}) à valider — {teacher}",
      REMARK_WRITTEN: "{teacher} a écrit au sujet de {child} — en attente de votre décision",
      REGISTER_ABSENCES: "{className} : {count} absent(s) le {date}",
      SUPPLY_LIST_REVIEWED: "Votre liste {title} : {status}",
      LEAVE_DECIDED: "Votre congé du {date} : {status}",
      ADVANCE_DECIDED: "Votre avance de {amount} : {status}",
      REQUEST_FILED: "{document} demandé par la famille de {child}",
      ASSESSMENT_SUBMITTED: "« {assessment} » corrigé par {teacher} — à valider",
      ASSESSMENT_VALIDATED: "« {assessment} » a été validé",
    },
  },
} as const;

export const nav = {
  notifications: "Notifications",
};

export default fr;
