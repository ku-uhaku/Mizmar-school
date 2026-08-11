import "server-only";

import { db } from "@/lib/db";
import { canReviewTo, isEditableByAuthor } from "@/modules/supplies/enums";

/**
 * Writes and invariants for the supplies module.
 *
 * The one rule worth a service layer: a list's status moves only along the
 * transitions declared in `enums.ts`, and only the office moves it. Everything
 * else here exists to make that rule enforceable in one place rather than in
 * every action that touches a list.
 */

/**
 * One posted line. The article is what was chosen; the wording is not sent.
 *
 * A form that posted the label as well would be a form that could put any text
 * on a list under the cover of a catalogue — the whole point of the catalogue
 * is that the school decided the wording once.
 */
export type ItemInput = {
  articleId: string;
  quantity: number | null;
  notes: string | null;
  isRequired: boolean;
};

/**
 * Replaces a list's items wholesale, resolving each line against the school's
 * own catalogue.
 *
 * A delete-then-insert rather than a diff: the editor posts the whole list
 * every time, items carry no identity a user would recognise, and reconciling
 * twenty unnamed rows to keep ids stable buys nothing — nothing points at a
 * SupplyItem. `position` is the array order, so reordering is just resubmitting.
 *
 * ── Why the wording is looked up here ───────────────────────────────────────
 * `label` is written from the article rather than from the request, and the
 * lookup is scoped to `schoolId`, so an article id belonging to another school
 * matches nothing and its line is dropped rather than written. The copy is then
 * frozen: renaming the article next year leaves lists that families have
 * already shopped from exactly as they were printed.
 */
export async function replaceItems(
  listId: string,
  schoolId: string,
  items: ItemInput[],
): Promise<number> {
  const articles = await db.supplyArticle.findMany({
    where: { id: { in: items.map((item) => item.articleId) }, schoolId },
    select: { id: true, name: true, nameAr: true },
  });
  const byId = new Map(articles.map((article) => [article.id, article]));

  const resolved = items.flatMap((item) => {
    const article = byId.get(item.articleId);
    return article ? [{ item, article }] : [];
  });

  await db.$transaction([
    db.supplyItem.deleteMany({ where: { listId } }),
    ...(resolved.length > 0
      ? [
          db.supplyItem.createMany({
            data: resolved.map(({ item, article }, index) => ({
              listId,
              articleId: article.id,
              label: article.name,
              labelAr: article.nameAr,
              quantity: item.quantity,
              notes: item.notes,
              isRequired: item.isRequired,
              position: index,
            })),
          }),
        ]
      : []),
  ]);

  return resolved.length;
}

export type SaveListInput = {
  /** From the session, never the request. */
  authorId: string;
  schoolId: string;
  schoolYearId: string;
  /** Absent to create; present to rewrite an existing draft. */
  listId?: string;
  schoolClassId: string;
  subjectId: string | null;
  title: string;
  notes: string | null;
  items: ItemInput[];
};

export type SaveListResult =
  | { ok: true; listId: string }
  | { ok: false; reason: "not-found" | "not-yours" | "not-editable" };

/**
 * Writes a liste de fournitures — a new draft, or a rewrite of one.
 *
 * Lives in the service rather than the action because two surfaces write one
 * now: the office's editor on the web and the teacher's request on the phone.
 * The rules that matter — the class must be this school's this year, somebody
 * else's draft is not yours to rewrite, an approved list is closed to its
 * author — are enforced here so neither caller can be the one that forgets.
 *
 * Always DRAFT on create. Handing it to the office is `submitList`, a separate
 * and deliberate act: a half-written list must not land on somebody's desk
 * because the author tapped save.
 */
export async function saveList(
  input: SaveListInput,
): Promise<SaveListResult> {
  // The class must be one of this school's, this year — the id comes from the
  // request and is never trusted.
  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: input.schoolClassId,
      schoolId: input.schoolId,
      levelOffering: { schoolYearId: input.schoolYearId },
    },
    select: { id: true },
  });
  if (!schoolClass) return { ok: false, reason: "not-found" };

  const subject = input.subjectId
    ? await db.subject.findFirst({
        where: { id: input.subjectId, schoolId: input.schoolId },
        select: { id: true },
      })
    : null;

  if (input.listId) {
    const existing = await db.supplyList.findFirst({
      where: { id: input.listId, schoolId: input.schoolId },
      select: { id: true, status: true, authorId: true },
    });
    if (!existing) return { ok: false, reason: "not-found" };

    // Somebody else's draft is not yours to rewrite. The office may review it,
    // but reviewing is a decision, not an edit.
    if (existing.authorId !== input.authorId) {
      return { ok: false, reason: "not-yours" };
    }
    // An approved list has been agreed and families may have bought against it;
    // changing it is a new decision, so it must be withdrawn first.
    if (!isEditableByAuthor(existing.status)) {
      return { ok: false, reason: "not-editable" };
    }

    await db.supplyList.update({
      where: { id: existing.id },
      data: {
        schoolClassId: schoolClass.id,
        subjectId: subject?.id ?? null,
        title: input.title,
        notes: input.notes,
      },
    });
    await replaceItems(existing.id, input.schoolId, input.items);

    return { ok: true, listId: existing.id };
  }

  const created = await db.supplyList.create({
    data: {
      schoolId: input.schoolId,
      schoolYearId: input.schoolYearId,
      schoolClassId: schoolClass.id,
      subjectId: subject?.id ?? null,
      title: input.title,
      notes: input.notes,
      status: "DRAFT",
      authorId: input.authorId,
    },
    select: { id: true },
  });
  await replaceItems(created.id, input.schoolId, input.items);

  return { ok: true, listId: created.id };
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

  if (!canReviewTo(list.status, status)) {
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
