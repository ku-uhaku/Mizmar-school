"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { copyProgramme } from "@/modules/academics/service";

/**
 * Actions for the cursus.
 *
 * The only one so far is the copy: everything else about a niveau or a matière
 * is edited through the generic configuration resource, which has its own
 * authorized action.
 */

/**
 * Fills this year's programme from another year of the same school.
 *
 * The target is the year in context and never a posted id — the screen the
 * button sits on is already showing one year, and taking the target from the
 * request would let a crafted POST write into a year the user is not working
 * in. The source *is* posted, so it is re-derived against the school before a
 * single row is read.
 */
export async function copyProgrammeAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const targetYearId = context.currentSchoolYear?.id;
    if (!targetYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.CONFIGURATION_MANAGE);

    const sourceYearId = field(formData, "sourceYearId");
    if (!sourceYearId || sourceYearId === targetYearId) {
      return failure(t.errors.invalid);
    }

    // The source year has to be this school's own. Scoped by the school rather
    // than checked afterwards, so a year from another tenant is indistinguish-
    // able from one that does not exist.
    const source = await db.schoolYear.findFirst({
      where: { id: sourceYearId, schoolId },
      select: { id: true, name: true },
    });
    if (!source) return failure(t.errors.notFound);

    const copied = await copyProgramme(source.id, targetYearId);

    refresh();
    return success(
      interpolate(t.configuration.programmeCopied, {
        count: copied,
        year: source.name,
      }),
    );
  });
}
