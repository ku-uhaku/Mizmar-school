import "server-only";

import { db } from "@/lib/db";
import { ensureChannel } from "@/modules/chat/service";
import { isSettled } from "@/modules/documents/enums";
import { VISIBLE_EVENT_STATUSES } from "@/modules/events/enums";
import { FAMILY_VISIBLE_STATUSES } from "@/modules/assessments/enums";
import { MISSING_STATUSES } from "@/modules/classroom/enums";
import { SEAT_HOLDING_STATUSES } from "@/modules/transport/enums";

/**
 * The parent portal read model.
 *
 * Every other module scopes its reads by what the signed-in user may reach
 * through their memberships and permissions. A parent has neither: a Guardian
 * is a row in the dossier familial, not a member of staff, and giving them a
 * membership would make them visible to — and able to see — the school's whole
 * roster. So this module scopes on a different axis entirely: **the household**.
 * Nothing here is reachable unless the row hangs off a family the signed-in
 * user is a guardian of, which is why these functions take a user id and build
 * their own `where` rather than accepting an `AuthContext`.
 *
 * That also explains why it does not call the staff modules' `queries.ts`: those
 * scope by school membership and would return nothing for a parent. The rule
 * they exist to enforce — a read scopes itself, once, in one place — is kept
 * here by `householdScope`, which every query in this file goes through.
 */

/**
 * The one `where` fragment this module trusts. An id from the request is only
 * ever *combined* with it, never used alone, so a crafted student id resolves
 * to nothing unless the caller is genuinely that child's guardian.
 */
function householdScope(userId: string) {
  return {
    family: {
      guardians: { some: { userId, isActive: true } },
    },
  } as const;
}

export type PortalChild = {
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

/**
 * The children this user is answerable for, each with the enrolment that is
 * current for them. "Current" is the most recent year the child is enrolled in
 * rather than the school's active year: a family whose child left last June
 * should still see last year's record, not an empty screen.
 */
export async function listMyChildren(userId: string): Promise<PortalChild[]> {
  const students = await db.student.findMany({
    where: { ...householdScope(userId), isActive: true },
    orderBy: [{ birthDate: "asc" }],
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      status: true,
      school: { select: { name: true } },
      enrollments: {
        orderBy: [{ schoolYear: { startDate: "desc" } }],
        take: 1,
        select: {
          id: true,
          schoolYear: { select: { name: true } },
          levelOffering: { select: { level: { select: { name: true } } } },
          schoolClass: { select: { name: true } },
          classGroup: { select: { name: true } },
        },
      },
    },
  });

  return students.map((student) => {
    const enrolment = student.enrollments[0] ?? null;

    return {
      studentId: student.id,
      enrollmentId: enrolment?.id ?? null,
      code: student.code,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      photoUrl: student.photoUrl,
      status: student.status,
      schoolName: student.school.name,
      schoolYearName: enrolment?.schoolYear.name ?? null,
      levelName: enrolment?.levelOffering.level.name ?? null,
      className: enrolment?.schoolClass?.name ?? null,
      groupName: enrolment?.classGroup?.name ?? null,
    };
  });
}

/**
 * Resolves a child id from the request to the enrolment the portal may read,
 * or null when this user is not that child's guardian. Every per-child query
 * below starts here — it is the single point where an id from a phone is
 * checked against the household.
 */
