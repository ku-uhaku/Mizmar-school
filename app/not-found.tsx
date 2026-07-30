import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getDictionary();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <FileQuestionIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t.errors.pageNotFoundTitle}</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          {t.errors.pageNotFoundBody}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">{t.errors.backToDashboard}</Link>
      </Button>
    </main>
  );
}
