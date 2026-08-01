import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the full-page forms. Long forms live on their own route
 * rather than in a dialog — a modal that needs its own scrollbar is a sign the
 * content outgrew it.
 */

export function FormSection({
  id,
  title,
  description,
  children,
  className,
}: {
  /**
   * Anchor for `FormNav`. The scroll margin keeps the heading clear of the app
   * header when a jump link lands on it — without it the title sits under the
   * bar and the reader has to scroll back up to see where they arrived.
   */
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card id={id} className={id ? "scroll-mt-24" : undefined}>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("grid gap-5", className)}>
        {children}
      </CardContent>
    </Card>
  );
}

/** Responsive field grid: one column on small screens, `cols` above `sm`. */
export function FormGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-5",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-3",
        cols === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Action bar pinned to the bottom of the viewport, so Save stays reachable on a
 * long form without scrolling to the end.
 */
export function FormActions({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-background/85 sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-end gap-3 border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      {hint ? (
        <p className="text-muted-foreground me-auto text-xs">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

/** Two-column page body: the form on the left, contextual info on the right. */
export function FormLayout({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  if (!aside) return <div className="grid max-w-3xl gap-5">{children}</div>;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="grid gap-5 lg:col-span-2">{children}</div>
      <div className="grid h-fit gap-5 lg:sticky lg:top-24">{aside}</div>
    </div>
  );
}
