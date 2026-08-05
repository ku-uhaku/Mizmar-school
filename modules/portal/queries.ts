import "server-only";

import { db } from "@/lib/db";
import { COUNTED_STATUSES } from "@/modules/assessments/enums";
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
 * Published marks only. A paper still being marked is not something a parent
 * should see — `COUNTED_STATUSES` is the same gate the staff screens use, so
 * the portal cannot leak a grade the school has not released.
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
      assessment: { status: { in: [...COUNTED_STATUSES] } },
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
