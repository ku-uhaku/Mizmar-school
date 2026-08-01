import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";

/**
 * Reads for the supplies module.
 *
 * Confined to `context.currentSchool` and `context.currentSchoolYear`
 * throughout — a liste de fournitures is only true of one class in one year.
 *
 * ── What each reader is allowed to see ───────────────────────────────────────
 * The office sees everything. A teacher sees their own drafts plus everything
 * already approved, because an approved list is school-wide information and
 * hiding a colleague's is how two teachers ask the same class for the same ring
 * binder. That narrowing is a *parameter* rather than a separate query, so the
 * list screen and the counts cannot drift apart.
 */

function scope(context: AuthContext) {
  return {
    schoolId: context.currentSchool?.id ?? "__none__",
    schoolYearId: context.currentSchoolYear?.id ?? "__none__",
  };
}

export type SupplyItemRow = {
  id: string;
  label: string;
  labelAr: string | null;
  quantity: number | null;
  notes: string | null;
  isRequired: boolean;
  position: number;
};

export type SupplyListRow = {
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
  items: SupplyItemRow[];
};

const listInclude = {
  schoolClass: {
    select: {
      id: true,
      code: true,
      levelOffering: { select: { level: { select: { code: true } } } },
    },
  },
  subject: { select: { id: true, name: true } },
  author: {
    select: { email: true, profile: { select: { firstName: true, lastName: true } } },
  },
  reviewedBy: {
    select: { email: true, profile: { select: { firstName: true, lastName: true } } },
  },
  items: { orderBy: [{ position: "asc" as const }, { label: "asc" as const }] },
};

type ListWithRelations = {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  authorId: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  schoolClass: {
    id: string;
    code: string;
    levelOffering: { level: { code: string } };
  };
  subject: { id: string; name: string } | null;
  author: Parameters<typeof displayName>[0] | null;
  reviewedBy: Parameters<typeof displayName>[0] | null;
  items: {
    id: string;
    label: string;
    labelAr: string | null;
    quantity: number | null;
    notes: string | null;
    isRequired: boolean;
    position: number;
  }[];
};

function toRow(list: ListWithRelations): SupplyListRow {
  return {
    id: list.id,
    title: list.title,
    notes: list.notes,
    status: list.status,
    schoolClassId: list.schoolClass.id,
    className: list.schoolClass.code,
    levelLabel: list.schoolClass.levelOffering.level.code,
    subjectId: list.subject?.id ?? null,
    subjectName: list.subject?.name ?? null,
    authorId: list.authorId,
    authorName: list.author ? displayName(list.author) : null,
    reviewedByName: list.reviewedBy ? displayName(list.reviewedBy) : null,
    reviewedAt: toDateInputValue(list.reviewedAt),
    reviewNote: list.reviewNote,
    itemCount: list.items.length,
    items: list.items,
  };
}

/**
 * The lists this reader may see.
 *
 * `canReview` is the office's flag: with it, everything; without it, the
 * reader's own lists plus every approved one.
 */
export async function listSupplyLists(
  context: AuthContext,
  { canReview }: { canReview: boolean },
): Promise<SupplyListRow[]> {
  const lists = await db.supplyList.findMany({
    where: {
      ...scope(context),
      ...(canReview
        ? {}
        : { OR: [{ authorId: context.user.id }, { status: "APPROVED" }] }),
    },
    // Waiting-on-a-decision first: the office opens this screen to clear that
    // queue, and a list already approved is not what they came for.
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: listInclude,
  });

  return lists.map(toRow);
}

/** One list. Null when out of reach, which callers turn into `notFound()`. */
export async function findSupplyList(
  context: AuthContext,
  listId: string,
  { canReview }: { canReview: boolean },
): Promise<SupplyListRow | null> {
  const list = await db.supplyList.findFirst({
    where: {
      id: listId,
      ...scope(context),
      ...(canReview
        ? {}
        : { OR: [{ authorId: context.user.id }, { status: "APPROVED" }] }),
    },
    include: listInclude,
  });

  return list ? toRow(list) : null;
}

/** How many lists are sitting on the office's desk — for the badge. */
export async function countAwaitingReview(
  context: AuthContext,
): Promise<number> {
  return db.supplyList.count({
    where: { ...scope(context), status: "SUBMITTED" },
  });
}

/** The school's subjects, for the optional per-subject list. */
export async function listSubjectChoices(
  context: AuthContext,
): Promise<{ id: string; label: string }[]> {
  const subjects = await db.subject.findMany({
    where: { schoolId: context.currentSchool?.id ?? "__none__", isActive: true },
    orderBy: [{ code: "asc" }],
    select: { id: true, name: true, code: true },
  });

  return subjects.map((subject) => ({
    id: subject.id,
    label: `${subject.code} · ${subject.name}`,
  }));
}
