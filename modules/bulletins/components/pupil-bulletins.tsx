"use client";

import Link from "next/link";
import { PrinterIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { yearAverageOf } from "@/modules/bulletins/enums";
import type { BulletinRow } from "@/modules/bulletins/queries";

/**
 * A pupil's terms, on their own file.
 *
 * Above the marks panel rather than instead of it, because the two answer
 * different questions: the panel is every paper they sat, and this is what the
 * school decided those came to. A secretary on the phone to a parent wants the
 * second, and wants it without opening a print view.
 *
 * A draft is shown to staff and marked as one. Hiding it would leave the file
 * looking as though the term had not been worked out at all, which is exactly
 * the thing somebody would then go and recompute on top of a council's work.
 */
export function PupilBulletins({
  bulletins,
  studentId,
}: {
  bulletins: BulletinRow[];
  studentId: string;
}) {
  const { t, locale } = useI18n();

  if (bulletins.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t.bulletin.noneForPupil}</p>
    );
  }

  // Over the issued ones only, exactly as the document itself reports it.
  const yearAverage = yearAverageOf(
    bulletins.filter((bulletin) => bulletin.isPublished),
  );

  return (
    <Card className="py-0">
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{t.bulletin.termResults}</h3>
          {yearAverage !== null ? (
            <p className="text-muted-foreground text-xs">
              {t.bulletin.yearAverage}:{" "}
              <span className="text-foreground font-medium tabular-nums">
                {yearAverage.toFixed(2)}
              </span>
            </p>
          ) : null}
        </div>

        <ul className="grid gap-2">
          {bulletins.map((bulletin) => (
            <li
              key={bulletin.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-sm first:border-t-0 first:pt-0"
            >
              <span className="font-medium">
                {bulletin.generalAverage === null
                  ? t.bulletin.noMark
                  : bulletin.generalAverage.toFixed(2)}
              </span>
              <span className="text-muted-foreground text-xs">
                {interpolate(t.bulletin.outOf, { max: bulletin.outOf })}
              </span>

              {bulletin.rank !== null ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {interpolate(t.bulletin.rankOf, {
                    rank: bulletin.rank,
                    size: bulletin.classSize,
                  })}
                </span>
              ) : null}

              {bulletin.mention ? (
                <Badge variant="secondary">
                  {
                    t.bulletinOptions.mentions[
                      bulletin.mention as keyof typeof t.bulletinOptions.mentions
                    ]
                  }
                </Badge>
              ) : null}

              {bulletin.isPublished ? (
                <span className="text-muted-foreground text-xs">
                  {bulletin.publishedAt
                    ? interpolate(t.bulletin.publishedOn, {
                        date: formatDate(bulletin.publishedAt, locale),
                      })
                    : ""}
                </span>
              ) : (
                <Badge variant="outline">
                  {t.bulletinOptions.statuses.DRAFT}
                </Badge>
              )}

              <Button asChild size="sm" variant="ghost" className="ms-auto">
                <Link
                  href={`/print/student/${studentId}/bulletin/${bulletin.termId}`}
                >
                  <PrinterIcon />
                  {t.bulletin.print}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
