import { FlaskConicalIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Wrapper for a widget whose numbers are placeholders.
 *
 * The badge is the point. The academic tables do not exist yet, so these
 * figures are invented — and an invented figure that looks live is how someone
 * ends up quoting 1,302 students in a meeting. Every widget fed from
 * `lib/dashboard-preview.ts` goes in one of these, and the badge comes off in
 * the same change that wires the widget to a real query.
 */
export function PreviewCard({
  title,
  description,
  badgeLabel,
  badgeHint,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  badgeLabel: string;
  badgeHint: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{title}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-muted-foreground shrink-0 gap-1 font-normal"
                >
                  <FlaskConicalIcon className="size-3" />
                  {badgeLabel}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{badgeHint}</TooltipContent>
            </Tooltip>
          </CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
