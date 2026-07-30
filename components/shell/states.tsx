import Link from "next/link";
import { LockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";

/**
 * Rendered in place of a page's contents when the user lacks the permission for
 * it. Preferred over redirecting so the navigation state stays honest, and over
 * `notFound()` so the user gets a real explanation.
 *
 * Server-only (it reads the dictionary). Client Components should import
 * EmptyState from ./empty-state instead.
 */
export async function ForbiddenState() {
  const t = await getDictionary();

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
          <LockIcon className="size-5" />
        </div>
        <div className="space-y-1">
          <h2 className="font-semibold">{t.errors.forbiddenTitle}</h2>
          <p className="text-muted-foreground text-sm text-pretty">
            {t.errors.forbiddenBody}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">{t.errors.backToDashboard}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
