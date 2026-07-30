import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  description?: string;
  /** Renders a back link above the title — used by the full-page forms. */
  backHref?: string;
  backLabel?: string;
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
        <div className="min-w-0 space-y-1">
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
