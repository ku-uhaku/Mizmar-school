import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { FamilyForm } from "@/modules/families/components/family-form";

export const metadata: Metadata = { title: "Nouvelle famille" };

export default async function NewFamilyPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.FAMILY_CREATE)) {
    return <ForbiddenState />;
  }

  return (
    <>
      <PageHeader
        title={t.family.newFamily}
        description={t.family.subtitle}
        backHref="/families"
        backLabel={t.family.title}
      />

      <FamilyForm />
    </>
  );
}
