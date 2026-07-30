import type { Metadata } from "next";
import { SchoolIcon } from "lucide-react";

import { SchoolYearsManager } from "@/modules/school-years/components/school-years-manager";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { interpolate, toDateInputValue } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Années scolaires" };

export default async function SchoolYearsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.SCHOOL_YEAR_VIEW)) {
    return <ForbiddenState />;
  }

  const school = context.currentSchool;

  // This page is inherently scoped to one school, so it needs a context first.
  if (!school) {
    return (
      <>
        <PageHeader
          title={t.schoolYear.title}
          description={t.schoolYear.subtitleNoSchool}
        />
        <div className="rounded-xl border">
          <EmptyState
            icon={<SchoolIcon className="size-5" />}
            title={t.context.noSchoolSelected}
            description={t.errors.noSchoolContext}
          />
        </div>
      </>
    );
  }

  // Already loaded by the DAL for the context switcher — no second query.
  const years = context.schoolYears;

  return (
    <>
      <PageHeader
        title={t.schoolYear.title}
        description={interpolate(t.schoolYear.subtitle, { school: school.name })}
      />

      <SchoolYearsManager
        currentYearId={context.currentSchoolYear?.id ?? null}
        permissions={{
          canCreate: context.can(PERMISSIONS.SCHOOL_YEAR_CREATE),
          canUpdate: context.can(PERMISSIONS.SCHOOL_YEAR_UPDATE),
          canDelete: context.can(PERMISSIONS.SCHOOL_YEAR_DELETE),
        }}
        years={years.map((year) => ({
          id: year.id,
          name: year.name,
          // `<input type="date">` needs a plain YYYY-MM-DD string.
          startDate: toDateInputValue(year.startDate),
          endDate: toDateInputValue(year.endDate),
          status: year.status,
          isDefault: year.isDefault,
        }))}
      />
    </>
  );
}
