import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { setupSnapshot } from "@/modules/setup/queries";
import { SetupWizard } from "@/modules/setup/components/setup-wizard";

export const metadata: Metadata = { title: "Configuration de l'école" };

export default async function SchoolSetupPage(
  props: PageProps<"/schools/[schoolId]/setup">,
) {
  const { schoolId } = await props.params;
  const context = await requireAuth();
  const t = await getDictionary();

  // Existence of a school in another tenant is not something to confirm with a
  // 403 — `findSchool` takes the same line.
  if (!context.schools.some((school) => school.id === schoolId)) notFound();

  if (!context.canInSchool(schoolId, PERMISSIONS.CONFIGURATION_MANAGE)) {
    return <ForbiddenState />;
  }

  const snapshot = await setupSnapshot(context, schoolId);
  if (!snapshot) notFound();

  return (
    <>
      <PageHeader
        title={t.setup.titleExisting}
        description={t.setup.subtitleExisting}
        backHref={`/schools/${schoolId}`}
        backLabel={snapshot.school.name}
      />
      <SetupWizard mode="existing" snapshot={snapshot} settings={snapshot.settings} />
    </>
  );
}
