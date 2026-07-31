import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  avatar,
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
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-heading truncate text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground text-sm text-pretty">
              {description}
            </p>
          ) : null}
        </div>
        {children ? (
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
