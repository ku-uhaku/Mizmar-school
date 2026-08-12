import "server-only";

import { db } from "@/lib/db";
import { ensureChannel } from "@/modules/chat/service";
import {
  DEFAULT_SETTINGS,
  passMarkOf,
  settingsOf,
  teachingDaysOf,
} from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { firstLookSince, isSeenTopic } from "@/modules/portal/enums";
import { isSettled } from "@/modules/documents/enums";
import { VISIBLE_EVENT_STATUSES } from "@/modules/events/enums";
import { FAMILY_VISIBLE_STATUSES } from "@/modules/assessments/enums";
// Aliased: this file already reads the assessments module's list of the same
// name, and the two answer different questions about different tables.
import {
  FAMILY_VISIBLE_STATUSES as BULLETIN_VISIBLE_STATUSES,
  yearAverageOf,
} from "@/modules/bulletins/enums";
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
      // `schoolId` so a per-child read can reach that school's own policies.
      // The portal has no `AuthContext` to carry them — see `loadChildMarks`.
      student: {
        select: { firstName: true, lastName: true, schoolId: true },
      },
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
  /**
   * Unweighted mean over marked papers, normalised onto `outOf`, or null.
   *
   * Paired with its scale rather than named for one, exactly as the bulletin is
   * — see `outOf` on PortalBulletin. This was `averageOutOf20`, and the twenty
   * was not a description but an assumption: it divided by each paper's own
   * maxScore and multiplied by a literal 20, so a school marking out of 100 —
   * which `SchoolSettings.gradingMaxScore` exists to allow — told its parents a
   * child had 14.5 while every screen the school itself used said 72.5. Nobody
   * can reconcile those two numbers over a telephone.
   */
  average: number | null;
  /** The school's own scale, from `SchoolSettings.gradingMaxScore`. */
  outOf: number;
  /**
   * The pass mark on that same scale, so the phone can colour an average
   * without deciding for itself where passing starts. Half of `outOf` is only
   * the default: `passMarkBps` exists because a school may set it elsewhere.
   */
  passMark: number;
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
  // Not this household's child: the default scale rather than a lookup, because
  // reading a school's settings here would answer a question the caller has not
  // earned the right to ask. There are no marks to put on a scale anyway.
  if (!child) {
    return {
      marks: [],
      average: null,
      outOf: DEFAULT_SETTINGS.gradingMaxScore,
      passMark: passMarkOf(DEFAULT_SETTINGS),
    };
  }

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
  // The scale normalised *onto* is the school's own, not a literal twenty.
  const settings = await loadSchoolSettings(child.student.schoolId);
  const outOf = settings.gradingMaxScore;

  const scored = marks.filter(
    (mark) => mark.score !== null && !mark.isAbsent && mark.maxScore > 0,
  );

  const average = scored.length
    ? Number(
        (
          scored.reduce(
            (total, mark) => total + (mark.score! / mark.maxScore) * outOf,
            0,
          ) / scored.length
        ).toFixed(2),
      )
    : null;

  return { marks, average, outOf, passMark: passMarkOf(settings) };
}

export type PortalBulletinLine = {
  subjectName: string;
  /** Set on a component, so the phone can indent it under its matière. */
  isComponent: boolean;
  coefficient: number;
  average: number | null;
  rank: number | null;
  classAverage: number | null;
  appreciation: string | null;
};

export type PortalBulletin = {
  id: string;
  termName: string;
  termNumber: number;
  className: string | null;
  generalAverage: number | null;
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
  lines: PortalBulletinLine[];
};

export type PortalBulletins = {
  bulletins: PortalBulletin[];
  /** The mean of the terms issued so far. See `yearAverageOf`. */
  yearAverage: number | null;
};

/**
 * The bulletins a family may read: the issued ones, and only those.
 *
 * ── Why this does not go through the bulletins module's own queries ─────────
 * Those scope on `AuthContext` — the school in a member of staff's working
 * context — and a guardian has none. This is the same split the whole file
 * turns on: the household is the axis, `resolveChild` is the gate, and a
 * student id from a phone reaches nothing unless the caller is that child's
 * guardian.
 *
 * What is *not* re-derived here is the content. Every figure comes straight off
 * the frozen row, so the bulletin a parent reads on their phone is the document
 * the school issued — the same one that came out of the printer, down to the
 * rank. That is the entire reason those figures are stored.
 */
