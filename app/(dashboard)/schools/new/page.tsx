import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_SETTINGS } from "@/lib/school-settings";
import { SetupWizard } from "@/modules/setup/components/setup-wizard";

export const metadata: Metadata = { title: "Nouvelle école" };

export default async function NewSchoolPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  // Creating a school is organisation-wide; a school-scoped role never grants it.
  if (!context.canOrg(PERMISSIONS.SCHOOL_CREATE)) {
    return <ForbiddenState />;
  }

  return (
    <>
      <PageHeader
        title={t.setup.title}
        description={t.setup.subtitle}
        backHref="/schools"
        backLabel={t.nav.schools}
      />
      {/* No school yet, so the wizard starts from the app's own defaults — the
          same ones a school with no settings row behaves by. */}
      <SetupWizard mode="new" snapshot={null} settings={DEFAULT_SETTINGS} />
    </>
  );
}
