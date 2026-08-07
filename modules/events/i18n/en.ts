/**
 * Events translations (en). Canonical — the `Dictionary` type is derived from
 * this file, so a key added here is a compile error until `fr` and `ar` supply
 * it.
 */
const en = {
  event: {
    title: "Events",
    subtitle: "What the school announces to its families.",
    newEvent: "New event",
    editEvent: "Edit event",
    eventTitle: "Title",
    titleAr: "Title (Arabic)",
    description: "Details",
    descriptionHint: "What a parent reads under the title.",
    kind: "Kind",
    status: "Status",
    startsAt: "Starts",
    endsAt: "Ends",
    endsAtHint: "Leave blank for something happening on one day.",
    allDay: "All day",
    allDayHint:
      "No clock time — the parent sees the date alone, which is what most announcements want.",
    location: "Where",
    locationHint: "Free text: a room, the yard, a museum.",
    audience: "Who it is for",
    schoolWide: "The whole school",
    schoolWideHint: "Every family sees it.",
    chosenAudience: "Chosen levels and classes",
    levels: "Levels",
    classes: "Classes",
    audienceEmpty:
      "Choose at least one level or class, or make it school-wide — an event nobody can see cannot be published.",
    audienceCount: "{count} targeted",

    // ── Publishing ─────────────────────────────────────────────────────────
    publish: "Publish",
    publishTitle: "Publish this event?",
    publishBody:
      "“{title}” becomes visible to every family it is aimed at. They see it on their phone straight away.",
    published: "Event published.",
    publishedOn: "Published {date}",
    publishedBy: "Published by {name}",
    unpublish: "Back to draft",
    unpublishTitle: "Take this event back to draft?",
    unpublishBody:
      "“{title}” stops being visible to families. Anyone who has already seen it will simply not find it again.",
    unpublished: "Back to draft.",
    cancelEvent: "Call off",
    cancelTitle: "Call this event off?",
    cancelBody:
      "“{title}” stays visible to families, marked as called off — which is the point. Deleting it instead would send a parent to a locked gate.",
    cancelled: "Event called off.",
    saved: "Event saved.",
    deleted: "Event removed.",
    deleteTitle: "Remove this event?",
    deleteBody: "“{title}” will be removed.",
    deletePublished:
      "This event has been announced — call it off instead, so families are told.",

    // ── The list ───────────────────────────────────────────────────────────
    upcoming: "Upcoming",
    past: "Past",
    drafts: "Drafts",
    noEvents: "Nothing announced yet.",
    noEventsHint: "Create an event, then publish it for families to see.",
    noUpcoming: "Nothing coming up.",
    allDayBadge: "All day",
    searchPlaceholder: "Search by title or place…",
    startAfterEnd: "The end cannot be before the start.",
    outsideYear: "That date falls outside the school year.",
  },
  eventOptions: {
    kinds: {
      MEETING: "Meeting",
      OUTING: "Outing",
      CEREMONY: "Ceremony",
      EXAM: "Exams",
      HOLIDAY_INFO: "Holidays",
      OTHER: "Other",
    },
    statuses: {
      DRAFT: "Draft",
      PUBLISHED: "Published",
      CANCELLED: "Called off",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  events: "Events",
};

export const permissions = {
  groups: {
    event: "Events",
  },
  codes: {
    "event.view": "See events",
    "event.manage": "Create and edit events",
    "event.publish": "Publish and call off events",
    "event.delete": "Delete events",
  },
};

export default en;