async function resolveChild(userId: string, studentId: string) {
  return db.enrollment.findFirst({
    where: { studentId, student: householdScope(userId) },
    orderBy: [{ schoolYear: { startDate: "desc" } }],
    select: {
      id: true,
      studentId: true,
      schoolYearId: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });
}

export type PortalMark = {
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

export type PortalMarks = {
  marks: PortalMark[];
  /** Unweighted mean over marked papers, normalised to /20, or null. */
  averageOutOf20: number | null;
};

/**
 * Validated marks only.
 *
 * This used to gate on `COUNTED_STATUSES` and claim, in this comment, that the
 * portal therefore could not leak a grade the school had not released. It was
 * not true: that list includes PUBLISHED, which is the status a paper takes the
 * moment the office opens it for mark entry — so a family read each mark as its
 * teacher typed it, and every correction made before validation looked like a
 * grade that had changed. `FAMILY_VISIBLE_STATUSES` is the gate that actually
 * says what it means; see the note on it.
 */
export async function loadChildMarks(
  userId: string,
  studentId: string,
): Promise<PortalMarks> {
  const child = await resolveChild(userId, studentId);
  if (!child) return { marks: [], averageOutOf20: null };

  const grades = await db.assessmentGrade.findMany({
    where: {
      enrollmentId: child.id,
      assessment: { status: { in: [...FAMILY_VISIBLE_STATUSES] } },
    },
    orderBy: [{ assessment: { scheduledOn: "desc" } }],
    take: 60,
    select: {
      id: true,
      score: true,
      isAbsent: true,
      comment: true,
      assessment: {
        select: {
          title: true,
          scheduledOn: true,
          maxScore: true,
          subject: { select: { name: true } },
          assessmentType: { select: { name: true } },
          term: { select: { name: true } },
        },
      },
    },
  });

  const marks: PortalMark[] = grades.map((grade) => ({
    id: grade.id,
    subjectName: grade.assessment.subject.name,
    title: grade.assessment.title,
    typeName: grade.assessment.assessmentType.name,
    termName: grade.assessment.term.name,
    scheduledOn: grade.assessment.scheduledOn?.toISOString() ?? null,
    score: grade.score,
    maxScore: grade.assessment.maxScore,
    isAbsent: grade.isAbsent,
    comment: grade.comment,
  }));

  // Normalised before averaging: a paper marked out of 10 and one out of 20 are
  // not comparable numbers, and a mean of the raw scores would be meaningless.
  const scored = marks.filter(
    (mark) => mark.score !== null && !mark.isAbsent && mark.maxScore > 0,
  );

  const averageOutOf20 = scored.length
    ? Number(
        (
          scored.reduce(
            (total, mark) => total + (mark.score! / mark.maxScore) * 20,
            0,
          ) / scored.length
        ).toFixed(2),
      )
    : null;

  return { marks, averageOutOf20 };
}

export type PortalAbsence = {
  id: string;
  date: string;
  status: string;
  minutesLate: number | null;
  isJustified: boolean;
  reason: string | null;
  subjectName: string | null;
};

export type PortalAttendance = {
  entries: PortalAbsence[];
  missedCount: number;
  unjustifiedCount: number;
};

/** Absences and lates, most recent first. Presents are not worth sending. */
export async function loadChildAttendance(
  userId: string,
  studentId: string,
): Promise<PortalAttendance> {
  const child = await resolveChild(userId, studentId);
  if (!child) return { entries: [], missedCount: 0, unjustifiedCount: 0 };

  const marks = await db.studentAttendance.findMany({
    where: {
      enrollmentId: child.id,
      status: { not: "PRESENT" },
    },
    orderBy: [{ date: "desc" }],
    take: 60,
    select: {
      id: true,
      date: true,
      status: true,
      minutesLate: true,
      isJustified: true,
      reason: true,
      subject: { select: { name: true } },
    },
  });

  const entries: PortalAbsence[] = marks.map((mark) => ({
    id: mark.id,
    date: mark.date.toISOString(),
    status: mark.status,
    minutesLate: mark.minutesLate,
    isJustified: mark.isJustified,
    reason: mark.reason,
    subjectName: mark.subject?.name ?? null,
  }));

  const missed = entries.filter((entry) =>
    (MISSING_STATUSES as readonly string[]).includes(entry.status),
  );

  return {
    entries,
    missedCount: missed.length,
    unjustifiedCount: missed.filter((entry) => !entry.isJustified).length,
  };
}

export type PortalFeeLine = {
  id: string;
  label: string;
  dueDate: string;
  amountCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
  isOverdue: boolean;
};

export type PortalFees = {
  chargedCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
  overdueCentimes: number;
  isUpToDate: boolean;
  lines: PortalFeeLine[];
};

/**
 * What the household owes on this child, instalment by instalment. Cancelled
 * and waived lines are excluded — a parent should see what is payable, not the
 * school's accounting trail — which is why this filters on DUE rather than
 * totalling every row.
 */
export async function loadChildFees(
  userId: string,
  studentId: string,
): Promise<PortalFees> {
  const child = await resolveChild(userId, studentId);

  const empty: PortalFees = {
    chargedCentimes: 0,
    paidCentimes: 0,
    outstandingCentimes: 0,
    overdueCentimes: 0,
    isUpToDate: true,
    lines: [],
  };

  if (!child) return empty;

  const lines = await db.enrollmentFee.findMany({
    where: { enrollmentId: child.id, status: "DUE" },
    orderBy: [{ dueDate: "asc" }],
    select: {
      id: true,
      dueDate: true,
      amountCentimes: true,
      periodIndex: true,
      feeType: { select: { name: true } },
      allocations: {
        // Only money that still counts. Without this a cancelled receipt — a
        // bounced cheque, most of all — went on reading as paid in the family's
        // app while every screen in the office said otherwise, and the phone is
        // the version a parent argues from.
        where: { payment: { status: "POSTED" } },
        select: { amountCentimes: true },
      },
    },
  });

  const now = new Date();
  let charged = 0;
  let paid = 0;
  let overdue = 0;

  const rows: PortalFeeLine[] = lines.map((line) => {
    const linePaid = line.allocations.reduce(
      (total, allocation) => total + allocation.amountCentimes,
      0,
    );
    const outstanding = Math.max(0, line.amountCentimes - linePaid);
    const isOverdue = outstanding > 0 && line.dueDate < now;

    charged += line.amountCentimes;
    paid += linePaid;
    if (isOverdue) overdue += outstanding;

    return {
      id: line.id,
      label: line.feeType.name,
      dueDate: line.dueDate.toISOString(),
      amountCentimes: line.amountCentimes,
      paidCentimes: linePaid,
      outstandingCentimes: outstanding,
      isOverdue,
    };
  });

  return {
    chargedCentimes: charged,
    paidCentimes: paid,
    outstandingCentimes: Math.max(0, charged - paid),
    overdueCentimes: overdue,
    isUpToDate: overdue === 0,
    lines: rows,
  };
}

export type PortalTransport = {
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

/**
 * The child's bus, if they have one. The driver's name and number are here on
 * purpose: it is the single thing a parent most often needs at 07:40, and the
 * school already prints it on the ramassage sheet.
 */
export async function loadChildTransport(
  userId: string,
  studentId: string,
): Promise<PortalTransport> {
  const child = await resolveChild(userId, studentId);
  if (!child) return null;

  const subscription = await db.transportSubscription.findFirst({
    where: {
      enrollmentId: child.id,
      status: { in: [...SEAT_HOLDING_STATUSES] },
    },
    select: {
      direction: true,
      status: true,
      stop: { select: { name: true } },
      schedule: { select: { departureTime: true, direction: true } },
      route: {
        select: {
          name: true,
          vehicle: {
            select: {
              registration: true,
              driverName: true,
              driverPhone: true,
              driver: {
                select: { firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      },
    },
  });

  if (!subscription) return null;

  const vehicle = subscription.route.vehicle;
  // The payroll record wins over the free-text column when both exist — a
  // contractor bus carries only the text, an employee carries only the row.
  const employedDriver = vehicle?.driver;

  return {
    routeName: subscription.route.name,
    stopName: subscription.stop.name,
    direction: subscription.direction,
    status: subscription.status,
    vehiclePlate: vehicle?.registration ?? null,
    driverName: employedDriver
      ? `${employedDriver.firstName} ${employedDriver.lastName}`
      : (vehicle?.driverName ?? null),
    driverPhone: employedDriver?.phone ?? vehicle?.driverPhone ?? null,
    morningTime:
      subscription.schedule?.direction === "MORNING"
        ? subscription.schedule.departureTime
        : null,
    afternoonTime:
      subscription.schedule?.direction === "AFTERNOON"
        ? subscription.schedule.departureTime
        : null,
  };
}

export type PortalChildDetail = {
  child: PortalChild;
  marks: PortalMarks;
  attendance: PortalAttendance;
  fees: PortalFees;
  transport: PortalTransport;
};

/** Everything one child's screen shows, in a single round trip. */
export async function loadChildDetail(
  userId: string,
  studentId: string,
): Promise<PortalChildDetail | null> {
  const children = await listMyChildren(userId);
  const child = children.find((row) => row.studentId === studentId);
  if (!child) return null;

  const [marks, attendance, fees, transport] = await Promise.all([
    loadChildMarks(userId, studentId),
    loadChildAttendance(userId, studentId),
    loadChildFees(userId, studentId),
    loadChildTransport(userId, studentId),
  ]);

  return { child, marks, attendance, fees, transport };
}

/** True when this account is a guardian on at least one active dossier. */
export async function isGuardian(userId: string): Promise<boolean> {
  const count = await db.guardian.count({
    where: { userId, isActive: true },
  });
  return count > 0;
}

// ── Événements ───────────────────────────────────────────────────────────────

export type PortalEvent = {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  kind: string;
  /** PUBLISHED or CANCELLED — a called-off event stays on the list saying so. */
  status: string;
  /** ISO. The phone formats it, and reads `isAllDay` to decide about the time. */
  startsAt: string;
  endsAt: string | null;
  isAllDay: boolean;
  location: string | null;
};

/**
 * What this household has been told about.
 *
 * ── The three filters, and why each one is load-bearing ──────────────────────
 * A parent holds no membership and no permission, so this scopes on the
 * household exactly as every other read in this file does — see `householdScope`.
 * On top of that:
 *
 *   1. `status` is one of the visible ones. A draft is invisible to a phone
 *      however the request is crafted; that is the only gate publishing has.
 *   2. The event belongs to a school year one of their children is enrolled in,
 *      so a family cannot read another school's calendar.
 *   3. School-wide events reach everyone; a targeted one reaches a household
 *      only if one of their children sits in a named class or is admitted to a
 *      named level. This is the join `EventAudience` exists for.
 *
 * Past events are kept — a parent looking for "when was the réunion?" is asking
 * a reasonable question — but the soonest come first and the caller may cut the
 * list.
 */
export async function listMyEvents(
  userId: string,
  { limit = 50 }: { limit?: number } = {},
): Promise<PortalEvent[]> {
  // The years and the places this household actually occupies. Read first so
  // the event query is a plain `in`, rather than a correlated subquery SQLite
  // would have to re-run per row.
  const enrolments = await db.enrollment.findMany({
    where: { student: householdScope(userId) },
    /*
      The level arrives through the offering, which is where an enrolment
      actually names it — `Enrollment.levelOfferingId` is the level *as opened
      this year*, and `EventAudience.levelId` is the level itself. Joining the
      two here is what lets a school announce to "3AP" without having to name
      each filière's offering separately.
    */
    select: {
      schoolYearId: true,
      schoolClassId: true,
      levelOffering: { select: { levelId: true } },
    },
  });

  if (enrolments.length === 0) return [];

  const yearIds = [...new Set(enrolments.map((row) => row.schoolYearId))];
  const classIds = [
    ...new Set(
      enrolments
        .map((row) => row.schoolClassId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const levelIds = [
    ...new Set(enrolments.map((row) => row.levelOffering.levelId)),
  ];

  const events = await db.event.findMany({
    where: {
      schoolYearId: { in: yearIds },
      status: { in: [...VISIBLE_EVENT_STATUSES] },
      OR: [
        { isSchoolWide: true },
        { audiences: { some: { schoolClassId: { in: classIds } } } },
        { audiences: { some: { levelId: { in: levelIds } } } },
      ],
    },
    orderBy: [{ startsAt: "asc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      titleAr: true,
      description: true,
      kind: true,
      status: true,
      startsAt: true,
      endsAt: true,
      isAllDay: true,
      location: true,
    },
  });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    titleAr: event.titleAr,
    description: event.description,
    kind: event.kind,
    status: event.status,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    isAllDay: event.isAllDay,
    location: event.location,
  }));
}

// ── Le carnet de liaison ─────────────────────────────────────────────────────

export type PortalRemark = {
  id: string;
  kind: string;
  tone: string;
  body: string;
  /** ISO. */
  occurredOn: string;
  subjectName: string | null;
  authorName: string | null;
};

/**
 * What this child's teachers have written that the family is meant to read.
 *
 * ── The one filter that matters ─────────────────────────────────────────────
 * `isVisibleToFamily` is false by default on `StudentRemark`, and deliberately
 * so: a teacher writes the carnet for the class council first, and decides
 * separately that a given line is one to say out loud. The staff screen shows
 * the whole carnet because the reader there is the office; this shows only what
 * was released, and that flag is the only thing standing between a private note
 * and a parent's phone. It is not a display preference.
 */
export async function loadChildRemarks(
  userId: string,
  studentId: string,
): Promise<PortalRemark[]> {
  const child = await resolveChild(userId, studentId);
  if (!child) return [];

  const remarks = await db.studentRemark.findMany({
    where: { enrollmentId: child.id, isVisibleToFamily: true },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: 40,
    select: {
      id: true,
      kind: true,
      tone: true,
      body: true,
      occurredOn: true,
      subject: { select: { name: true } },
      author: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return remarks.map((remark) => ({
    id: remark.id,
    kind: remark.kind,
    tone: remark.tone,
    body: remark.body,
    occurredOn: remark.occurredOn.toISOString(),
    subjectName: remark.subject?.name ?? null,
    authorName: remark.author
      ? (remark.author.profile
          ? `${remark.author.profile.firstName} ${remark.author.profile.lastName}`.trim()
          : "") || remark.author.email
      : null,
  }));
}

// ── L'emploi du temps ────────────────────────────────────────────────────────

export type PortalLesson = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName: string | null;
  roomName: string | null;
};

/**
 * The child's week, as a flat list of lessons.
 *
 * Flat rather than the staff screen's grid: `TimetableGrid` is columns-by-rows
 * because a desktop draws a table, and a phone reads a day at a time. Shaping it
 * here rather than on the device keeps the hand-mirrored DTO simple and means
 * the app never has to know what a slot column is.
 *
 * Empty when the child has no class yet — a pupil admitted but not yet seated
 * has no timetable, which is a real state and not an error.
 */
export async function loadChildTimetable(
  userId: string,
  studentId: string,
): Promise<PortalLesson[]> {
  const child = await resolveChild(userId, studentId);
  if (!child) return [];

  const enrolment = await db.enrollment.findFirst({
    where: { id: child.id },
    select: { schoolClassId: true },
  });
  if (!enrolment?.schoolClassId) return [];

  const entries = await db.timetableEntry.findMany({
    where: {
      schoolClassId: enrolment.schoolClassId,
      timeSlot: { scheduleKind: "STANDARD" },
    },
    orderBy: [{ timeSlot: { dayOfWeek: "asc" } }, { timeSlot: { startTime: "asc" } }],
    select: {
      timeSlot: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
      subject: { select: { name: true } },
      room: { select: { name: true } },
      teacher: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return entries.map((entry) => ({
    dayOfWeek: entry.timeSlot.dayOfWeek,
    startTime: entry.timeSlot.startTime,
    endTime: entry.timeSlot.endTime,
    subjectName: entry.subject.name,
    teacherName: entry.teacher
      ? (entry.teacher.profile
          ? `${entry.teacher.profile.firstName} ${entry.teacher.profile.lastName}`.trim()
          : "") || entry.teacher.email
      : null,
    roomName: entry.room?.name ?? null,
  }));
}

// ── Le dossier ───────────────────────────────────────────────────────────────

export type PortalDossierPiece = {
  code: string;
  name: string;
  isRequired: boolean;
  /** RECEIVED or EXEMPTED — see `isSettled`. */
  isSettled: boolean;
  status: string;
  /** ISO, when the school recorded receiving it. */
  receivedOn: string | null;
};

export type PortalDossier = {
  pieces: PortalDossierPiece[];
  requiredCount: number;
  providedCount: number;
  isComplete: boolean;
};

/**
 * What the school still needs from this family, and what it already has.
 *
 * The catalogue leads and the recorded rows join onto it — the same way round
 * as the staff screen, and for the same reason: a pièce the school starts
 * asking for on Monday appears on every dossier on Tuesday without touching a
 * single row. See `loadStudentDossier` in modules/documents/queries.ts.
 *
 * This is the one screen in the parent space that exists to produce an action:
 * the point is the missing acte de naissance, so completeness is computed here
 * rather than left for the phone to count.
 */
export async function loadChildDossier(
  userId: string,
  studentId: string,
): Promise<PortalDossier> {
  const empty: PortalDossier = {
    pieces: [],
    requiredCount: 0,
    providedCount: 0,
    isComplete: true,
  };

  const child = await resolveChild(userId, studentId);
  if (!child) return empty;

  const student = await db.student.findFirst({
    where: { id: studentId },
    select: { schoolId: true },
  });
  if (!student) return empty;

  const [catalogue, recorded] = await Promise.all([
    db.documentType.findMany({
      where: { schoolId: student.schoolId, isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, isRequired: true },
    }),
    db.studentDocument.findMany({
      where: { studentId },
      select: { documentTypeId: true, status: true, receivedOn: true },
    }),
  ]);

  const byType = new Map(recorded.map((row) => [row.documentTypeId, row]));

  const pieces = catalogue.map((type) => {
    const row = byType.get(type.id);
    // No row at all is MISSING, not an error: a pupil nobody has recorded
    // anything for is missing everything, which is the state a new dossier
    // starts in. See the note on DOCUMENT_STATUSES.
    const status = row?.status ?? "MISSING";
    return {
      code: type.code,
      name: type.name,
      isRequired: type.isRequired,
      isSettled: isSettled(status),
      status,
      receivedOn: row?.receivedOn?.toISOString() ?? null,
    };
  });

  const required = pieces.filter((piece) => piece.isRequired);

  return {
    pieces,
    requiredCount: required.length,
    providedCount: required.filter((piece) => piece.isSettled).length,
    isComplete: required.every((piece) => piece.isSettled),
  };
}

// ── L'espace parents ─────────────────────────────────────────────────────────

export type PortalChannel = {
  id: string;
  kind: string;
  /** What the phone shows as the channel's name. */
  label: string;
  isArchived: boolean;
  messageCount: number;
  lastMessageAt: string | null;
};

/**
 * The conversations this household may open.
 *
 * ── Three gates, and the switches are the first ─────────────────────────────
 * 1. The school's own settings. `parentChatEnabled` and `parentClassChatEnabled`
 *    are the manager's decision and they are checked *here*, not on the phone:
 *    a client that ignored them would otherwise read a channel the school had
 *    turned off. A school with both off gets an empty list and no way round it.
 * 2. The household. Channels come from the child's own school and class, so a
 *    parent sees their children's classes and nobody else's.
 * 3. The year. Last year's conversation stops appearing when this year's
 *    classes are drawn up.
 *
 * Channels are created on demand — see `ensureChannel` — so a school that has
 * just switched the feature on shows the right list before anybody has posted.
 */
export async function listMyChannels(userId: string): Promise<PortalChannel[]> {
  const enrolments = await db.enrollment.findMany({
    where: { student: householdScope(userId) },
    select: {
      schoolYearId: true,
      schoolClassId: true,
      schoolClass: { select: { id: true, name: true, code: true } },
      student: { select: { schoolId: true } },
    },
  });
  if (enrolments.length === 0) return [];

  const schoolIds = [...new Set(enrolments.map((row) => row.student.schoolId))];

  const settings = await db.schoolSettings.findMany({
    where: { schoolId: { in: schoolIds } },
    select: {
      schoolId: true,
      parentChatEnabled: true,
      parentClassChatEnabled: true,
    },
  });
  const settingFor = new Map(settings.map((row) => [row.schoolId, row]));

  const wanted: { schoolId: string; schoolYearId: string; classId: string | null }[] =
    [];

  for (const enrolment of enrolments) {
    const schoolId = enrolment.student.schoolId;
    // No settings row means every switch is at its default, and both default
    // to off — see the note on the columns.
    const setting = settingFor.get(schoolId);
    if (!setting) continue;

    if (setting.parentChatEnabled) {
      wanted.push({ schoolId, schoolYearId: enrolment.schoolYearId, classId: null });
    }
    if (setting.parentClassChatEnabled && enrolment.schoolClassId) {
      wanted.push({
        schoolId,
        schoolYearId: enrolment.schoolYearId,
        classId: enrolment.schoolClassId,
      });
    }
  }

  if (wanted.length === 0) return [];

  // Two children in the same class share one channel.
  const unique = [
    ...new Map(
      wanted.map((row) => [`${row.schoolYearId}:${row.classId ?? ""}`, row]),
    ).values(),
  ];

  /*
    ── Why a read creates rows ─────────────────────────────────────────────────
    Channels come into being the first time somebody opens one — a school with
    24 classes does not want 25 empty rows the moment a switch is flicked, and a
    class created in November would miss any provisioning pass. So the list has
    to make what it is about to list.

    It happens *here*, inside the same function that decides which channels this
    household may see, and not in the route: the two gates would otherwise be
    two copies of the settings-and-enrolment logic above, and a divergence
    between "which channels get made" and "which channels get shown" is a parent
    reading a conversation the school did not open. `ensureChannel` is
    idempotent, so the ordinary case — the rows already exist — is one extra
    indexed read apiece.
  */
  await Promise.all(
    unique.map((row) =>
      ensureChannel({
        schoolId: row.schoolId,
        schoolYearId: row.schoolYearId,
        kind: row.classId ? "CLASS" : "GENERAL",
        schoolClassId: row.classId,
      }),
    ),
  );

  const channels = await db.chatChannel.findMany({
    where: {
      OR: unique.map((row) => ({
        schoolYearId: row.schoolYearId,
        schoolClassId: row.classId,
      })),
    },
    select: {
      id: true,
      kind: true,
      isArchived: true,
      schoolClass: { select: { name: true, code: true } },
      _count: { select: { messages: { where: { deletedAt: null } } } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return channels
    .map((channel) => ({
      id: channel.id,
      kind: channel.kind,
      label: channel.schoolClass
        ? `Parents de ${channel.schoolClass.name || channel.schoolClass.code}`
        : "Tous les parents",
      isArchived: channel.isArchived,
      messageCount: channel._count.messages,
      lastMessageAt: channel.messages[0]?.createdAt.toISOString() ?? null,
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
}

export type PortalMessage = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  /** True when this account wrote it, so the phone can align it right. */
  isMine: boolean;
};

/**
 * One channel's messages, for a parent.
 *
 * Removed messages are absent, not marked: the moderation screen shows a school
 * what it took down, and a parent seeing "message removed" where an argument
 * used to be is an invitation to ask what it said.
 *
 * The channel is re-checked against this household's own list rather than
 * trusted from the request — a channel id is guessable, and without this a
 * parent could read another class's conversation by changing one segment of a
 * URL.
 */
export async function loadChannelMessages(
  userId: string,
  channelId: string,
  { limit = 100 }: { limit?: number } = {},
): Promise<PortalMessage[] | null> {
  const mine = await listMyChannels(userId);
  if (!mine.some((channel) => channel.id === channelId)) return null;

  const messages = await db.chatMessage.findMany({
    where: { channelId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorId: true,
      author: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    authorName: message.author.profile
      ? `${message.author.profile.firstName} ${message.author.profile.lastName}`.trim() ||
        message.author.email
      : message.author.email,
    createdAt: message.createdAt.toISOString(),
    isMine: message.authorId === userId,
  }));
}

/** Whether this account may post into that channel — the same gate as reading. */
export async function canPostToChannel(
  userId: string,
  channelId: string,
): Promise<boolean> {
  const mine = await listMyChannels(userId);
  const channel = mine.find((row) => row.id === channelId);
  return Boolean(channel && !channel.isArchived);
}
