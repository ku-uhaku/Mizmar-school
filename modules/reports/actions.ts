"use server";

import { revalidatePath } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { field, withActionErrors } from "@/lib/server-action";
import { findReport } from "@/modules/reports/catalogue";

/**
 * Stars a report, or unstars one already starred.
 *
 * ── Why the permission checked is the report's own ──────────────────────────
 * A star is only a shortcut, but it is a shortcut *to* something: letting
 * somebody pin the payroll they may not read would put its title on their
 * screen, and a list of report names is itself a small leak. So this asks for
 * exactly what running it asks for — the same rule `runReport` follows.
 *
 * Toggles rather than taking a desired state, because the button the user
 * presses says "star this" and the only thing it can mean is "the opposite of
 * now". A form that posted `starred=true` would fight itself on a double click.
 */
export async function toggleReportFavouriteAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const context = await requireAuth();
    const t = await getDictionary();

    const reportId = field(formData, "reportId");
    const definition = findReport(reportId);
    if (!definition) return failure(t.errors.notFound);
    if (!context.can(definition.permission as never)) {
      return failure(t.errors.forbidden);
    }

    const existing = await db.reportFavourite.findUnique({
      where: {
        userId_reportId: { userId: context.user.id, reportId },
      },
      select: { id: true },
    });

    if (existing) {
      await db.reportFavourite.delete({ where: { id: existing.id } });
    } else {
      await db.reportFavourite.create({
        data: { userId: context.user.id, reportId },
      });
    }

    // Both screens show the star, and the index also *reorders* around it.
    revalidatePath("/reports");
    revalidatePath(`/reports/${reportId}`);

    return success(existing ? t.report.unstarred : t.report.starred);
  });
}
