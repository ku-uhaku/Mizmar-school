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
  /** `YYYY-MM` of the due date — what the payments screen groups by. */
  month: string;
  dueDate: string;
  amountCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
  isOverdue: boolean;
};

export type ChildDetail = {
  child: Child;
  /**
   * `average` is on the school's own scale — read it with `outOf` beside it and
   * never as a figure out of twenty. See PortalMarks in modules/portal/queries.ts.
   */
  marks: {
    marks: Mark[];
    average: number | null;
    outOf: number;
    /** Where passing starts on that scale — the school's, never a literal 10. */
    passMark: number;
  };
  attendance: {
    entries: Absence[];
    /** Retards, counted apart: a school acts on them by accumulation. */
    lateCount: number;
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

/** One row of a lesson's register. Mirrors `RegisterPupil` in `modules/classroom/queries.ts`. */
export type TeacherRegisterPupil = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  status: string | null;
  minutesLate: number | null;
  reason: string | null;
  isJustified: boolean;
  /** Unjustified absences this pupil already has this year, across all subjects. */
  absencesThisYear: number;
  latesThisYear: number;
};

/**
 * One lesson's register, as taken from the phone. Mirrors `Register` in
 * `modules/classroom/queries.ts`, plus `canMark` — added by the mobile route,
 * since the shared type has no notion of "for this caller".
 */
export type TeacherRegister = {
  schoolClassId: string;
  classCode: string;
  classGroupId: string | null;
  groupLabel: string | null;
  subjectId: string | null;
  subjectName: string | null;
  timeSlotId: string | null;
  slotLabel: string | null;
  date: string;
  pupils: TeacherRegisterPupil[];
  tally: {
    present: number;
    late: number;
    absent: number;
    excused: number;
    unmarked: number;
    total: number;
  };
  canMark: boolean;
};

/** One pupil the signed-in teacher may write a remark about. Mirrors `PupilOption`. */
export type PupilOption = {
  enrollmentId: string;
  label: string;
  classCode: string;
};

/** One period of the week, as a column of the grid. Mirrors `SlotColumn`. */
export type SlotColumn = {
  key: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
};

/** One lesson in the teacher's own grid. Mirrors `TeacherLesson`. */
export type TeacherLesson = {
  timetableEntryId: string;
  timeSlotId: string;
  schoolClassId: string;
  classCode: string;
  groupLabel: string | null;
  subjectName: string;
  subjectShort: string;
  colorHex: string | null;
  roomCode: string | null;
};

/**
 * The teacher's week. Mirrors `TeacherWeek` in modules/timetable/queries.ts.
 *
 * Not the child's `Timetable`: a class grid names the teacher in each cell, a
 * teacher's grid names the *class* — and an empty cell means a free period
 * rather than a period the school does not teach.
 */
export type TeacherWeek = {
  columns: SlotColumn[];
  /** Indexed by ISO day (1 = Monday), then by column key. Null = free period. */
  rows: { dayOfWeek: number; cells: Record<string, TeacherLesson | null> }[];
  scheduleKind: string;
  lessonCount: number;
  classCount: number;
};

// ── Devoirs et contrôles ─────────────────────────────────────────────────────

/** One paper in the teacher's list. Mirrors `AssessmentRow`. */
export type Assessment = {
  id: string;
  title: string;
  sequence: number;
  status: string;
  scheduledOn: string | null;
  maxScore: number;
  coefficient: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectColorHex: string | null;
  typeId: string;
  typeName: string;
  typeCode: string;
  typeColorHex: string | null;
  classId: string;
  classCode: string;
  groupLabel: string | null;
  termId: string;
  termName: string;
  teacherName: string | null;
  rosterCount: number;
  markedCount: number;
  absentCount: number;
  average: number | null;
};

/** One pupil's row on a mark sheet. Mirrors `MarkRow`. */
export type MarkRow = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  groupLabel: string | null;
  score: number | null;
  isAbsent: boolean;
  isExcused: boolean;
  comment: string | null;
};

/**
 * One rung of the school's appréciation scale. Mirrors `AppreciationBandRow`.
 *
 * `minPercentBps` is a share of the paper's own `maxScore` — 10000 is full
 * marks — so the same rung serves an oral out of 10 and a paper out of 20.
 */
export type AppreciationBand = {
  id: string;
  minPercentBps: number;
  label: string;
  labelAr: string | null;
  colorHex: string | null;
};

/** One numbered question of the paper, in points. Mirrors `PaperQuestion`. */
export type PaperQuestion = {
  id: string;
  position: number;
  text: string;
  points: number;
};

/**
 * A paper with its roster and whatever is entered. Mirrors `MarkSheet`.
 *
 * Absences are excluded from the average rather than counted as zero — see
 * `markStatistics`; the phone shows `absentCount` beside it so the exclusion
 * reads as deliberate.
 */
