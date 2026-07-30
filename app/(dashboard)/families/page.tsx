import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { FamiliesManager } from "@/modules/families/components/families-manager";
import { listFamilies } from "@/modules/families/queries";

export const metadata: Metadata = { title: "Familles" };

export default async function FamiliesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.FAMILY_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped to the school in context inside listFamilies.
  const families = await listFamilies(context);

  return (
    <>
      <PageHeader title={t.family.title} description={t.family.subtitle} />

      <FamiliesManager
        families={families}
        permissions={{
          canCreate: context.can(PERMISSIONS.FAMILY_CREATE),
          canUpdate: context.can(PERMISSIONS.FAMILY_UPDATE),
          canDelete: context.can(PERMISSIONS.FAMILY_DELETE),
        }}
      />
    </>
  );
}
