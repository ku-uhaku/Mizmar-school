import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  avatar,
  meta,
  children,
}: {
  title: string;
  description?: string;
  /** Renders a back link above the title — used by the full-page forms. */
  backHref?: string;
  backLabel?: string;
  /**
   * A portrait or crest beside the title, on the screens that are *about* one
   * person or place. Left out everywhere else: a face on a list header would be
   * decoration, and here it is identification — the secretary on the phone
   * wants to be sure they have the right child open.
   */
  avatar?: React.ReactNode;
  /**
   * Status badges and the like, under the title. Kept out of the action
   * cluster: a badge is something to read and a button is something to press,
   * and mixing them makes the reader test each one to find out which it is.
   */
  meta?: React.ReactNode;
  /** Primary actions, rendered at the inline end. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 space-y-3">
      {backHref ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ms-2.5 text-muted-foreground"
        >
          <Link href={backHref}>
            <ArrowLeftIcon className="rtl-flip" />
            {backLabel}
          </Link>
        </Button>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        {avatar ? <div className="shrink-0">{avatar}</div> : null}
        {/*
          The section's colour, on the one element every screen has. It is a
          rule beside the title rather than coloured type: the title is the
          thing being read, and tinting it would trade legibility for a signal
          the rule carries just as well. `--section` is bound by the layout —
          see components/shell/section-scope.tsx.
        */}
        <div className="flex min-w-0 flex-1 gap-3">
          {/* A bar rather than a `border-s`, so the shape matches the sidebar's
            own active indicator — the two are the same signal in two places. */}
          <span
            aria-hidden
            className="bg-section mt-1 w-[3px] shrink-0 self-stretch rounded-full"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="font-heading truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground text-sm text-pretty">
                {description}
              </p>
            ) : null}
            {meta ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {meta}
              </div>
            ) : null}
          </div>
        </div>
        {children ? (
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
