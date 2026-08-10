"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { formValues } from "@/lib/form-values";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { fieldErrors } from "@/lib/validation";
import {
  computeClassBulletins,
  saveAppreciation,
  saveCouncilDecision,
  setClassPublication,
} from "@/modules/bulletins/service";
import {
  appreciationSchema,
  bulletinScopeSchema,
  councilSchema,
} from "@/modules/bulletins/validation";

/**
 * Actions for the bulletins module.
 *
 * The school comes from the working context and never from the form. Each of
 * the four things a person can do to a bulletin is behind its own permission,
 * because they are four different authorities — see permissions.ts. Checking
 * them here rather than only in which buttons the screen draws is what makes
 * that real: a Server Function is reachable by direct POST.
 */

/**
 * What a Select's "not awarded" choice sends. Radix will not take `""` as an
 * item value, so the blank choice carries a sentinel and is mapped back here —
 * the same trick the supplies and timetable forms use.
 */
const NO_SELECTION = "__none__";

/** A sentinel reads as "left blank", which is what the optional enums expect. */
function choice(formData: FormData, name: string): string {
  const value = field(formData, name);
  return value === NO_SELECTION ? "" : value;
}

async function bulletinContext() {
  const t = await getDictionary();
  const context = await requireAuth();
  return { t, context, schoolId: context.currentSchool?.id };
}

/** Works out a class's results for a term. */
export async function computeBulletinsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await bulletinContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.BULLETIN_COMPUTE);

    const parsed = bulletinScopeSchema(t).safeParse({
      schoolClassId: field(formData, "schoolClassId"),
      termId: field(formData, "termId"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const result = await computeClassBulletins(
      context,
      parsed.data.schoolClassId,
      parsed.data.termId,
    );

    if (!result.ok) {
      return failure(
        result.reason === "term-mismatch"
          ? t.bulletin.termMismatch
          : result.reason === "no-roster"
            ? t.bulletin.noRoster
            : result.reason === "no-programme"
              ? t.bulletin.noProgramme
              : t.errors.notFound,
      );
    }

    refresh();
    return success(
      result.skipped === 0
        ? interpolate(t.bulletin.computed, { count: result.computed })
        : interpolate(t.bulletin.computedWithSkipped, {
            count: result.computed,
            skipped: result.skipped,
          }),
    );
  });
}

/**
 * Issues a class's bulletins to families, or takes them back.
 *
 * One action for both directions rather than two: they are the same decision
 * with a sign, they need the same permission, and splitting them would mean two
 * places to keep the scoping right.
 */
export async function publishBulletinsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await bulletinContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.BULLETIN_PUBLISH);

    const parsed = bulletinScopeSchema(t).safeParse({
      schoolClassId: field(formData, "schoolClassId"),
      termId: field(formData, "termId"),
    });
    if (!parsed.success) return failure(t.errors.invalid);

    const publish = field(formData, "intent") !== "withdraw";

    const result = await setClassPublication(
      context,
      parsed.data.schoolClassId,
      parsed.data.termId,
      publish,
    );
    if (!result.ok) return failure(t.errors.notFound);
    if (result.changed === 0) return failure(t.bulletin.nothingToPublish);

    refresh();
    return success(
      interpolate(publish ? t.bulletin.published : t.bulletin.withdrawn, {
        count: result.changed,
      }),
    );
  });
}

/**
 * A teacher's appreciation on one subject line.
 *
 * BULLETIN_APPRECIATE, deliberately not BULLETIN_COUNCIL: writing a line about
 * a pupil in your own subject is not the same authority as deciding they repeat
 * the year, and a single code would hand over both.
 */
export async function saveAppreciationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await bulletinContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.BULLETIN_APPRECIATE);

    const parsed = appreciationSchema(t).safeParse({
      id: field(formData, "id"),
      appreciation: field(formData, "appreciation"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const result = await saveAppreciation(
      context,
      parsed.data.id,
      parsed.data.appreciation,
    );
    if (!result.ok) {
      return failure(
        result.reason === "published"
          ? t.bulletin.publishedLocked
          : t.errors.notFound,
      );
    }

    refresh();
    return success(t.bulletin.saved);
  });
}

/** The council's mention, decision and closing notes on one pupil's term. */
export async function saveCouncilAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await bulletinContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.BULLETIN_COUNCIL);

    const parsed = councilSchema(t).safeParse({
      id: field(formData, "id"),
      mention: choice(formData, "mention"),
      decision: choice(formData, "decision"),
      councilComment: field(formData, "councilComment"),
      mainTeacherComment: field(formData, "mainTeacherComment"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const { id, ...decision } = parsed.data;
    const result = await saveCouncilDecision(context, id, decision);
    if (!result.ok) {
      return failure(
        result.reason === "published"
          ? t.bulletin.publishedLocked
          : t.errors.notFound,
      );
    }

    refresh();
    return success(t.bulletin.saved);
  });
}