export async function loadChildBulletins(
  userId: string,
  studentId: string,
): Promise<PortalBulletins> {
  const child = await resolveChild(userId, studentId);
  if (!child) return { bulletins: [], yearAverage: null };

  const rows = await db.bulletin.findMany({
    where: {
      enrollmentId: child.id,
      status: { in: [...BULLETIN_VISIBLE_STATUSES] },
    },
    orderBy: [{ term: { number: "asc" } }],
    select: {
      id: true,
      generalAverage: true,
      outOf: true,
      rank: true,
      classSize: true,
      classAverage: true,
      mention: true,
      decision: true,
      councilComment: true,
      mainTeacherComment: true,
      absenceCount: true,
      unjustifiedAbsenceCount: true,
      lateCount: true,
      publishedAt: true,
      term: { select: { name: true, number: true } },
      schoolClass: { select: { code: true, name: true } },
      lines: {
        orderBy: { position: "asc" },
        select: {
          subjectName: true,
          parentSubjectId: true,
          coefficient: true,
          average: true,
          rank: true,
          classAverage: true,
          appreciation: true,
        },
      },
    },
  });

  const bulletins: PortalBulletin[] = rows.map((row) => ({
    id: row.id,
    termName: row.term.name,
    termNumber: row.term.number,
    className: row.schoolClass?.name ?? row.schoolClass?.code ?? null,
    generalAverage: row.generalAverage,
    outOf: row.outOf,
    rank: row.rank,
    classSize: row.classSize,
    classAverage: row.classAverage,
    mention: row.mention,
    decision: row.decision,
    councilComment: row.councilComment,
    mainTeacherComment: row.mainTeacherComment,
    absenceCount: row.absenceCount,
    unjustifiedAbsenceCount: row.unjustifiedAbsenceCount,
    lateCount: row.lateCount,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    lines: row.lines.map((line) => ({
      subjectName: line.subjectName,
      isComponent: line.parentSubjectId !== null,
      coefficient: line.coefficient,
      average: line.average,
      rank: line.rank,
      classAverage: line.classAverage,
      appreciation: line.appreciation,
    })),
  }));

  return { bulletins, yearAverage: yearAverageOf(bulletins) };
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
  /** Retards. Counted apart because a school acts on them by accumulation. */
  lateCount: number;
  missedCount: number;
  unjustifiedCount: number;
};

/** Absences and lates, most recent first. Presents are not worth sending. */
export async function loadChildAttendance(
  userId: string,
  studentId: string,
): Promise<PortalAttendance> {
  const child = await resolveChild(userId, studentId);
  if (!child)
    return { entries: [], lateCount: 0, missedCount: 0, unjustifiedCount: 0 };

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
    lateCount: entries.filter((entry) => entry.status === "LATE").length,
    missedCount: missed.length,
    unjustifiedCount: missed.filter((entry) => !entry.isJustified).length,
  };
}

