/**
 * Notifications translations (en). Canonical — the `Dictionary` type is derived
 * from this file, so a key added here is a compile error until `fr` and `ar`
 * supply it.
 *
 * `kinds` is the whole point of the module storing a code rather than a
 * sentence: the same row reads here in French at the desk and in Arabic on the
 * phone. The `{slots}` are filled from the row's `params` — proper nouns only,
 * never words that would need translating.
 */
const en = {
  notification: {
    title: "Notifications",
    subtitle: "What has happened that you have not read yet.",
    empty: "Nothing to read.",
    emptyHint: "You will be told here when something happens that concerns you.",
    emptyUnread: "You are up to date.",
    unread: "{count} unread",
    markAllRead: "Mark all as read",
    markedAllRead: "All marked as read.",
    markRead: "Mark as read",
    open: "Open",
    viewAll: "See all notifications",
    filterAll: "All",
    filterUnread: "Unread",
    // The bell in the header. Announced rather than drawn, so a reader who
    // cannot see the dot is still told there is one.
    bell: "Notifications",
    bellUnread: "Notifications, {count} unread",
    loadError: "Your notifications could not be loaded.",

    kinds: {
      EVENT_PUBLISHED: "New event: {title}",
      REQUEST_HANDLED: "{document}: {status}",
      MARKS_PUBLISHED: "New marks for {child} in {subject}",
      BULLETIN_PUBLISHED: "{child}’s report for {term} is out",
      REMARK_SHARED: "A note about {child}",
      PAYMENT_RECORDED: "Payment of {amount} recorded — receipt {code}",
      ASSESSMENT_SCHEDULED: "{subject}: “{title}” set for {child} on {date}",
      ATTENDANCE_MISSED: "{child} was marked {status} on {date}",
      TRANSPORT_MISSED: "{child} was marked {status} on the bus on {date}",
      SUPPLY_LIST_APPROVED: "Supplies to buy for {child}: {title}",
      SUPPLY_LIST_SUBMITTED: "{title} ({className}) awaits approval — {teacher}",
      SUPPLY_LIST_REVIEWED: "Your list {title}: {status}",
      LEAVE_DECIDED: "Your leave of {date}: {status}",
      ADVANCE_DECIDED: "Your salary advance of {amount}: {status}",
      REQUEST_FILED: "{document} asked for by {child}’s family",
      ASSESSMENT_SUBMITTED: "“{assessment}” corrected by {teacher} — awaiting validation",
      ASSESSMENT_VALIDATED: "“{assessment}” was accepted",
    },
  },
} as const;

export const nav = {
  notifications: "Notifications",
};

export default en;
