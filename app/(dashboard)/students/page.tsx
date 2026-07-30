import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { StudentsManager } from "@/modules/students/components/students-manager";
import { listStudents } from "@/modules/students/queries";

export const metadata: Metadata = { title: "Élèves" };

export default async function StudentsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.STUDENT_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped to the school in context; placement comes from the year in context.
  const students = await listStudents(context);

  return (
    <>
      <PageHeader title={t.student.title} description={t.student.subtitle} />

      <StudentsManager
        students={students}
        permissions={{
          canCreate: context.can(PERMISSIONS.STUDENT_CREATE),
          canUpdate: context.can(PERMISSIONS.STUDENT_UPDATE),
          canDelete: context.can(PERMISSIONS.STUDENT_DELETE),
        }}
      />
    </>
  );
}
