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
