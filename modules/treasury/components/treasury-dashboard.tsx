"use client";

import {
  ArrowLeftRightIcon,
  BanknoteArrowDownIcon,
  BanknoteArrowUpIcon,
  ReceiptTextIcon,
  WalletIcon,
} from "lucide-react";

import {
  SectionLinks,
  type SectionLink,
} from "@/components/shell/section-links";
import { useT } from "@/components/providers/i18n-provider";
import { useMoney } from "@/components/providers/settings-provider";
import { Card, CardContent } from "@/components/ui/card";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { TreasurySummary } from "@/modules/treasury/queries";
import { SectionHeading } from "@/components/shell/section-heading";

/**
 * The day's money, and the way into the four things a bursar does with it.
 *
 * The figures are coloured by direction rather than by size: money in reads
 * green, money out reads red, and cash sitting in a drawer stays neutral
 * because it is neither. The direction is also written in the label, so the
 * colour is reinforcement and never the only carrier.
 */
export function TreasuryDashboard({
  summary,
  permissions,
}: {
  summary: TreasurySummary;
  permissions: {
    canCollect: boolean;
    canDisburse: boolean;
    canTransfer: boolean;
    canCheques: boolean;
  };
}) {
  const t = useT();

  const money = useMoney();

  const links: SectionLink[] = [];

  if (permissions.canCollect) {
    links.push({
      href: "/caisse/encaissement",
      label: t.nav.encaissement,
      description: t.treasury.encaissementSubtitle,
      icon: <BanknoteArrowDownIcon className="size-4" />,
    });
  }
  if (permissions.canDisburse) {
    links.push({
      href: "/caisse/decaissement",
      label: t.nav.decaissement,
      description: t.treasury.decaissementSubtitle,
      icon: <BanknoteArrowUpIcon className="size-4" />,
    });
  }
  if (permissions.canTransfer) {
    links.push({
      href: "/caisse/transfert",
      label: t.nav.transfert,
      description: t.treasury.transfertSubtitle,
      icon: <ArrowLeftRightIcon className="size-4" />,
    });
  }
  if (permissions.canCheques) {
    links.push({
      href: "/caisse/cheques",
      label: t.nav.cheques,
      description: t.treasury.chequesSubtitle,
      icon: <ReceiptTextIcon className="size-4" />,
      badge:
        summary.chequesBouncedCount > 0
          ? interpolate(t.treasury.bouncedCount, {
              count: summary.chequesBouncedCount,
            })
          : String(summary.chequesPendingCount),
      badgeTone: summary.chequesBouncedCount > 0 ? "warn" : undefined,
    });
  }

  return (
    <div className="grid gap-5">
      {/* The same bands the main dashboard uses: what the figures say, then the
        way into the section. This one has no third band — the caisse's own
        tables sit on the page below it, headed there. */}
      <section className="grid gap-3">
        <SectionHeading label={t.bands.overview} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MoneyTile
            label={t.treasury.inDrawer}
            value={money(summary.drawerCentimes)}
            hint={interpolate(t.treasury.openRegisterCount, {
              count: summary.openRegisterCount,
            })}
            icon={<WalletIcon className="size-4" />}
          />
          <MoneyTile
            label={t.treasury.collectedToday}
            value={money(summary.collectedTodayCentimes)}
            hint={t.treasury.todayHint}
            icon={<BanknoteArrowDownIcon className="size-4" />}
            tone="in"
          />
          <MoneyTile
            label={t.treasury.disbursedToday}
            value={money(summary.disbursedTodayCentimes)}
            hint={t.treasury.todayHint}
            icon={<BanknoteArrowUpIcon className="size-4" />}
            tone="out"
          />
          <MoneyTile
            label={t.treasury.chequesPending}
            value={money(summary.chequesPendingCentimes)}
            hint={
              summary.chequesBouncedCount > 0
                ? interpolate(t.treasury.bouncedCount, {
                    count: summary.chequesBouncedCount,
                  })
                : interpolate(t.treasury.heldCount, {
                    count: summary.chequesPendingCount,
                  })
            }
            icon={<ReceiptTextIcon className="size-4" />}
            tone={summary.chequesBouncedCount > 0 ? "bad" : "held"}
          />
        </div>
      </section>

      <section className="grid gap-3">
        <SectionHeading label={t.bands.goTo} />
        <SectionLinks links={links} />
      </section>
    </div>
  );
}

/**
 * A money figure with its direction worn as colour.
 *
 * Kept apart from `StatTile` on purpose: that one formats a *count* and takes a
 * number, and putting a currency through it would print a wage bill with a
 * thousands separator meant for pupils.
 */
function MoneyTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "in" | "out" | "held" | "bad";
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-5",
        tone === "in" && "border-success/30",
        tone === "out" && "border-series-2/40",
        tone === "held" && "border-warning/30",
        tone === "bad" && "border-destructive/40",
      )}
    >
      <CardContent className="px-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-muted-foreground text-sm">{label}</p>
          <span
            className={cn(
              "shrink-0",
              tone === "in" && "text-success",
              tone === "out" && "text-series-2",
              tone === "held" && "text-warning",
              tone === "bad" && "text-destructive",
              !tone && "text-muted-foreground/70",
            )}
          >
            {icon}
          </span>
        </div>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold",
            tone === "bad" && "text-destructive",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