export type MarkSheet = {
  assessment: Assessment & { notes: string | null };
  rows: MarkRow[];
  statistics: {
    markedCount: number;
    absentCount: number;
    pendingCount: number;
    average: number | null;
    lowest: number | null;
    highest: number | null;
    passCount: number;
    passRate: number | null;
  };
  isMine: boolean;
  /** Nobody validates a devoir, so the hand-in pair is not offered on one. */
  isDevoir: boolean;
  questions: PaperQuestion[];
  questionsTotal: number;
  /**
   * The school's appréciation scale, highest floor first, so the phone can
   * suggest the remark as a mark is typed rather than after a round trip.
   */
  appreciationBands: AppreciationBand[];
};

/** A kind of paper the school lets a teacher set. Mirrors `AssessmentTypeOption`. */
export type AssessmentTypeOption = {
  id: string;
  code: string;
  name: string;
  defaultCoefficient: number;
  defaultMaxScore: number;
  countsTowardAverage: boolean;
  gradesWholeSubject: boolean;
  colorHex: string | null;
};

/** Mirrors `TermOption`. */
export type TermOption = {
  id: string;
  number: number;
  name: string;
  status: string;
};

/** One class-and-subject the teacher holds. Mirrors `TeachingSlot`. */
export type TeachingSlot = {
  assignmentId: string;
  schoolClassId: string;
  classCode: string;
  className: string | null;
  levelLabel: string;
  classGroupId: string | null;
  groupLabel: string | null;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectColorHex: string | null;
  rosterCount: number;
};

/** Everything the "set a piece of work" form offers, in one call. */
export type AssessmentOptions = {
  types: AssessmentTypeOption[];
  terms: TermOption[];
  teaching: TeachingSlot[];
};

// ── Le carnet, vu par son auteur ─────────────────────────────────────────────

/**
 * One remark this teacher wrote. Mirrors `RemarkRow`.
 *
 * `isVisibleToFamily` is the whole point of showing it: a note is internal
 * until the direction releases it, and the teacher should be able to see which
 * of theirs have been.
 */
export type MyRemark = {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  classCode: string;
  subjectName: string | null;
  kind: string;
  tone: string;
  body: string;
  occurredOn: string;
  isVisibleToFamily: boolean;
  authorName: string | null;
  isMine: boolean;
};

// ── Fournitures ──────────────────────────────────────────────────────────────

/**
 * One line of a demande. Mirrors `SupplyItemRow` in modules/supplies/queries.ts.
 *
 * Not `SupplyItem` above: that is the family's shopping list, which carries
 * only what a parent has to buy. This is the request as its author sees it,
 * before anybody has approved it.
 */
export type TeacherSupplyItem = {
  id: string;
  articleId: string | null;
  label: string;
  labelAr: string | null;
  quantity: number | null;
  notes: string | null;
  isRequired: boolean;
  position: number;
};

/**
 * A demande de fournitures. Mirrors `SupplyListRow`.
 *
 * `status` is DRAFT | SUBMITTED | APPROVED | REJECTED — see `SUPPLY_STATUSES`.
 * Only APPROVED is ever shown to a family, and `reviewNote` carries the reason
 * when the direction sends one back.
 */
export type TeacherSupplyList = {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  schoolClassId: string;
  className: string;
  levelLabel: string;
  subjectId: string | null;
  subjectName: string | null;
  authorId: string | null;
  authorName: string | null;
  reviewedByName: string | null;
  reviewedAt: string;
  reviewNote: string | null;
  itemCount: number;
  items: TeacherSupplyItem[];
};

/** One article of the school's catalogue. Mirrors `SupplyArticleChoice`. */
export type SupplyArticleChoice = {
  id: string;
  label: string;
  labelAr: string | null;
  category: string;
  defaultQuantity: number | null;
  notes: string | null;
};

