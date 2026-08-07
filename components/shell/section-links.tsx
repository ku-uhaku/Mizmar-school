import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The screens a section holds, as cards on that section's dashboard.
 *
 * Every section — vie scolaire, caisse, logistique, RH — opens on an overview
 * and then leads somewhere, and the sidebar alone does not say what the screens
 * are *for*. These cards carry that sentence, so the dashboard reads as the way
 * into the section rather than as a wall of figures with the links elsewhere.
 *
 * Domain-free on purpose: callers pass already-resolved labels and hrefs, and
 * filter the list by permission before handing it over — a card rendered here is
 * a screen the reader may actually open.
 *
 * ── The colour comes from where the reader already is ───────────────────────
 * Unlike the four cards on the main dashboard, these all belong to one section
 * — every card on /transport leads somewhere in logistique — so they take
 * `--section` from the page rather than deriving it per card. `SectionScope`
 * has already bound it in the dashboard layout, which is why nothing here
 * knows or is told which section it is in: the same markup comes out blue on
 * /school-life and orange on /transport.
 */
export type SectionLink = {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** Short figure shown on the right, e.g. a count or "3 late". */
  badge?: string;
  /** Draws the badge as a warning rather than as a neutral count. */
  badgeTone?: "warn";
};

export function SectionLinks({
  links,
  className,
}: {
  links: SectionLink[];
  className?: string;
}) {
  if (links.length === 0) return null;

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {links.map((link) => (
        // Keyed on the label as well as the href, because two cards legitimately
        // lead to the same screen: vie scolaire offers both "Élèves" and
        // "Assiduité", and the register has no whole-school page of its own to
        // point at. The href alone was a duplicate key, which React answers by
        // dropping one of the two cards.
        <Link
          key={`${link.href}:${link.label}`}
          href={link.href}
          className="group"
        >
          <Card className="border-section/25 bg-section/10 hover:border-section/55 hover:bg-section/[0.16] h-full gap-0 py-4 transition-colors">
            <CardContent className="flex items-start gap-3 px-4">
              <span className="bg-section/12 text-section flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-section/20">
                {link.icon}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {link.label}
                  </span>
                  {link.badge ? (
                    <Badge
                      variant={
                        link.badgeTone === "warn" ? "destructive" : "secondary"
                      }
                      className="shrink-0 tabular-nums"
                    >
                      {link.badge}
                    </Badge>
                  ) : null}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs text-pretty">
                  {link.description}
                </span>
              </span>

              <ArrowRightIcon className="text-section/70 rtl-flip mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
