"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRangeIcon, SettingsIcon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { switchSchoolAction } from "@/modules/context/actions";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The jumping-off point for a school somebody has just created or is still
 * setting up.
 *
 * The wizard is the primary action: it fills a school in one pass, in the order
 * the tables actually depend on each other. The two links beside it are for
 * going straight to one thing — `/configuration` and `/school-years` both read
 * the working context rather than a URL param, so getting there from another
 * school's page means switching first, which is what they do before navigating
 * rather than showing the previous school's data.
 */
export function SchoolSetupCta({
  schoolId,
  isCurrent,
}: {
  schoolId: string;
  isCurrent: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function go(href: string) {
    startTransition(async () => {
      if (!isCurrent) {
        const result = await switchSchoolAction(schoolId);
        if (result.status === "error") {
          toast.error(result.message ?? t.errors.unexpected);
          return;
        }
      }
      router.push(href);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.school.setupTitle}</CardTitle>
        <CardDescription>{t.school.setupBody}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild type="button">
          <Link href={`/schools/${schoolId}/setup`}>
            <WandSparklesIcon />
            {t.setup.titleExisting}
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => go("/configuration")}
        >
          <SettingsIcon />
          {t.school.setupGeneralAction}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => go("/school-years")}
        >
          <CalendarRangeIcon />
          {t.school.setupYearsAction}
        </Button>
      </CardContent>
    </Card>
  );
}
