"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { toastError } from "@/components/form/toast-error";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  cancelCampaignAction,
  resumeCampaignAction,
} from "@/modules/messaging/actions";
import type { CampaignDetail } from "@/modules/messaging/queries";

const OPEN = ["QUEUED", "RUNNING", "PAUSED"];

/**
 * One campaign: its counts, and each household's outcome.
 *
 * Refreshes itself while the campaign is open. The sender runs in the
 * background, so the only way this page learns anything is by asking again.
 */
export function CampaignProgress({ campaign }: { campaign: CampaignDetail }) {
  const { t, locale } = useI18n();
  const m = t.messaging;
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const open = OPEN.includes(campaign.status);

  React.useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(timer);
  }, [open, router]);

  const run = (
    action: () => Promise<{ status: string; message?: string }>,
  ) =>
    startTransition(async () => {
      const result = await action();
      if (result.status === "success" && result.message) {
        toast.success(result.message);
      }
      if (result.status === "error") {
        toastError(result.message ?? t.errors.unexpected);
      }
    });

  const tiles: [string, number, boolean?][] = [
    [m.campaigns.recipients, campaign.total],
    [m.campaigns.sent, campaign.sent],
    [m.campaigns.pending, campaign.pending],
    [m.campaigns.failed, campaign.failed, campaign.failed > 0],
    [m.campaigns.cancelled, campaign.cancelled],
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant={campaign.status === "PAUSED" ? "destructive" : "secondary"}
        >
          {m.campaignStatus[campaign.status as keyof typeof m.campaignStatus]}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {formatDateTime(campaign.createdAt, locale)}
        </span>
        <div className="ms-auto flex gap-2">
          {campaign.status === "PAUSED" ? (
            <Button
              disabled={pending}
              onClick={() => run(() => resumeCampaignAction(campaign.id))}
            >
              {m.resume}
            </Button>
          ) : null}
          {open ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => cancelCampaignAction(campaign.id))}
            >
              {m.cancel}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {tiles.map(([label, value, alarming]) => (
          <div
            key={label}
            className="bg-card ring-foreground/10 rounded-xl p-4 ring-1"
          >
            <p className="text-muted-foreground text-xs">{label}</p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                alarming && "text-destructive",
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableBody>
            {campaign.deliveries.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell className="font-medium">
                  {delivery.familyName}
                </TableCell>
                <TableCell dir="ltr" className="text-muted-foreground">
                  +{delivery.phone}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      delivery.status === "FAILED"
                        ? "destructive"
                        : delivery.status === "SENT"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {
                      m.deliveryStatus[
                        delivery.status as keyof typeof m.deliveryStatus
                      ]
                    }
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {delivery.sentAt
                    ? formatDateTime(delivery.sentAt, locale)
                    : delivery.error}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
