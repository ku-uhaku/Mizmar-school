import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { FamilyDetail } from "@/modules/families/components/family-detail";
import { findFamily } from "@/modules/families/queries";

export const metadata: Metadata = { title: "Famille" };

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.FAMILY_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped to the school in context; a dossier from elsewhere reads as absent
  // rather than forbidden, so its existence cannot be probed.
  const family = await findFamily(context, familyId);
  if (!family) notFound();

  return (
    <>
      <PageHeader
        title={family.name}
        description={family.code}
        backHref="/families"
        backLabel={t.family.title}
      >
        <Badge variant={family.isActive ? "secondary" : "outline"}>
          {family.isActive ? t.common.active : t.common.inactive}
        </Badge>
      </PageHeader>

      <FamilyDetail
        family={family}
        canManage={context.can(PERMISSIONS.FAMILY_UPDATE)}
      />
    </>
  );
}
