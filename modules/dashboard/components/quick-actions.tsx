"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sectionForPath } from "@/lib/nav";

/**
 * The handful of things people do all day, one press from anywhere.
 *
 * ── In the header, not on the dashboard ─────────────────────────────────────
 * These are the starts of the jobs the school runs on — take a payment, open a
 * dossier, enrol a child, mark the register. Somebody needing one of them is
 * rarely on the dashboard when they think of it: they are halfway through a
 * class list when a parent arrives at the desk. On the header it is reachable
 * from every screen, and it costs the dashboard no space at all.
 *
 * ── Why a fixed list and not favourites ─────────────────────────────────────
 * A secretary does the same three every morning, and a list they have to curate
 * first is a list most people never curate. Starred favourites are the right
 * answer for the reports, where fifty screens compete and everybody wants a
 * different six; here the set is small and known.
 *
 * ── Filtered where it is built, not here ────────────────────────────────────
 * The layout drops any action the reader may not perform before handing the
 * list over, so an item rendered here is one that will actually work — the same
 * contract `SectionLinks` keeps. A reader who may do none of them gets no
 * button at all rather than an empty menu.
 *
 * Each item's icon takes its destination's own section colour, derived from the
 * href exactly as `SectionCard` does, so "Encaissement" is the caisse's teal
 * wherever it appears.
 */
export type QuickAction = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const t = useT();

  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t.dashboard.quickActions}>
          <PlusIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t.dashboard.quickActions}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => (
          <DropdownMenuItem key={action.href} asChild>
            <Link
              href={action.href}
              data-section={sectionForPath(action.href) ?? undefined}
            >
              <span className="text-section flex size-4 shrink-0 items-center justify-center">
                {action.icon}
              </span>
              {action.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
