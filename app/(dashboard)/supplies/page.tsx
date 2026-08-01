import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listTimetableClasses } from "@/modules/timetable/queries";
import { listSubjectChoices } from "@/modules/supplies/queries";
import { SuppliesManager } from "@/modules/supplies/components/supplies-manager";
import { listSupplyLists } from "@/modules/supplies/queries";

export const metadata: Metadata = { title: "Fournitures" };

/**
 * The listes de fournitures of the year.
 *
 * Thin by the usual rule: it authorizes, reads, and renders. `canReview` is
 * computed here and passed into the query, because what a reader may see is a
 * permission decision and the query is where the scoping belongs.
 */
export default async function SuppliesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.SUPPLY_VIEW)) {
    return <ForbiddenState />;
  }

  const canReview = context.can(PERMISSIONS.SUPPLY_REVIEW);

  const [lists, classes, subjects] = await Promise.all([
    listSupplyLists(context, { canReview }),
    listTimetableClasses(context),
    listSubjectChoices(context),
  ]);

  return (
    <>
      <PageHeader title={t.supply.title} description={t.supply.subtitle} />

      <SuppliesManager
        lists={lists}
        classes={classes.map((schoolClass) => ({
          id: schoolClass.id,
          label: `${schoolClass.code} · ${schoolClass.levelLabel}`,
        }))}
        subjects={subjects}
        currentUserId={context.user.id}
        permissions={{
          canWrite: context.can(PERMISSIONS.SUPPLY_WRITE),
          canReview,
          canDelete: context.can(PERMISSIONS.SUPPLY_DELETE),
        }}
      />
    </>
  );
}
