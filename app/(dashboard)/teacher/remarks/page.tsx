import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { RemarksManager } from "@/modules/classroom/components/remarks-manager";
import {
  listMyPupils,
  listMyTeaching,
  listRemarks,
} from "@/modules/classroom/queries";

export const metadata: Metadata = { title: "Remarques" };

/** The carnet: what this teacher has noticed about the pupils they teach. */
export default async function TeacherRemarksPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.CLASSROOM_REMARK_VIEW)) {
    return <ForbiddenState />;
  }

  const [remarks, pupils, teaching] = await Promise.all([
    listRemarks(context),
    listMyPupils(context),
    listMyTeaching(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.classroom.remarks}
        description={t.classroom.remarksHint}
        backHref="/teacher"
        backLabel={t.classroom.title}
      />

      <RemarksManager
        remarks={remarks}
        pupils={pupils}
        teaching={teaching}
        permissions={{
          canWrite: context.can(PERMISSIONS.CLASSROOM_REMARK_WRITE),
          canPublish: context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH),
        }}
      />
    </>
  );
}
