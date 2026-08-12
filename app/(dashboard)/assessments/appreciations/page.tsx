import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { AppreciationScale } from "@/modules/assessments/components/appreciation-scale";
import { listAppreciationScale } from "@/modules/assessments/queries";

export const metadata: Metadata = { title: "Appréciations" };

/**
 * The wording beside a mark, and where each rung starts.
 *
 * Under `/assessments` rather than `/configuration` on purpose. Configuration
 * is one permission pair covering all fourteen of its screens, and this is the
 * one piece of setup a school wants its *teachers* able to touch — putting it
 * there would mean handing over the fee grid to reword "Assez bien". So it sits
 * where the marks are, gated on its own code.
 */
export default async function AppreciationsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  // Anybody who marks may read the scale — the mark sheet fills it in for them.
  // Changing it is the narrower grant, and the form checks it again server-side.
  if (
    !context.can(PERMISSIONS.ASSESSMENT_VIEW) &&
    !context.can(PERMISSIONS.ASSESSMENT_SCALE)
  ) {
    return <ForbiddenState />;
  }

  const bands = await listAppreciationScale(context);

  return (
    <>
      <PageHeader
        title={t.assessment.scaleTitle}
        description={t.assessment.scaleSubtitle}
        backHref="/assessments"
        backLabel={t.assessment.title}
      />

      <AppreciationScale
        bands={bands}
        canManage={context.can(PERMISSIONS.ASSESSMENT_SCALE)}
      />
    </>
  );
}
