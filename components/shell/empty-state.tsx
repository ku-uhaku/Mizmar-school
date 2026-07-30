/**
 * Purely presentational, so it is safe to import from Client Components.
 * Deliberately kept in its own module: the sibling ForbiddenState is an async
 * Server Component that reads the dictionary, and sharing a file would pull
 * `server-only` into the client bundle.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon ? (
        <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
