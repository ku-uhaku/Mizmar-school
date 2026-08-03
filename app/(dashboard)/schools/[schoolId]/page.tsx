import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SchoolForm } from "@/modules/schools/components/school-form";
import { SchoolSetupCta } from "@/modules/schools/components/setup-cta";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { findSchool } from "@/modules/schools/queries";

export const metadata: Metadata = { title: "Modifier l'école" };

export default async function EditSchoolPage(
  props: PageProps<"/schools/[schoolId]">,
) {
  const { schoolId } = await props.params;
  const context = await requireAuth();
  const t = await getDictionary();

  // Only schools this user can see, and only if they may edit this one.
  const visible = context.schools.some((school) => school.id === schoolId);
  if (!visible) notFound();

  if (!context.canInSchool(schoolId, PERMISSIONS.SCHOOL_UPDATE)) {
    return <ForbiddenState />;
  }

  const school = await findSchool(context, schoolId);
  if (!school) notFound();

  return (
    <>
      <PageHeader
        title={school.name}
        description={t.school.editSchool}
        backHref="/schools"
        backLabel={t.nav.schools}
      />
      <div className="mb-6">
        <SchoolSetupCta
          schoolId={school.id}
          isCurrent={context.currentSchool?.id === school.id}
        />
      </div>
      <SchoolForm school={school} />
    </>
  );
}
