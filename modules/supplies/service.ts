import "server-only";

import { displayName } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  dispatch,
  guardiansOfClass,
  notify,
  staffHolding,
} from "@/modules/notifications/service";
import {
  canReviewTo,
  dueOnValue,
  isEditableByAuthor,
  isVisibleToFamilies,
} from "@/modules/supplies/enums";
import { SUPPLY_PERMISSIONS } from "@/modules/supplies/permissions";

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
  /** The day it is all to be in the bag. Null for a list with no deadline. */
  dueOn: Date | null;
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
        // Normalised here rather than at the form, so the phone and the web
        // cannot disagree about when a deadline actually runs out.
        dueOn: dueOnValue(input.dueOn),
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
      dueOn: dueOnValue(input.dueOn),
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
    // The announcement's fields come off the row already read and scoped here,
    // rather than from a second lookup after the write — see `tellAboutDecision`.
    select: {
      id: true,
      status: true,
      title: true,
      authorId: true,
      schoolClassId: true,
      school: { select: { organizationId: true } },
    },
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

  await dispatch("SUPPLY_LIST_REVIEWED", () =>
    tellAboutDecision(list, schoolId, status),
  );

  return { ok: true };
}

/** What `tellAboutDecision` needs, as `reviewList` has already read it. */
type ReviewedList = {
  id: string;
  title: string;
  authorId: string | null;
  schoolClassId: string;
  school: { organizationId: string };
};

/**
 * The two people a decision on a list concerns.
 *
 * ── The families, and only once it is approved ──────────────────────────────
 * A liste de fournitures costs a household money, and the whole point of the
 * DRAFT → SUBMITTED → APPROVED road is that nobody is asked to buy anything the
 * school has not agreed to ask for. So a refusal reaches the teacher who wrote
 * it and nobody else: telling a family about a list that was turned down would
 * have them buying things off it, which is the exact failure the review exists
 * to prevent.
 *
 * ── And the author, either way ──────────────────────────────────────────────
 * A teacher whose list is refused currently finds out by going back to look. The
 * decision carries its own status, so approval and refusal are one kind — see
 * the note on `SUPPLY_LIST_REVIEWED`.
 */
async function tellAboutDecision(
  list: ReviewedList,
  schoolId: string,
  status: string,
): Promise<void> {
  const organizationId = list.school.organizationId;

  if (list.authorId) {
    await notify({
      organizationId,
      schoolId,
      kind: "SUPPLY_LIST_REVIEWED",
      subjectId: list.id,
      // A list refused, corrected and approved is two decisions and two lines.
      dedupeOn: status,
      params: { title: list.title, status },
      targets: [{ userId: list.authorId }],
    });
  }

  if (isVisibleToFamilies(status)) {
    await notify({
      organizationId,
      schoolId,
      kind: "SUPPLY_LIST_APPROVED",
      subjectId: list.id,
      params: { title: list.title },
      targets: await guardiansOfClass(list.schoolClassId),
    });
  }
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
    // As in `reviewList`, the office's line is built from this one read.
    select: {
      id: true,
      status: true,
      title: true,
      school: { select: { organizationId: true } },
      schoolClass: { select: { code: true } },
      author: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!list) return { ok: false, reason: "not-found" };
  if (list.status !== "DRAFT" && list.status !== "REJECTED") {
    return { ok: false, reason: "bad-transition" };
  }

  await db.supplyList.update({
    where: { id: list.id },
    data: { status: "SUBMITTED", reviewNote: null },
  });

  // The same queue-nobody-opens gap `REQUEST_FILED` closes: a list handed up in
  // July sits until somebody thinks to look, and the rentrée is the deadline.
  await dispatch("SUPPLY_LIST_SUBMITTED", () => tellTheOffice(list, schoolId));

  return { ok: true };
}

/** What `tellTheOffice` needs, as `submitList` has already read it. */
type SubmittedList = {
  id: string;
  title: string;
  school: { organizationId: string };
  schoolClass: { code: string };
  author: {
    email: string;
    profile: { firstName: string; lastName: string } | null;
  } | null;
};

/** Puts a submitted list in front of whoever may actually approve it. */
async function tellTheOffice(
  list: SubmittedList,
  schoolId: string,
): Promise<void> {
  const organizationId = list.school.organizationId;

  await notify({
    organizationId,
    schoolId,
    kind: "SUPPLY_LIST_SUBMITTED",
    subjectId: list.id,
    params: {
      title: list.title,
      className: list.schoolClass.code,
      teacher: list.author ? displayName(list.author) : "—",
    },
    targets: await staffHolding(
      organizationId,
      schoolId,
      SUPPLY_PERMISSIONS.SUPPLY_REVIEW,
    ),
  });
}
