import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ClassesManager } from "@/modules/classes/components/classes-manager";
import { listClasses } from "@/modules/classes/queries";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.CLASS_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped to the year in context inside listClasses.
  const classes = await listClasses(context);

  return (
    <>
      <PageHeader
        title={t.schoolClass.title}
        description={t.schoolClass.subtitle}
      />

      <ClassesManager classes={classes} />
    </>
  );
}
