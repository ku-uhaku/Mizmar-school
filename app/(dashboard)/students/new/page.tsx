import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listFamilyChoices } from "@/modules/families/queries";
import { listCityChoices } from "@/modules/geography/queries";
import { StudentForm } from "@/modules/students/components/student-form";

export const metadata: Metadata = { title: "Nouvel élève" };

export default async function NewStudentPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.STUDENT_CREATE)) {
    return <ForbiddenState />;
  }

  // Cross-module read through the owner's queries — never a raw db call.
  const [families, cities] = await Promise.all([
    listFamilyChoices(context),
    listCityChoices(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.student.newStudent}
        description={t.student.identityHint}
        backHref="/students"
        backLabel={t.student.title}
      />

      <StudentForm families={families} cities={cities} />
    </>
  );
}
