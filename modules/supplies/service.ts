import "server-only";

import { db } from "@/lib/db";
import { REVIEW_TRANSITIONS } from "@/modules/supplies/enums";

/**
 * Writes and invariants for the supplies module.
 *
 * The one rule worth a service layer: a list's status moves only along the
 * transitions declared in `enums.ts`, and only the office moves it. Everything
 * else here exists to make that rule enforceable in one place rather than in
 * every action that touches a list.
 */

export type ItemInput = {
  label: string;
  labelAr: string | null;
  quantity: number | null;
  notes: string | null;
  isRequired: boolean;
};

/**
 * Replaces a list's items wholesale.
 *
 * A delete-then-insert rather than a diff: the editor posts the whole list
 * every time, items carry no identity a user would recognise, and reconciling
 * twenty unnamed rows to keep ids stable buys nothing — nothing points at a
 * SupplyItem. `position` is the array order, so reordering is just resubmitting.
 */
export async function replaceItems(
  listId: string,
  items: ItemInput[],
): Promise<number> {
  await db.$transaction([
    db.supplyItem.deleteMany({ where: { listId } }),
    ...(items.length > 0
      ? [
          db.supplyItem.createMany({
            data: items.map((item, index) => ({
              listId,
              label: item.label,
              labelAr: item.labelAr,
              quantity: item.quantity,
              notes: item.notes,
              isRequired: item.isRequired,
              position: index,
            })),
          }),
        ]
      : []),
  ]);

  return items.length;
}

export type ReviewResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "bad-transition" };

/**
 * Moves a list to a decided status.
 *
 * The transition table is consulted rather than trusted from the request: a
 * POST asking to take a DRAFT straight to APPROVED skips the teacher's own
 * submission, and one asking to re-approve an already-approved list would
 * overwrite who decided it and when.
 *
 * `reviewedAt` and `reviewedById` are stamped here and never taken from the
 * form — they are the answer to "who said we could ask parents for this".
 */
export async function reviewList(
  listId: string,
  schoolId: string,
  status: string,
  reviewNote: string | null,
  reviewerId: string,
): Promise<ReviewResult> {
  const list = await db.supplyList.findFirst({
    where: { id: listId, schoolId },
    select: { id: true, status: true },
  });
  if (!list) return { ok: false, reason: "not-found" };

  const allowed = REVIEW_TRANSITIONS[list.status] ?? [];
  if (!allowed.includes(status as (typeof allowed)[number])) {
    return { ok: false, reason: "bad-transition" };
  }

  await db.supplyList.update({
    where: { id: list.id },
    data: {
      status,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      // The reason belongs to the decision that carried it; a later approval
      // must not leave a stale refusal note attached.
      reviewNote: status === "REJECTED" ? reviewNote : null,
    },
  });

  return { ok: true };
}

/**
 * Hands a list to the office.
 *
 * Separate from `reviewList` because it is the author's move, not the office's,
 * and the two are gated on different permissions. A list already decided cannot
 * be resubmitted — that is a withdrawal, which is the office's call.
 */
export async function submitList(
  listId: string,
  schoolId: string,
  authorId: string,
): Promise<ReviewResult> {
  const list = await db.supplyList.findFirst({
    // Scoped by author as well as school: submitting somebody else's draft
    // would put their name on a decision they did not ask for.
    where: { id: listId, schoolId, authorId },
    select: { id: true, status: true },
  });
  if (!list) return { ok: false, reason: "not-found" };
  if (list.status !== "DRAFT" && list.status !== "REJECTED") {
    return { ok: false, reason: "bad-transition" };
  }

  await db.supplyList.update({
    where: { id: list.id },
    data: { status: "SUBMITTED", reviewNote: null },
  });

  return { ok: true };
}
