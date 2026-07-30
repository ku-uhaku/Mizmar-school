"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { withActionErrors } from "@/lib/server-action";
import { defaultSchoolYearFor } from "@/modules/school-years/queries";

/**
 * The working context (current school + school year) lives on the User row, not
 * in a cookie, so it cannot be forged by the client and follows the user across
 * devices. Both actions re-derive what the user may reach from the session.
 */

export async function switchSchoolAction(schoolId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    // Never trust the id from the client: it must be one of the schools this
    // user can actually see.
    const school = context.schools.find((entry) => entry.id === schoolId);
    if (!school) return failure(t.errors.forbidden);

    // Move to a sensible year in the new school rather than keeping a year that
    // belongs to the school we just left.
    const nextYear = await defaultSchoolYearFor(school.id);

    await db.user.update({
      where: { id: context.user.id },
      data: {
        currentSchoolId: school.id,
        currentSchoolYearId: nextYear?.id ?? null,
      },
    });

    refresh();
    return success(t.context.switched);
  });
}

export async function switchSchoolYearAction(
  schoolYearId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    if (!context.currentSchool) return failure(t.errors.noSchoolContext);

    // The year has to belong to the school currently in context.
    const year = await db.schoolYear.findFirst({
      where: { id: schoolYearId, schoolId: context.currentSchool.id },
      select: { id: true },
    });
    if (!year) return failure(t.errors.forbidden);

    await db.user.update({
      where: { id: context.user.id },
      data: { currentSchoolYearId: year.id },
    });

    refresh();
    return success(t.context.switched);
  });
}