export type PortalFeeLine = {
  id: string;
  label: string;
  /**
   * `YYYY-MM` of the due date — what the phone groups by.
   *
   * Derived here rather than sliced off `dueDate` on the device: the ISO string
   * is UTC and a due date stored at local midnight in a positive offset lands
   * on the previous day, which would file January's instalment under December.
   */
  month: string;
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
      // Local, not sliced off the ISO string — see the note on the field.
      month: `${line.dueDate.getFullYear()}-${String(
        line.dueDate.getMonth() + 1,
      ).padStart(2, "0")}`,
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
  /** The short form, for a cell too narrow for "Sciences de la vie". */
  subjectShort: string;
  /** The subject's own colour, so the phone's grid reads like the school's. */
  colorHex: string | null;
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
 *
 * The days themselves are *not* filtered to the ones with lessons: the phone
 * draws the school's whole teaching week, so a Wednesday with nothing on it
 * reads as a free day rather than as a day that does not exist. Which days
 * those are is `SchoolSettings.teachingDays`, and it travels with the lessons —
 * see `PortalTimetable`.
 */
export type PortalTimetable = {
  /** ISO weekday numbers the school teaches on, in order. */
  teachingDays: number[];
  lessons: PortalLesson[];
};

export async function loadChildTimetable(
  userId: string,
  studentId: string,
): Promise<PortalTimetable> {
  const empty: PortalTimetable = { teachingDays: [], lessons: [] };

  const child = await resolveChild(userId, studentId);
  if (!child) return empty;

  const enrolment = await db.enrollment.findFirst({
    where: { id: child.id },
    select: { schoolClassId: true, student: { select: { schoolId: true } } },
  });
  if (!enrolment?.schoolClassId) return empty;

  const settings = await db.schoolSettings.findFirst({
    where: { schoolId: enrolment.student.schoolId },
    select: { teachingDays: true },
  });
  const teachingDays = teachingDaysOf(settingsOf(settings));

  const entries = await db.timetableEntry.findMany({
    where: {
      schoolClassId: enrolment.schoolClassId,
      timeSlot: { scheduleKind: "STANDARD" },
    },
    orderBy: [
      { timeSlot: { dayOfWeek: "asc" } },
      { timeSlot: { startTime: "asc" } },
    ],
    select: {
      timeSlot: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
      subject: {
        select: { name: true, shortName: true, code: true, colorHex: true },
      },
      room: { select: { name: true } },
      teacher: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return {
    teachingDays: [...teachingDays],
    lessons: entries.map((entry) => ({
      dayOfWeek: entry.timeSlot.dayOfWeek,
      startTime: entry.timeSlot.startTime,
      endTime: entry.timeSlot.endTime,
      subjectName: entry.subject.name,
      subjectShort:
        entry.subject.shortName || entry.subject.code || entry.subject.name,
      colorHex: entry.subject.colorHex,
      teacherName: entry.teacher
        ? (entry.teacher.profile
            ? `${entry.teacher.profile.firstName} ${entry.teacher.profile.lastName}`.trim()
            : "") || entry.teacher.email
        : null,
      roomName: entry.room?.name ?? null,
    })),
  };
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

  const wanted: {
    schoolId: string;
    schoolYearId: string;
    classId: string | null;
  }[] = [];

  for (const enrolment of enrolments) {
    const schoolId = enrolment.student.schoolId;
    // No settings row means every switch is at its default, and both default
    // to off — see the note on the columns.
    const setting = settingFor.get(schoolId);
    if (!setting) continue;

    if (setting.parentChatEnabled) {
      wanted.push({
        schoolId,
        schoolYearId: enrolment.schoolYearId,
        classId: null,
      });
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
    .sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label),
    );
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

// ── Ce qui est nouveau ───────────────────────────────────────────────────────

export type PortalBadges = {
  events: number;
  chat: number;
  marks: number;
  remarks: number;
  total: number;
};

/**
 * What has happened in this household's corner of the app since it last looked.
 *
 * ── Counted, never stored ───────────────────────────────────────────────────
 * Nothing is written when a school publishes an event or a teacher validates a
 * paper. Each count is "rows newer than this account's watermark", which the
 * indexes those tables already carry can answer — see the note on `PortalSeen`.
 * The alternative, a notification row per family per happening, is a fan-out
 * write on every publish and a second record of a fact that can drift from the
 * first.
 *
 * Every count reuses the *same* scoped read the screen behind it uses, so a
 * badge can never promise something the screen will not show: the marks count
 * goes through `FAMILY_VISIBLE_STATUSES`, the remarks count through
 * `isVisibleToFamily`, the chat count through the household's own channels.
 */
export async function loadBadges(userId: string): Promise<PortalBadges> {
  const watermarks = await db.portalSeen.findMany({
    where: { userId },
    select: { topic: true, seenAt: true },
  });
  const seen = new Map(watermarks.map((row) => [row.topic, row.seenAt]));
  const fallback = firstLookSince();
  const since = (topic: string) => seen.get(topic) ?? fallback;

  const enrolments = await db.enrollment.findMany({
    where: { student: householdScope(userId) },
    select: {
      id: true,
      schoolYearId: true,
      schoolClassId: true,
      levelOffering: { select: { levelId: true } },
    },
  });

  if (enrolments.length === 0) {
    return { events: 0, chat: 0, marks: 0, remarks: 0, total: 0 };
  }

  const enrolmentIds = enrolments.map((row) => row.id);
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

  const channels = await listMyChannels(userId);
  const channelIds = channels.map((channel) => channel.id);

  const [events, chat, marks, remarks] = await Promise.all([
    db.event.count({
      where: {
        schoolYearId: { in: yearIds },
        status: { in: [...VISIBLE_EVENT_STATUSES] },
        // Published, not created: an event drafted in September and announced
        // in March is new in March.
        publishedAt: { gt: since("EVENTS") },
        OR: [
          { isSchoolWide: true },
          { audiences: { some: { schoolClassId: { in: classIds } } } },
          { audiences: { some: { levelId: { in: levelIds } } } },
        ],
      },
    }),
    channelIds.length === 0
      ? Promise.resolve(0)
      : db.chatMessage.count({
          where: {
            channelId: { in: channelIds },
            deletedAt: null,
            createdAt: { gt: since("CHAT") },
            // Your own messages are not news to you.
            authorId: { not: userId },
          },
        }),
    db.assessmentGrade.count({
      where: {
        enrollmentId: { in: enrolmentIds },
        assessment: { status: { in: [...FAMILY_VISIBLE_STATUSES] } },
        // The mark becoming visible is the event, and that is the paper being
        // validated — which touches the grade row.
        updatedAt: { gt: since("MARKS") },
      },
    }),
    db.studentRemark.count({
      where: {
        enrollmentId: { in: enrolmentIds },
        isVisibleToFamily: true,
        updatedAt: { gt: since("REMARKS") },
      },
    }),
  ]);

  return {
    events,
    chat,
    marks,
    remarks,
    total: events + chat + marks + remarks,
  };
}

/**
 * Moves this account's watermark for one topic to now.
 *
 * An upsert because the first look has no row yet, and `updateMany`-style
 * idempotence is not wanted here: opening a screen twice should stamp twice.
 */
export async function markTopicSeen(
  userId: string,
  topic: string,
): Promise<void> {
  if (!isSeenTopic(topic)) return;

  await db.portalSeen.upsert({
    where: { userId_topic: { userId, topic } },
    create: { userId, topic, seenAt: new Date() },
    update: { seenAt: new Date() },
  });
}

// ── Les fournitures ──────────────────────────────────────────────────────────

export type PortalSupplyItem = {
  id: string;
  label: string;
  labelAr: string | null;
  quantity: number | null;
  notes: string | null;
  isRequired: boolean;
};

export type PortalSupplyList = {
  id: string;
  title: string;
  /** Set when the list is for one subject — "pour les arts plastiques". */
  subjectName: string | null;
  notes: string | null;
  items: PortalSupplyItem[];
  requiredCount: number;
};

/**
 * What this child's class has been asked to bring.
 *
 * ── The one filter that matters ─────────────────────────────────────────────
 * `APPROVED` only, through the module's own `isVisibleToFamilies`. A list costs
 * a family money, so it is written by whoever teaches and released by whoever
 * answers for the school — see the note on `SupplyList`. A DRAFT is somebody
 * thinking and a REJECTED one is a decision the teacher has to be able to read;
 * neither is a shopping list, and putting either in front of a parent would
 * have them buying things the school never agreed to ask for.
 *
 * Several lists per class is the ordinary case — a general one plus one for
 * arts plastiques — so this returns them all rather than picking.
 */
export async function loadChildSupplies(
  userId: string,
  studentId: string,
): Promise<PortalSupplyList[]> {
  const child = await resolveChild(userId, studentId);
  if (!child) return [];

  const enrolment = await db.enrollment.findFirst({
    where: { id: child.id },
    select: { schoolClassId: true, schoolYearId: true },
  });
  if (!enrolment?.schoolClassId) return [];

  const lists = await db.supplyList.findMany({
    where: {
      schoolClassId: enrolment.schoolClassId,
      schoolYearId: enrolment.schoolYearId,
      status: "APPROVED",
    },
    // The class's general list first — it is the one every family needs — then
    // the per-subject ones by name.
    orderBy: [{ subjectId: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      notes: true,
      subject: { select: { name: true } },
      items: {
        orderBy: [{ position: "asc" }, { label: "asc" }],
        select: {
          id: true,
          label: true,
          labelAr: true,
          quantity: true,
          notes: true,
          isRequired: true,
        },
      },
    },
  });

  return lists.map((list) => ({
    id: list.id,
    title: list.title,
    subjectName: list.subject?.name ?? null,
    notes: list.notes,
    items: list.items,
    requiredCount: list.items.filter((item) => item.isRequired).length,
  }));
}
