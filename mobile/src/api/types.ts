/**
 * The shapes the school server returns.
 *
 * Hand-mirrored from each module's `queries.ts` rather than imported: those
 * files are `server-only` and pull in Prisma, so importing them here
 * would drag the whole data layer into a phone bundle. Only the field names
 * travel — and a mismatch shows up immediately, because every screen reads
 * these through a typed `useQuery`.
 */

export type MobileSpace = "family" | "teacher" | "driver" | "director";

export type Identity = {
  userId: string;
  email: string;
  fullName: string;
  organizationName: string;
  schoolName: string | null;
  schoolYearName: string | null;
  spaces: MobileSpace[];
  defaultSpace: MobileSpace | null;
};

// ── Famille ──────────────────────────────────────────────────────────────────

export type Child = {
  studentId: string;
  enrollmentId: string | null;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photoUrl: string | null;
  status: string;
  schoolName: string;
  schoolYearName: string | null;
  levelName: string | null;
  className: string | null;
  groupName: string | null;
};

export type Mark = {
  id: string;
  subjectName: string;
  title: string;
  typeName: string;
  termName: string;
  scheduledOn: string | null;
  score: number | null;
  maxScore: number;
  isAbsent: boolean;
  comment: string | null;
};

export type Absence = {
  id: string;
  date: string;
  status: string;
  minutesLate: number | null;
  isJustified: boolean;
  reason: string | null;
  subjectName: string | null;
};

export type FeeLine = {
  id: string;
  label: string;
  dueDate: string;
  amountCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
  isOverdue: boolean;
};

export type ChildDetail = {
  child: Child;
  marks: { marks: Mark[]; averageOutOf20: number | null };
  attendance: {
    entries: Absence[];
    missedCount: number;
    unjustifiedCount: number;
  };
  fees: {
    chargedCentimes: number;
    paidCentimes: number;
    outstandingCentimes: number;
    overdueCentimes: number;
    isUpToDate: boolean;
    lines: FeeLine[];
  };
  transport: {
    routeName: string;
    stopName: string;
    direction: string;
    status: string;
    vehiclePlate: string | null;
    driverName: string | null;
    driverPhone: string | null;
    morningTime: string | null;
    afternoonTime: string | null;
  } | null;
};

// ── Enseignant ───────────────────────────────────────────────────────────────

export type Lesson = {
  timetableEntryId: string;
  timeSlotId: string;
  startTime: string;
  endTime: string;
  schoolClassId: string;
  classCode: string;
  classGroupId: string | null;
  groupLabel: string | null;
  subjectId: string;
  subjectName: string;
  subjectColorHex: string | null;
  roomCode: string | null;
  /** True once every pupil on that roster has a mark for this period. */
  isMarked: boolean;
};

export type TeacherDay = {
  date: string;
  summary: {
    classCount: number;
    pupilCount: number;
    lessonsToday: number;
    registersLeftToday: number;
    papersToMark: number;
    remarksThisMonth: number;
  };
  lessons: Lesson[];
};

// ── Chauffeur ────────────────────────────────────────────────────────────────

export type TripRun = {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  scheduleName: string;
  direction: string;
  status: string;
  plannedDepartureTime: string;
  startedAt: string | null;
  arrivedAt: string | null;
  delayMinutes: number | null;
  vehicleRegistration: string | null;
  driverName: string | null;
  riderCount: number;
  cancelReason: string | null;
  /**
   * "UPCOMING" | "OPEN" | "CLOSED" — whether the voyage is at its hour.
   *
   * Decided by the server, never by this phone's clock: the same judgement is
   * re-made when a départ or a mark is posted, so a device an hour out of true
   * would be refused anyway. Reading it here only keeps the app from offering a
   * button that is going to be refused.
   */
  window: string;
};

export type DriverDay = { date: string; runs: TripRun[] };

export type RegisterEntry = {
  subscriptionId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string | null;
  stopName: string;
  pickupTime: string | null;
  direction: string;
  attendanceId: string | null;
  status: string | null;
  minutesLate: number;
  isJustified: boolean;
  reason: string | null;
};

/**
 * `entries` is empty until the run is under way — the server withholds the
 * names before the départ, so the screen reads `run.status` rather than the
 * length of the list to decide what to show.
 */
export type RunRegister = { run: TripRun; entries: RegisterEntry[] };

// ── Direction ────────────────────────────────────────────────────────────────

