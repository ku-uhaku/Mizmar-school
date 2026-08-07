/**
 * Chat translations (en). Canonical — a key added here is a compile error until
 * `fr` and `ar` supply it.
 */
const en = {
  chat: {
    title: "Parents' space",
    subtitle: "The conversations between this school's families.",
    channels: "Channels",
    generalChannel: "All parents",
    classChannel: "{name} parents",
    messages: "Messages",
    noChannels: "No conversation is open.",
    noChannelsHint:
      "Turn the parents' space on under Configuration to open one.",
    noMessages: "Nothing has been said yet.",
    messageCount: "{count} messages",
    lastMessage: "Last message {date}",
    disabled: "Turned off",
    disabledHint:
      "The parents' space is off for this school. Nobody can read or post.",
    archived: "Closed",
    archivedHint: "Still readable, but nobody can post.",
    archive: "Close the channel",
    reopen: "Reopen",
    archived_: "Channel closed.",
    reopened: "Channel reopened.",

    // ── Moderation ─────────────────────────────────────────────────────────
    deleteMessage: "Remove",
    deleteTitle: "Remove this message?",
    deleteBody:
      "It stops being visible to parents. It is kept, with your name against the removal, so the school can say later what it removed and why.",
    deleted: "Message removed.",
    deletedLabel: "Removed",
    deletedBy: "Removed by {name}",
    showDeleted: "Show removed",
    author: "Author",
    postedAt: "Posted",
  },
  chatOptions: {
    kinds: {
      GENERAL: "All parents",
      CLASS: "One class",
    },
  },
} as const;

export const nav = { chat: "Parents' space" };

export const permissions = {
  groups: { chat: "Parents' space" },
  codes: {
    "chat.view": "Read the parents' conversations",
    "chat.moderate": "Remove messages and close channels",
  },
};

export default en;
