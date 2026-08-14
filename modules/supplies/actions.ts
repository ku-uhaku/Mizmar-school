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
import {
  reviewList,
  saveList,
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
      dueOn: field(formData, "dueOn"),
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

    const id = field(formData, "id");

    const result = await saveList({
      authorId: context.user.id,
      schoolId,
      schoolYearId,
      ...(id ? { listId: id } : {}),
      schoolClassId: parsed.data.schoolClassId,
      subjectId: parsed.data.subjectId || null,
      title: parsed.data.title,
      notes: parsed.data.notes,
      dueOn: parsed.data.dueOn,
      items,
    });

    if (!result.ok) {
      if (result.reason === "not-yours") return failure(t.supply.notYourList);
      if (result.reason === "not-editable") {
        return failure(t.supply.cannotEditApproved);
      }
      return failure(t.errors.notFound);
    }

    refresh();
    return success(id ? t.supply.saved : t.supply.created);
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
