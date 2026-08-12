import "server-only";

import { db } from "@/lib/db";
import { canMove, isCancellable } from "@/modules/requests/enums";

/**
 * Writes and invariants for the requests module.
 *
 * Two callers with two entirely different scopings meet here: the office, whose
 * action has already authorized REQUEST_HANDLE in the school; and a parent,
 * whose route has resolved the child against their own household. So every
 * function takes ids that the *caller* has already proven reachable, and this
 * file enforces only what neither of them can — that a move is one the workflow
 * allows, and that the row it lands on is internally consistent afterwards.
 */

export type FileRequestInput = {
  studentId: string;
  typeId: string;
  copies: number;
  reason: string | null;
  requestedById: string;
};

export type FileRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; reason: "not-found" | "reason-required" | "duplicate" };

/**
 * A family filing a request.
 *
 * ── What is re-derived rather than trusted ──────────────────────────────────
 * The caller has proven the *pupil* is theirs. It has not proven the **type**
 * is one the pupil's own school issues, and a type id is guessable — so the
 * type is looked up constrained by the pupil's school, and a miss reads as
 * not-found. `schoolId` is then taken from the pupil, never from the request,
 * which is the invariant on the column.
 *
 * ── Why a duplicate is refused ──────────────────────────────────────────────
 * A parent who taps twice on a slow connection, or who forgets they asked last
 * week, otherwise puts the same paper in the queue twice and the office writes
 * it twice. An identical request already open is answered as a duplicate so the
 * phone can point at the one they already have. Closed ones do not count: a
 * family may perfectly well need a second attestation in March.
 */
export async function fileRequest(
  input: FileRequestInput,
): Promise<FileRequestResult> {
  const student = await db.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, schoolId: true },
  });
  if (!student) return { ok: false, reason: "not-found" };

  const type = await db.documentRequestType.findFirst({
    where: { id: input.typeId, schoolId: student.schoolId, isActive: true },
    select: { id: true, requiresReason: true },
  });
  if (!type) return { ok: false, reason: "not-found" };

  const reason = input.reason?.trim() || null;
  if (type.requiresReason && reason === null) {
    return { ok: false, reason: "reason-required" };
  }

  const existing = await db.documentRequest.findFirst({
    where: {
      studentId: student.id,
      typeId: type.id,
      status: { in: ["PENDING", "ACCEPTED", "READY"] },
    },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "duplicate" };

  const created = await db.documentRequest.create({
    data: {
      // From the pupil, never from the request — see the invariant on the
      // column.
      schoolId: student.schoolId,
      studentId: student.id,
      typeId: type.id,
      copies: input.copies,
      reason,
      requestedById: input.requestedById,
      status: "PENDING",
    },
    select: { id: true },
  });

  return { ok: true, requestId: created.id };
}

export type HandleRequestInput = {
  status: string;
  readyAt: Date | null;
  officeNote: string | null;
  handledById: string;
};

export type HandleRequestResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not-found" | "bad-move" | "date-required" | "reason-required";
    };

/**
 * The office answering a request.
 *
 * The move itself is checked against `OFFICE_MOVES`, which is the whole
 * workflow in one table and is also what the screen builds its buttons from —
 * so a button can never exist for a move refused here. A Server Function is
 * reachable by direct POST, and the two must agree.
 *
 * Three invariants the database cannot express:
 *
 *   * **accepting names a day.** Accepting is the school telling a family when
 *     to come; without a date it is indistinguishable from having done nothing,
 *     and the family is left waiting on a promise with no shape. A school that
 *     will not commit to a day marks it ready when it is ready instead;
 *   * **refusing gives a reason.** A refusal a family cannot read is one they
 *     will ring up about, or file again;
 *   * **`collectedAt` is set when and only when the status is COLLECTED**, and
 *     `readyAt` is cleared on a refusal — a date to come for a paper that will
 *     never be written is worse than no date.
 */
export async function handleRequest(
  requestId: string,
  schoolId: string,
  input: HandleRequestInput,
): Promise<HandleRequestResult> {
  // Scoped by the school as well as the id, so a crafted id matches nothing
  // rather than reaching another school's desk.
  const request = await db.documentRequest.findFirst({
    where: { id: requestId, schoolId },
    select: { id: true, status: true, readyAt: true },
  });
  if (!request) return { ok: false, reason: "not-found" };

  if (!canMove(request.status, input.status)) {
    return { ok: false, reason: "bad-move" };
  }

  const officeNote = input.officeNote?.trim() || null;

  if (input.status === "ACCEPTED" && input.readyAt === null) {
    return { ok: false, reason: "date-required" };
  }
  if (input.status === "REJECTED" && officeNote === null) {
    return { ok: false, reason: "reason-required" };
  }

  const now = new Date();

  await db.documentRequest.update({
    where: { id: request.id },
    data: {
      status: input.status,
      // Kept on the way from ACCEPTED to READY: the day the family was told to
      // come is still the useful fact, and dropping it would leave the office
      // unable to say what it had promised. Cleared on a refusal.
      readyAt:
        input.status === "REJECTED"
          ? null
          : (input.readyAt ?? request.readyAt),
      officeNote,
      handledById: input.handledById,
      handledAt: now,
      collectedAt: input.status === "COLLECTED" ? now : null,
    },
  });

  return { ok: true };
}

export type CancelResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "too-late" };

/**
 * A family withdrawing their own request.
 *
 * Constrained by the requester as well as the id: the caller has resolved the
 * request against the household, and pinning it to the user who filed it means
 * one guardian cannot withdraw what another asked for.
 *
 * Only while it is still PENDING — see `isCancellable`. Past that the office
 * has started work, and the family talks to the school rather than pressing a
 * button.
 */
export async function cancelRequest(
  requestId: string,
  requestedById: string,
): Promise<CancelResult> {
  const request = await db.documentRequest.findFirst({
    where: { id: requestId, requestedById },
    select: { id: true, status: true },
  });
  if (!request) return { ok: false, reason: "not-found" };
  if (!isCancellable(request.status)) return { ok: false, reason: "too-late" };

  await db.documentRequest.update({
    where: { id: request.id },
    data: { status: "CANCELLED" },
  });

  return { ok: true };
}
