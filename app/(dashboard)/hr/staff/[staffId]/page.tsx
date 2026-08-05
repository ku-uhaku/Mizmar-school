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
