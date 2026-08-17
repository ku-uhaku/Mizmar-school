import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { RecordHistoryPanel } from "@/modules/audit/components/record-history-panel";
import { StaffPanel } from "@/modules/hr/components/staff-panel";
import { listSchoolRoles } from "@/modules/access/queries";
import { findStaff, listLinkableUsers } from "@/modules/hr/queries";

export const metadata: Metadata = { title: "Employé" };

export default async function StaffPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped to the school in context; an employee of another school reads as
  // absent rather than forbidden, so their existence cannot be probed.
  const person = await findStaff(context, staffId);
  if (!person) notFound();

  const canManage = context.can(PERMISSIONS.HR_MANAGE);
  // Only loaded for a reader who may actually link an account to a record. The
  // employee's own account is passed so it stays in its own picker.
  const linkableUsers = canManage
    ? await listLinkableUsers(context, person.userId)
    : [];
  // Only for a reader who may mint a login, and only useful when this employee
  // has none — the dialog hides the switch otherwise.
  const schoolRoles =
    context.can(PERMISSIONS.USER_CREATE) && !person.userId
      ? await listSchoolRoles(context)
      : [];

  /*
    Where this file could be moved to, if the person was hired into the wrong
    school. Filtered off the context rather than queried, and by the same pair of
    conditions `transferStaffAction` re-derives for itself: visible to this
    session, and `hr.manage` inside it.
  */
  const transferTargets = canManage
    ? context.schools
        .filter(
          (school) =>
            school.id !== context.currentSchool?.id &&
            context.canInSchool(school.id, PERMISSIONS.HR_MANAGE),
        )
        .map((school) => ({ id: school.id, name: school.name }))
    : [];

  return (
    <>
      <PageHeader
        title={person.fullName}
        description={person.jobTitle ?? undefined}
        backHref="/hr/staff"
        backLabel={t.hr.staff}
      >
        <Badge variant={person.status === "ACTIVE" ? "secondary" : "outline"}>
          {
            t.hrOptions.staffStatuses[
              person.status as keyof typeof t.hrOptions.staffStatuses
            ]
          }
        </Badge>
      </PageHeader>

      <StaffPanel
        person={person}
        linkableUsers={linkableUsers}
        schoolRoles={schoolRoles}
        transferTargets={transferTargets}
        canCreateAccount={context.can(PERMISSIONS.USER_CREATE)}
        canPayroll={context.can(PERMISSIONS.HR_PAYROLL)}
        canManage={canManage}
      />

      <RecordHistoryPanel
        context={context}
        entity="Staff"
        entityId={person.id}
      />
    </>
  );
}
