"use client";

import { useEffect } from "react";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    // The message itself is not shown to the user — it may contain internals.
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-full">
          <TriangleAlertIcon className="size-5" />
        </div>
        <p className="text-muted-foreground text-sm text-pretty">
          {t.errors.unexpected}
        </p>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcwIcon className="rtl-flip" />
          {t.common.back}
        </Button>
      </CardContent>
    </Card>
  );
}