/** Everything the fournitures request form offers, in one call. */
export type SupplyOptions = {
  articles: SupplyArticleChoice[];
  subjects: { id: string; label: string }[];
  teaching: TeachingSlot[];
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

/** One arrêt on the line. Mirrors `ItineraryStop`. */
export type ItineraryStop = {
  id: string;
  name: string;
  nameAr: string | null;
  landmark: string | null;
  neighbourhoodName: string | null;
  position: number;
  time: string | null;
  riderCount: number;
};

/**
 * Le trajet. Mirrors `RunItinerary`.
 *
 * Available before the départ, unlike the register: it names no child, and it
 * is what somebody reads *before* setting off. The stops arrive already in the
 * order the bus meets them — reversed for the journey home.
 */
export type RunItinerary = {
  routeCode: string;
  routeName: string;
  direction: string;
  stops: ItineraryStop[];
  totalRiders: number;
};

/**
 * One child on the bus, as the crew sees them. Mirrors `RunRider`.
 *
 * The guardians are here for the moment a child is not at the kerb — name,
 * relationship and telephone, and nothing else about the household.
 */
export type RunRider = {
  subscriptionId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string | null;
  levelName: string | null;
  photoUrl: string | null;
  stopName: string;
  landmark: string | null;
  time: string | null;
  status: string | null;
  minutesLate: number;
  reason: string | null;
  guardians: {
    name: string;
    relationship: string;
    phone: string | null;
    isPrimaryContact: boolean;
    /** Whether this adult may take the child off the bus. */
    canPickUp: boolean;
  }[];
};

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
 * One subject on an issued bulletin. Mirrors `PortalBulletinLine`.
 *
 * `average` is already on the bulletin's own scale — see `outOf` on the parent
 * — so nothing on the phone divides or normalises. Every figure here was frozen
 * when the school issued the document, which is what makes the screen and the
 * paper copy the same thing.
 */
export type BulletinLine = {
  subjectName: string;
  /** Indent it under the matière above: القراءة under اللغة العربية. */
  isComponent: boolean;
  coefficient: number;
  average: number | null;
  rank: number | null;
  classAverage: number | null;
  appreciation: string | null;
};

/**
 * One issued bulletin. Mirrors `PortalBulletin`.
 *
 * Only published ones ever reach the phone — the filter is in the query, and it
 * is the only thing between a class council's working copy and a parent.
 */
export type Bulletin = {
  id: string;
  termName: string;
  termNumber: number;
  className: string | null;
  generalAverage: number | null;
  /** The scale the marks above are on — the school's, at issue time. */
  outOf: number;
  rank: number | null;
  classSize: number;
  classAverage: number | null;
  mention: string | null;
  decision: string | null;
  councilComment: string | null;
  mainTeacherComment: string | null;
  absenceCount: number;
  unjustifiedAbsenceCount: number;
  lateCount: number;
  publishedAt: string | null;
  lines: BulletinLine[];
};

/** Mirrors `PortalBulletins`. */
export type Bulletins = {
  bulletins: Bulletin[];
  yearAverage: number | null;
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

/** One thing on a liste de fournitures. Mirrors `PortalSupplyItem`. */
export type SupplyItem = {
  id: string;
  label: string;
  labelAr: string | null;
  quantity: number | null;
  notes: string | null;
  isRequired: boolean;
};

/**
 * A class's liste de fournitures. Mirrors `PortalSupplyList`.
 *
 * Only approved lists reach this type — a draft or a rejected one is not a
 * shopping list, and the filter is in the query rather than here.
 */
export type SupplyList = {
  id: string;
  title: string;
  subjectName: string | null;
  notes: string | null;
  items: SupplyItem[];
  requiredCount: number;
};

// ── Les demandes de documents ────────────────────────────────────────────────

/** A paper this child's school will issue. Mirrors `PortalRequestType`. */
export type RequestType = {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  /** Null when the school promises no particular delay. */
  usualDelayDays: number | null;
  /** The office will not write this one without knowing what it is for. */
  requiresReason: boolean;
};

/**
 * One request this household has filed, and the school's answer to it.
 * Mirrors `PortalRequest`.
 *
 * `canCancel` comes from the server rather than being re-derived here, so the
 * button the parent sees and the move the server will accept cannot disagree.
 */
export type DocumentRequest = {
  id: string;
  studentId: string;
  studentName: string;
  typeName: string;
  typeNameAr: string | null;
  copies: number;
  reason: string | null;
  /** "PENDING" | "ACCEPTED" | "READY" | "COLLECTED" | "REJECTED" | "CANCELLED" */
  status: string;
  requestedAt: string;
  readyAt: string | null;
  collectedAt: string | null;
  /** The office's answer, in the words the school wrote for the family. */
  officeNote: string | null;
  canCancel: boolean;
};

// ── Les notifications ────────────────────────────────────────────────────────

/**
 * What a notification can be about. Mirrors `NOTIFICATION_KINDS` in
 * modules/notifications/enums.ts.
 *
 * A kind the phone has never heard of is dropped by the screen rather than
 * rendered blank — an app store update always lags a server deployment, so a
 * new kind reaching an old phone is the normal case and not a fault.
 */
export type NotificationKind =
  | "EVENT_PUBLISHED"
  | "REQUEST_HANDLED"
  | "MARKS_PUBLISHED"
  | "BULLETIN_PUBLISHED"
  | "REMARK_SHARED"
  | "PAYMENT_RECORDED"
  | "ASSESSMENT_SCHEDULED"
  | "ATTENDANCE_MISSED"
  | "TRANSPORT_MISSED"
  | "SUPPLY_LIST_APPROVED"
  | "REQUEST_FILED"
  | "ASSESSMENT_SUBMITTED"
  | "SUPPLY_LIST_SUBMITTED"
  | "ASSESSMENT_VALIDATED"
  | "SUPPLY_LIST_REVIEWED"
  | "LEAVE_DECIDED"
  | "ADVANCE_DECIDED";

/**
 * One line of the inbox. Mirrors `NotificationItem`.
 *
 * `params` and not a sentence, for the reason given on the `Notification`
 * model: the wording is this app's, in this reader's language, so a parent who
 * has set the app to Arabic reads Arabic whoever pressed publish.
 */
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  params: Record<string, string>;
  subjectId: string | null;
  studentId: string | null;
  tone: "info" | "good" | "warn";
  /** The web dashboard's route. Always null for the kinds a parent gets. */
  href: string | null;
  isRead: boolean;
  createdAt: string;
};

/** The inbox and its unread count in one answer. Mirrors `Inbox`. */
export type Inbox = {
  items: AppNotification[];
  unread: number;
};