/**
 * Mirrors what `app/api/mobile/v1/director/dashboard` returns.
 *
 * Every block is nullable because the server gates each on the permission that
 * opens the screen it summarises: `schoolLife.view` grants the overview, not
 * the households or what the school has billed. A null means "not yours to
 * see", and the space omits that card rather than drawing a zero.
 */
export type DirectorDashboard = {
  schoolName: string | null;
  schoolYearName: string | null;
  stats: {
    standing: {
      enrolled: number;
      preRegistered: number;
      left: number;
      total: number;
    } | null;
    families: number | null;
    enrolment: {
      enrolled: number;
      pending: number;
      unplaced: number;
    } | null;
    billing: {
      billedCentimes: number;
      discountedCentimes: number;
    } | null;
    byLevel: { label: string; levelCode: string; value: number }[];
  };
};

/**
 * One announcement the school has published to this household.
 *
 * Hand-mirrored from `PortalEvent` in modules/portal/queries.ts — importing the
 * query would drag `server-only` and Prisma into the phone bundle.
 *
 * `isAllDay` is what decides whether to print a time at all: an all-day event
 * carries a real `startsAt` snapped to midnight, and rendering that as "00:00"
 * is exactly the thing the flag exists to prevent.
 */
export type SchoolEvent = {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  kind: "MEETING" | "OUTING" | "CEREMONY" | "EXAM" | "HOLIDAY_INFO" | "OTHER";
  /** CANCELLED stays on the list, marked — see the note on Event.status. */
  status: "PUBLISHED" | "CANCELLED";
  startsAt: string;
  endsAt: string | null;
  isAllDay: boolean;
  location: string | null;
};

/**
 * One line of the carnet de liaison the school released to the family.
 *
 * Hand-mirrored from `PortalRemark`. Only remarks a teacher marked visible
 * reach this type at all — the filter is in the query, not here, and it is the
 * only thing between a private note and this screen.
 */
export type Remark = {
  id: string;
  kind: string;
  tone: string;
  body: string;
  occurredOn: string;
  subjectName: string | null;
  authorName: string | null;
};

/**
 * One lesson of the child's week. Mirrors `PortalLesson`.
 *
 * Not the teacher space's `Lesson`, which carries what a teacher needs to take
 * a register — the ids, the group, whether it is marked. A parent reads the
 * week, so this is the same period seen from the other side.
 */
export type ChildLesson = {
  /** ISO day: 1 = Monday. */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  /** The short form, for a cell too narrow for "Sciences de la vie". */
  subjectShort: string;
  /** The subject's own colour, so the phone's grid reads like the school's. */
  colorHex: string | null;
  teacherName: string | null;
  roomName: string | null;
};

/**
 * A child's week. Mirrors `PortalTimetable`.
 *
 * `teachingDays` travels with the lessons so the grid can draw the school's
 * whole week — a Wednesday with nothing on it is a free day, not a missing one.
 */
export type Timetable = {
  teachingDays: number[];
  lessons: ChildLesson[];
};

/** One pièce of the dossier. Mirrors `PortalDossierPiece`. */
export type DossierPiece = {
  code: string;
  name: string;
  isRequired: boolean;
  isSettled: boolean;
  status: "MISSING" | "RECEIVED" | "REJECTED" | "EXEMPTED";
  receivedOn: string | null;
};

/** Mirrors `PortalDossier`. Completeness counts required pièces only. */
export type Dossier = {
  pieces: DossierPiece[];
  requiredCount: number;
  providedCount: number;
  isComplete: boolean;
};

/** One parents' conversation. Mirrors `PortalChannel`. */
export type Channel = {
  id: string;
  kind: "GENERAL" | "CLASS";
  label: string;
  /** Closed to new messages, still readable. */
  isArchived: boolean;
  messageCount: number;
  lastMessageAt: string | null;
};

/** One thing somebody said. Mirrors `PortalMessage`. */
export type ChatMessage = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  /** True when this account wrote it, so the thread can align it right. */
  isMine: boolean;
};

/** The topics a badge can be about. Mirrors `SEEN_TOPICS`. */
export type SeenTopic = "EVENTS" | "CHAT" | "MARKS" | "REMARKS";

/**
 * What is new for this household. Mirrors `PortalBadges`.
 *
 * Counts, not items: the watermark behind them can say how many are new but
 * not which — see the note on `PortalSeen`. That is what a badge needs.
 */
export type Badges = {
  events: number;
  chat: number;
  marks: number;
  remarks: number;
  total: number;
};
