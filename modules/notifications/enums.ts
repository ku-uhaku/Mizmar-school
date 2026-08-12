/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/notifications/notification.prisma`. Labels live in
 * `i18n/*.ts` under `notification.kinds`.
 *
 * Pure data: this crosses to the client, and the phone mirrors the route map
 * below in `mobile/src/api/types.ts`.
 */

/**
 * What a notification can be about.
 *
 * ── One kind, one audience ──────────────────────────────────────────────────
 * A kind is never sent to two sorts of reader. `REQUEST_FILED` is a fact about
 * work and only ever reaches the desk that does it; `REQUEST_HANDLED` is the
 * answer and only ever reaches the family that asked. That is why there is no
 * `audience` column: the recipient set is decided once, by the resolver each
 * kind is written through, and storing it again would be a second answer to a
 * question `kind` already answers.
 *
 * The inbox itself is *not* filtered by audience anywhere. An account that is
 * both a teacher and a parent is genuinely both, and sees both — splitting the
 * list would mean deciding for them which half they are reading it as.
 */
export const NOTIFICATION_KINDS = [
  // ── To the family ─────────────────────────────────────────────────────────
  /** An event was announced to a class this child sits in, or to the school. */
  "EVENT_PUBLISHED",
  /** The office accepted, refused or made ready a paper the family asked for. */
  "REQUEST_HANDLED",
  /** A contrôle was validated, so its marks are now visible. */
  "MARKS_PUBLISHED",
  /** A bulletin was released. */
  "BULLETIN_PUBLISHED",
  /** A teacher's observation was released to the family. */
  "REMARK_SHARED",
  /** A payment was taken at the caisse — the receipt, not a demand. */
  "PAYMENT_RECORDED",
  /** A devoir or contrôle has been set, with a date the child has to sit it. */
  "ASSESSMENT_SCHEDULED",
  /** L'appel: the child was not in the room, or arrived late. */
  "ATTENDANCE_MISSED",
  /** The child was not on the bus. */
  "TRANSPORT_MISSED",
  /** A liste de fournitures was approved — things the family has to go and buy. */
  "SUPPLY_LIST_APPROVED",

  // ── To the desk ───────────────────────────────────────────────────────────
  /** A family filed a request from the phone; somebody has to answer it. */
  "REQUEST_FILED",
  /** A teacher has finished correcting and handed a paper up for validation. */
  "ASSESSMENT_SUBMITTED",
  /** A teacher handed a liste de fournitures up for approval. */
  "SUPPLY_LIST_SUBMITTED",

  // ── To the teacher ────────────────────────────────────────────────────────
  /** A paper this teacher is answerable for was accepted. */
  "ASSESSMENT_VALIDATED",
  /** The office has decided on a list this teacher wrote. */
  "SUPPLY_LIST_REVIEWED",

  // ── To a member of staff, about themselves ────────────────────────────────
  /*
    The two HR answers a person is actually waiting on. Both reach the *staff
    member's own account*, which most of a payroll does not have — see the note
    on `Staff.userId` — so both resolve through `staffAccount` and quietly reach
    nobody when there is no account to reach. That is the right failure: a
    school where nobody signs in still runs its payroll on paper.
  */
  "LEAVE_DECIDED",
  "ADVANCE_DECIDED",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

/**
 * How loudly a kind reads. Drives the dot's colour and nothing else — it is a
 * presentation fact, so it lives with the kind rather than in each surface's
 * own switch, which is how the web and the phone would come to disagree.
 */
export const NOTIFICATION_TONES = ["info", "good", "warn"] as const;
export type NotificationTone = (typeof NOTIFICATION_TONES)[number];

export const KIND_TONES: Record<NotificationKind, NotificationTone> = {
  EVENT_PUBLISHED: "info",
  REQUEST_HANDLED: "good",
  MARKS_PUBLISHED: "info",
  BULLETIN_PUBLISHED: "good",
  REMARK_SHARED: "warn",
  PAYMENT_RECORDED: "good",
  ASSESSMENT_SCHEDULED: "info",
  // A missed lesson is the one line here a parent is expected to act on.
  ATTENDANCE_MISSED: "warn",
  // And a missed bus is the one they are expected to act on *now*.
  TRANSPORT_MISSED: "warn",
  SUPPLY_LIST_APPROVED: "info",
  REQUEST_FILED: "warn",
  ASSESSMENT_SUBMITTED: "warn",
  SUPPLY_LIST_SUBMITTED: "warn",
  ASSESSMENT_VALIDATED: "good",
  // Carries its own outcome, so the tone cannot say "good" — a refused list and
  // an approved one are the same kind. Neutral, and the words do the work.
  SUPPLY_LIST_REVIEWED: "info",
  LEAVE_DECIDED: "info",
  ADVANCE_DECIDED: "info",
};

/**
 * Where reading one takes you, on the web dashboard.
 *
 * Null for every family-facing kind, and that is not an omission: a guardian
 * holds no membership, so every dashboard screen answers them with the
 * forbidden state. Their route is the phone's, below. A notification with
 * nowhere to go renders as a line rather than a link.
 */
export function webHref(
  kind: string,
  subject: { subjectId: string | null },
): string | null {
  switch (kind) {
    case "REQUEST_FILED":
      return "/requests";
    case "ASSESSMENT_SUBMITTED":
    case "ASSESSMENT_VALIDATED":
      return subject.subjectId ? `/assessments/${subject.subjectId}` : "/assessments";
    case "SUPPLY_LIST_SUBMITTED":
    case "SUPPLY_LIST_REVIEWED":
      return "/supplies";
    case "LEAVE_DECIDED":
      return "/hr/leave";
    case "ADVANCE_DECIDED":
      return "/hr/advances";
    default:
      return null;
  }
}

/**
 * The `params` column, parsed.
 *
 * Tolerant on purpose: the column is written by this app and read by two
 * clients, and a row that predates a kind's parameters must still render. A
 * missing value leaves its `{placeholder}` in place, which is ugly and legible
 * — the alternative, throwing, would take down the whole inbox over one row.
 */
export function readParams(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
        key,
        String(value),
      ]),
    );
  } catch {
    return {};
  }
}

/**
 * The key that makes writing one twice a no-op, or null where repetition is
 * meaningful. See the note on `Notification.dedupeKey`.
 */
export function dedupeKeyFor(
  kind: NotificationKind,
  subjectId: string | null,
  /**
   * What makes two notifications about the same row different things worth
   * saying. A dossier moves from accepted to ready to collected, and each move
   * is news — keyed on the id alone, only the first would ever be delivered.
   */
  discriminator?: string | null,
): string | null {
  /*
    The kinds where saying it twice is saying two different things.

    A payment: two settlements on one day are two receipts, and collapsing them
    would hide money the family actually paid.

    A submitted list: a teacher whose list is refused corrects it and hands it
    up again, and that second submission is a second thing for the office to
    look at — the first has already been dealt with. Keyed on the list, the
    office would be told once and never again.
  */
  if (kind === "PAYMENT_RECORDED" || kind === "SUPPLY_LIST_SUBMITTED") {
    return null;
  }
  // Nor is a register. A child can miss the maths lesson and the history one on
  // the same day, and those are two absences — the subject id is what tells
  // them apart, and it travels as the discriminator.
  if (!subjectId) return null;
  return discriminator
    ? `${kind}:${subjectId}:${discriminator}`
    : `${kind}:${subjectId}`;
}

/** How many the inbox loads at once. Older ones are simply not news any more. */
export const INBOX_PAGE_SIZE = 30;

/** Past this the bell shows "99+" rather than a number nobody reads. */
export const BADGE_CAP = 99;
