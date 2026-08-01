"use client";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * A list's status, said in words and in colour — never in colour alone.
 *
 * Approved is the only one that means anything outside the staffroom, so it is
 * the only one that gets a positive colour; the rest are states of a decision
 * still in progress.
 */
const STYLES: Record<string, string> = {
  DRAFT: "text-muted-foreground",
  SUBMITTED: "text-warning border-warning/40",
  APPROVED: "text-success border-success/40",
  REJECTED: "text-destructive border-destructive/40",
};

export function SupplyStatusBadge({ status }: { status: string }) {
  const t = useT();
  const label =
    t.supplyOptions.statuses[
      status as keyof typeof t.supplyOptions.statuses
    ] ?? status;

  return (
    <Badge variant="outline" className={cn(STYLES[status])}>
      {label}
    </Badge>
  );
}
