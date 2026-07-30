import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SchoolForm } from "@/components/schools/school-form";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

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

  const school = await db.school.findFirst({
    where: { id: schoolId, organizationId: context.organization.id },
    include: { _count: { select: { schoolYears: true, memberships: true } } },
  });
  if (!school) notFound();

  return (
    <>
      <PageHeader
        title={school.name}
        description={t.school.editSchool}
        backHref="/schools"
        backLabel={t.nav.schools}
      />
      <SchoolForm
        school={{
          id: school.id,
          code: school.code,
          name: school.name,
          level: school.level,
          directorName: school.directorName,
          capacity: school.capacity,
          email: school.email,
          phone: school.phone,
          website: school.website,
          addressLine: school.addressLine,
          city: school.city,
          region: school.region,
          postalCode: school.postalCode,
          country: school.country,
          isActive: school.isActive,
          yearCount: school._count.schoolYears,
          memberCount: school._count.memberships,
        }}
      />
    </>
  );
}
