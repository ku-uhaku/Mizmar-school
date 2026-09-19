import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { CreditsManager } from "@/modules/messaging/components/credits-manager";
import { loadCreditsOverview } from "@/modules/messaging/queries";
import { isCreditOwner } from "@/modules/messaging/service";

export const metadata: Metadata = { title: "Crédits de messages" };

export default async function CreditsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  // A page that does not exist, rather than one that says it is forbidden:
  // that there is an owner is not something a school needs to be told.
  if (!isCreditOwner(context.user)) notFound();

  const overview = await loadCreditsOverview(context);

  return (
    <>
      <PageHeader
        title={t.messaging.creditsPage.title}
        description={t.messaging.creditsPage.subtitle}
        backHref="/caisse/relances"
        backLabel={t.messaging.title}
      />
      <CreditsManager overview={overview} />
    </>
  );
}
