"use client";

import { StarIcon } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { toggleReportFavouriteAction } from "@/modules/reports/actions";

/**
 * The star on a report.
 *
 * ── Why it turns before the server answers ──────────────────────────────────
 * Starring is a preference, not a transaction: nothing downstream depends on it
 * and the worst failure is a star that springs back. So the icon fills on
 * `useOptimistic` and the round trip happens behind it — waiting half a second
 * to acknowledge a click this small is what makes a screen feel slow.
 *
 * It is a form rather than an onClick so it still works before hydration, and
 * so the action reads the report id from the request instead of trusting a
 * value held in the browser.
 */
export function FavouriteButton({
  reportId,
  starred,
  className,
}: {
  reportId: string;
  starred: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [, formAction, pending] = useActionState(
    toggleReportFavouriteAction,
    IDLE,
  );

  const [optimistic, setOptimistic] = React.useOptimistic(starred);
  const label = optimistic ? t.report.unstar : t.report.star;

  return (
    <form
      action={formAction}
      // The star sits inside a link on the index; without this, pressing it
      // would navigate to the report instead of starring it.
      onClick={(event) => event.stopPropagation()}
      onSubmit={() => setOptimistic(!optimistic)}
      className={cn("contents", className)}
    >
      <input type="hidden" name="reportId" value={reportId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        title={label}
        aria-label={label}
        aria-pressed={optimistic}
        className="size-7 shrink-0"
      >
        <StarIcon
          className={cn(
            "size-4 transition",
            optimistic
              ? "fill-amber-400 text-amber-500"
              : "text-muted-foreground",
          )}
        />
      </Button>
    </form>
  );
}
