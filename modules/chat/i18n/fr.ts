/** Chat translations (fr). Same shape as `en.ts`, which is canonical. */
const fr = {
  chat: {
    title: "Espace parents",
    subtitle: "Les échanges entre les familles de l'école.",
    channels: "Fils de discussion",
    generalChannel: "Tous les parents",
    classChannel: "Parents de {name}",
    messages: "Messages",
    noChannels: "Aucune discussion ouverte.",
    noChannelsHint:
      "Activez l'espace parents dans la configuration pour en ouvrir une.",
    noMessages: "Rien n'a encore été écrit.",
    messageCount: "{count} messages",
    lastMessage: "Dernier message {date}",
    disabled: "Désactivé",
    disabledHint:
      "L'espace parents est désactivé pour cette école. Personne ne peut lire ni écrire.",
    archived: "Fermé",
    archivedHint: "Toujours consultable, mais plus personne ne peut écrire.",
    archive: "Fermer le fil",
    reopen: "Rouvrir",
    archived_: "Fil fermé.",
    reopened: "Fil rouvert.",

    // ── Modération ─────────────────────────────────────────────────────────
    deleteMessage: "Retirer",
    deleteTitle: "Retirer ce message ?",
    deleteBody:
      "Il cesse d'être visible par les parents. Il est conservé, avec votre nom sur le retrait, pour que l'école puisse dire plus tard ce qu'elle a retiré et pourquoi.",
    deleted: "Message retiré.",
    deletedLabel: "Retiré",
    deletedBy: "Retiré par {name}",
    showDeleted: "Afficher les retirés",
    author: "Auteur",
    postedAt: "Publié",
  },
  chatOptions: {
    kinds: {
      GENERAL: "Tous les parents",
      CLASS: "Une classe",
    },
  },
} as const;

export const nav = { chat: "Espace parents" };

export const permissions = {
  groups: { chat: "Espace parents" },
  codes: {
    "chat.view": "Consulter les échanges entre parents",
    "chat.moderate": "Retirer des messages et fermer des fils",
  },
};

export default fr;
