"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { formValues } from "@/lib/form-values";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, listField, withActionErrors } from "@/lib/server-action";
import { fieldErrors } from "@/lib/validation";
import { isEditableByAuthor } from "@/modules/supplies/enums";
import {
  replaceItems,
  reviewList,
  submitList,
  type ItemInput,
} from "@/modules/supplies/service";
import {
  supplyItemSchema,
  supplyListSchema,
  supplyReviewSchema,
} from "@/modules/supplies/validation";

/**
 * Actions for the supplies module.
 *
 * The school and the year come from the working context, never from the form.
 * Writing a list and deciding on one are gated on different permissions — that
 * split is the point of the feature, so it is enforced here and not only in
 * which buttons the screen draws.
 */

const NO_SELECTION = "__none__";

async function supplyContext() {
  const t = await getDictionary();
  const context = await requireAuth();
  return {
    t,
    context,
    schoolId: context.currentSchool?.id,
    schoolYearId: context.currentSchoolYear?.id,
  };
}

/**
 * The items, as parallel arrays indexed by row.
 *
 * Every row must contribute exactly one value to every field — otherwise a
 * blank quantity would shift the next article's detail onto the wrong line,
 * which is the same trap the mark sheet and the register avoid the same way.
 */
function readItems(formData: FormData): ItemInput[] | null {
  const articles = listField(formData, "itemArticleId");
  const quantities = listField(formData, "itemQuantity");
  const notes = listField(formData, "itemNotes");
  const required = listField(formData, "itemRequired");

  if (
    quantities.length !== articles.length ||
    notes.length !== articles.length ||
    required.length !== articles.length
  ) {
    return null;
  }

  return articles
    .map((articleId, index) => ({
      articleId: articleId.trim(),
      quantity: quantities[index]?.trim() ?? "",
      notes: notes[index]?.trim() || null,
      // The checkbox travels as "1"/"0" per row rather than as its presence,
      // so an unticked box still occupies its slot in the array.
      isRequired: required[index] === "1",
    }))
    // A row whose article was left unchosen is somebody adding a line and
    // changing their mind, not an error worth refusing the whole list for.
    .filter((item) => item.articleId !== "")
    .map((item) => ({
      ...item,
      quantity: item.quantity === "" ? null : Number(item.quantity),
    }));
}

/** Re-reads a list against the school, so a crafted id reaches nothing. */
async function findScopedList(schoolId: string, listId: string) {
  return db.supplyList.findFirst({
    where: { id: listId, schoolId },
    select: { id: true, status: true, authorId: true, title: true },
  });
}

export async function saveSupplyListAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId, schoolYearId } = await supplyContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.SUPPLY_WRITE);

    const rawSubject = field(formData, "subjectId");
    const parsed = supplyListSchema(t).safeParse({
      schoolClassId: field(formData, "schoolClassId"),
      subjectId: rawSubject === NO_SELECTION ? "" : rawSubject,
      title: field(formData, "title"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const items = readItems(formData);
    if (items === null) return failure(t.errors.invalid);

    for (const item of items) {
      const check = supplyItemSchema(t).safeParse(item);
      if (!check.success) {
        return failure(
          t.errors.invalid,
          fieldErrors(check.error),
          formValues(formData),
        );
      }
    }

    // The class must be one of this school's, this year — the id comes from the
    // request and is never trusted.
    const schoolClass = await db.schoolClass.findFirst({
      where: {
        id: parsed.data.schoolClassId,
        schoolId,
        levelOffering: { schoolYearId },
      },
      select: { id: true },
    });
    if (!schoolClass) return failure(t.errors.notFound);

    const subject = parsed.data.subjectId
      ? await db.subject.findFirst({
          where: { id: parsed.data.subjectId, schoolId },
          select: { id: true },
        })
      : null;

    const id = field(formData, "id");

    if (id) {
      const existing = await findScopedList(schoolId, id);
      if (!existing) return failure(t.errors.notFound);

      // Somebody else's draft is not yours to rewrite. The office may review it
      // but reviewing is a decision, not an edit.
      if (existing.authorId !== context.user.id) {
        return failure(t.supply.notYourList);
      }
      // An approved list has been agreed and families may have bought against
      // it; changing it is a new decision, so it must be withdrawn first.
      if (!isEditableByAuthor(existing.status)) {
        return failure(t.supply.cannotEditApproved);
      }

      await db.supplyList.update({
        where: { id: existing.id },
        data: {
          schoolClassId: schoolClass.id,
          subjectId: subject?.id ?? null,
          title: parsed.data.title,
          notes: parsed.data.notes,
        },
      });
      await replaceItems(existing.id, schoolId, items);

      refresh();
      return success(t.supply.saved);
    }

    const created = await db.supplyList.create({
      data: {
        schoolId,
        schoolYearId,
        schoolClassId: schoolClass.id,
        subjectId: subject?.id ?? null,
        title: parsed.data.title,
        notes: parsed.data.notes,
        status: "DRAFT",
        authorId: context.user.id,
      },
      select: { id: true },
    });
    await replaceItems(created.id, schoolId, items);

    refresh();
    return success(t.supply.created);
  });
}

/** The author hands their list to the office. */
export async function submitSupplyListAction(
  listId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await supplyContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.SUPPLY_WRITE);

    const result = await submitList(listId, schoolId, context.user.id);
    if (!result.ok) {
      return failure(
        result.reason === "not-found"
          ? t.errors.notFound
          : t.supply.alreadyDecided,
      );
    }

    refresh();
    return success(t.supply.submitted);
  });
}

/**
 * The office approves, refuses or withdraws.
 *
 * Behind SUPPLY_REVIEW rather than SUPPLY_WRITE: a teacher who may write a list
 * must not be able to release it to families, which is the whole reason the two
 * codes exist apart.
 */
export async function reviewSupplyListAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await supplyContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.SUPPLY_REVIEW);

    const parsed = supplyReviewSchema(t).safeParse({
      id: field(formData, "id"),
      status: field(formData, "status"),
      reviewNote: field(formData, "reviewNote"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const result = await reviewList(
      parsed.data.id,
      schoolId,
      parsed.data.status,
      parsed.data.reviewNote,
      context.user.id,
    );
    if (!result.ok) {
      return failure(
        result.reason === "not-found"
          ? t.errors.notFound
          : t.supply.alreadyDecided,
      );
    }

    refresh();
    return success(
      parsed.data.status === "APPROVED"
        ? t.supply.approved
        : parsed.data.status === "REJECTED"
          ? t.supply.rejected
          : t.supply.withdrawn,
    );
  });
}

export async function deleteSupplyListAction(
  listId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await supplyContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.SUPPLY_DELETE);

    const existing = await findScopedList(schoolId, listId);
    if (!existing) return failure(t.errors.notFound);

    // Cascades to the items, which is right: they have no meaning apart from
    // the list, and nothing else points at them.
    await db.supplyList.delete({ where: { id: existing.id } });

    refresh();
    return success(t.supply.deleted);
  });
}
