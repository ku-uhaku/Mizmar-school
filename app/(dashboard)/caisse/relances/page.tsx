import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { formatDateTime } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ReminderComposer } from "@/modules/messaging/components/reminder-composer";
import { listCampaigns, loadReminderScreen } from "@/modules/messaging/queries";

export const metadata: Metadata = { title: "Relances de paiement" };

/** Who is late, what to tell them, and what has already been sent. */
export default async function RemindersPage() {
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.MESSAGING_SEND)) return <ForbiddenState />;

  const [screen, campaigns] = await Promise.all([
    loadReminderScreen(context),
    listCampaigns(context),
  ]);
  const m = t.messaging;

  return (
    <>
      <PageHeader
        title={m.title}
        description={m.subtitle}
        backHref="/caisse"
        backLabel={m.backToCaisse}
      />

      <ReminderComposer screen={screen} />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{m.campaigns.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {m.campaigns.empty}
            </p>
          ) : (
            <ul className="divide-y">
              {campaigns.map((campaign) => (
                <li key={campaign.id}>
                  <Link
                    href={`/caisse/relances/${campaign.id}`}
                    className="hover:bg-muted/50 -mx-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 py-3 text-sm"
                  >
                    <span>{formatDateTime(campaign.createdAt, locale)}</span>
                    <Badge
                      variant={
                        campaign.status === "PAUSED" ? "destructive" : "secondary"
                      }
                    >
                      {
                        m.campaignStatus[
                          campaign.status as keyof typeof m.campaignStatus
                        ]
                      }
                    </Badge>
                    <span className="ms-auto tabular-nums">
                      {campaign.sent}/{campaign.total}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
