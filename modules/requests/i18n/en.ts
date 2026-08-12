const en = {
  request: {
    title: "Document requests",
    subtitle: "What families have asked the school to issue, and where each has got to.",

    // ── The queue ───────────────────────────────────────────────────────────
    queue: "To deal with",
    archive: "Closed",
    empty: "Nothing to deal with. Every request has been answered.",
    emptyArchive: "No closed request.",
    pupil: "Pupil",
    document: "Document",
    askedBy: "Asked by",
    askedOn: "Asked on",
    copies: "Copies",
    copiesCount: "{count} copies",
    reason: "What it is for",
    noReason: "No detail given.",
    status: "Status",
    readyOn: "Ready on",
    officeNote: "Answer to the family",
    handledBy: "Dealt with by {name}",
    collectedOn: "Collected on {date}",
    overdue: "Past the promised day",
    overdueCount: "Overdue",
    pendingCount: "Awaiting an answer",
    readyCount: "Waiting to be collected",

    // ── Answering one ───────────────────────────────────────────────────────
    handle: "Deal with it",
    accept: "Accept and set a day",
    acceptTitle: "Accept this request",
    acceptHelp:
      "Tell the family when to come for it. They see the day on their phone.",
    markReady: "It is ready",
    markReadyTitle: "Mark it ready",
    markReadyHelp:
      "The paper is written and waiting at the desk. The family is told they may come now.",
    markCollected: "Handed over",
    markCollectedTitle: "Record the hand-over",
    markCollectedHelp: "The family has come and taken it. This closes the request.",
    reject: "Refuse",
    rejectTitle: "Refuse this request",
    rejectHelp: "Say why. The family reads this, so write it for them.",
    noteToFamily: "Message to the family",
    noteOptional: "Optional — what to bring, which door, opening hours.",
    confirm: "Confirm",
    handled: "Request updated.",

    // ── What the server refuses ─────────────────────────────────────────────
    dateRequired: "Give the day the family should come for it.",
    noteRequired: "Say why it is refused — the family reads this.",
    staleMove: "Somebody else has already moved this request. Reload the screen.",

    // ── The catalogue ───────────────────────────────────────────────────────
    usualDelay: "Usually {count} days",
    usualDelayOne: "Usually the next day",
    noDelayPromised: "No fixed delay",
  },

  requestOptions: {
    statuses: {
      PENDING: "Awaiting an answer",
      ACCEPTED: "Accepted",
      READY: "Ready",
      COLLECTED: "Collected",
      REJECTED: "Refused",
      CANCELLED: "Withdrawn",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  requests: "Requests",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    request: "Document requests",
  },
  codes: {
    "request.view": "View document requests",
    "request.handle": "Answer, accept and refuse requests",
  },
} as const;

export default en;
