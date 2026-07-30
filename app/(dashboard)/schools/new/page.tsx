import type { Metadata } from "next";

import { SchoolForm } from "@/modules/schools/components/school-form";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

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
        title={t.school.newSchool}
        description={t.school.subtitle}
        backHref="/schools"
        backLabel={t.nav.schools}
      />
      <SchoolForm />
    </>
  );
}
