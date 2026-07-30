import type { Metadata } from "next";

import { SchoolsManager } from "@/modules/schools/components/schools-manager";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listSchools } from "@/modules/schools/queries";

export const metadata: Metadata = { title: "Écoles" };

export default async function SchoolsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.SCHOOL_VIEW)) {
    return <ForbiddenState />;
  }

  const schools = await listSchools(context);

  return (
    <>
      <PageHeader title={t.school.title} description={t.school.subtitle} />

      <SchoolsManager
        currentSchoolId={context.currentSchool?.id ?? null}
        permissions={{
          canCreate: context.canOrg(PERMISSIONS.SCHOOL_CREATE),
          canDelete: context.canOrg(PERMISSIONS.SCHOOL_DELETE),
          // Resolved per school so a director sees an Edit action only on
          // the school they actually run.
          editableIds: schools
            .filter((school) =>
              context.canInSchool(school.id, PERMISSIONS.SCHOOL_UPDATE),
            )
            .map((school) => school.id),
        }}
        schools={schools}
      />
    </>
  );
}
