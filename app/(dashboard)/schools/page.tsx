import type { Metadata } from "next";

import { SchoolsManager } from "@/components/schools/schools-manager";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Écoles" };

export default async function SchoolsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.SCHOOL_VIEW)) {
    return <ForbiddenState />;
  }

  // Only the schools this user can see, with the counts the table shows.
  const schools = await db.school.findMany({
    where: { id: { in: context.schools.map((school) => school.id) } },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { schoolYears: true, memberships: true } },
    },
  });

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
        schools={schools.map((school) => ({
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
        }))}
      />
    </>
  );
}
