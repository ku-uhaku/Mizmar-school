import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { CampaignProgress } from "@/modules/messaging/components/campaign-progress";
import { findCampaign } from "@/modules/messaging/queries";

export const metadata: Metadata = { title: "Relances de paiement" };

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.MESSAGING_SEND)) return <ForbiddenState />;

  // Scoped to the school in the session, so another school's id finds nothing.
  const campaign = await findCampaign(context, campaignId);
  if (!campaign) notFound();

  return (
    <>
      <PageHeader
        title={t.messaging.title}
        backHref="/caisse/relances"
        backLabel={t.messaging.campaigns.back}
      />
      <CampaignProgress campaign={campaign} />
    </>
  );
}
