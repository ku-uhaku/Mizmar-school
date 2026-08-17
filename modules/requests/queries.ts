import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { schoolScope } from "@/lib/scope";
import { OPEN_STATUSES, isOverdue } from "@/modules/requests/enums";

/**
 * Reads for the requests module — the office side of the desk.
 *
 * Scoped to the school in context and deliberately **not** to the year. A
 * request is a piece of correspondence, not a fact about a rentrée: a family
 * asking in September for an attestation covering last year is asking the same
 * office the same question, and hiding it behind a year switch would lose it.
 *
 * Families read their own requests through `modules/portal/queries.ts`, which
 * scopes on the household. A phone never reaches this file.
 */

function displayName(user: {
  username: string;
  profile: { firstName: string; lastName: string } | null;
} | null): string | null {
  if (!user) return null;
  if (!user.profile) return user.username;
  return (
    `${user.profile.firstName} ${user.profile.lastName}`.trim() || user.username
  );
}

export type RequestRow = {
  id: string;
  status: string;
  typeId: string;
  typeName: string;
  /**
   * How long this kind of paper ordinarily takes. Carried so the "accept"
   * dialog can offer a day rather than an empty box — see `suggestedReadyDate`.
   * Null when the school promises nothing for it.
   */
  usualDelayDays: number | null;
  copies: number;
  reason: string | null;
  officeNote: string | null;
  /** ISO throughout — formatted per-locale on the client. */
  requestedAt: string;
  readyAt: string | null;
  handledAt: string | null;
  collectedAt: string | null;
  handledByName: string | null;
  /** Who asked. Null once a parent's account has been closed. */
  requestedByName: string | null;
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string | null;
  /** Derived, never stored — a promised day that has passed. See `isOverdue`. */
  isOverdue: boolean;
};

const REQUEST_INCLUDE = {
  type: { select: { id: true, name: true, usualDelayDays: true } },
  requestedBy: {
    select: {
      username: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
  handledBy: {
    select: {
      username: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
  student: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      // The child's current class, for the queue's second line. Most recent
      // enrolment rather than the active year's: a paper is often asked for
      // about a child who has already left.
      enrollments: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { schoolClass: { select: { code: true, name: true } } },
      },
    },
  },
} as const;

type RequestRecord = Awaited<
  ReturnType<typeof db.documentRequest.findMany<{ include: typeof REQUEST_INCLUDE }>>
>[number];

function toRow(request: RequestRecord, now: Date): RequestRow {
  const seat = request.student.enrollments[0]?.schoolClass ?? null;

  return {
    id: request.id,
    status: request.status,
    typeId: request.type.id,
    typeName: request.type.name,
    usualDelayDays: request.type.usualDelayDays,
    copies: request.copies,
    reason: request.reason,
    officeNote: request.officeNote,
    requestedAt: request.createdAt.toISOString(),
    readyAt: request.readyAt?.toISOString() ?? null,
    handledAt: request.handledAt?.toISOString() ?? null,
    collectedAt: request.collectedAt?.toISOString() ?? null,
    handledByName: displayName(request.handledBy),
    requestedByName: displayName(request.requestedBy),
    studentId: request.student.id,
    studentCode: request.student.code,
    studentName: `${request.student.firstName} ${request.student.lastName}`.trim(),
    className: seat ? seat.name || seat.code : null,
    isOverdue: isOverdue(request, now),
  };
}

/**
 * The office's queue.
 *
 * Oldest first, and only among what is still open: a desk works through what it
 * owes people in the order they asked, and a request from three weeks ago must
 * not sink under this morning's. Closed requests are the archive and are read
 * with `status` set explicitly.
 */
export async function listRequests(
  context: AuthContext,
  filters: { status?: string; studentId?: string } = {},
): Promise<RequestRow[]> {
  const requests = await db.documentRequest.findMany({
    where: {
      ...schoolScope(context),
      ...(filters.status
        ? { status: filters.status }
        : { status: { in: [...OPEN_STATUSES] } }),
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
    },
    orderBy: [{ createdAt: "asc" }],
    include: REQUEST_INCLUDE,
  });

  const now = new Date();
  return requests.map((request) => toRow(request, now));
}

/**
 * One request, scoped the same way.
 *
 * Null rather than a throw so the caller chooses between "not found" and
 * "forbidden" — an id from another school reads as absent, which is what stops
 * its existence being probed.
 */
export async function findRequest(
  context: AuthContext,
  requestId: string,
): Promise<RequestRow | null> {
  const request = await db.documentRequest.findFirst({
    where: { id: requestId, ...schoolScope(context) },
    include: REQUEST_INCLUDE,
  });

  return request ? toRow(request, new Date()) : null;
}

export type RequestSummary = {
  /** Nobody has looked at these yet. */
  pending: number;
  /** Promised for a day that has passed. */
  overdue: number;
  /** Written and waiting at the desk for somebody to come. */
  ready: number;
};

/** The figures on the requests screen and the vie scolaire dashboard. */
export async function requestSummary(
  context: AuthContext,
): Promise<RequestSummary> {
  const open = await db.documentRequest.findMany({
    where: { ...schoolScope(context), status: { in: [...OPEN_STATUSES] } },
    select: { status: true, readyAt: true },
  });

  const now = new Date();
  return {
    pending: open.filter((request) => request.status === "PENDING").length,
    overdue: open.filter((request) => isOverdue(request, now)).length,
    ready: open.filter((request) => request.status === "READY").length,
  };
}

export type RequestTypeRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  usualDelayDays: number | null;
  requiresReason: boolean;
};

/**
 * What this school will issue, in the order it chose. Active only — a paper the
 * school has stopped writing must not be offerable, while the requests already
 * filed against it keep reading correctly.
 */
export async function listRequestTypes(
  context: AuthContext,
): Promise<RequestTypeRow[]> {
  return db.documentRequestType.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      description: true,
      descriptionAr: true,
      usualDelayDays: true,
      requiresReason: true,
    },
  });
}
