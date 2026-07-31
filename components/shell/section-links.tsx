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
        <Link key={link.href} href={link.href} className="group">
          <Card className="hover:border-primary/40 h-full gap-0 py-4 transition-colors">
            <CardContent className="flex items-start gap-3 px-4">
              <span className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors">
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

              <ArrowRightIcon className="text-muted-foreground/60 rtl-flip mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
