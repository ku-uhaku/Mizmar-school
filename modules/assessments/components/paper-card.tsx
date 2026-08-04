"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { PaperQuestion } from "@/modules/assessments/queries";

/**
 * The paper: the questions as the teacher wrote them, numbered, with what each
 * one is worth.
 *
 * Renders nothing at all when no paper was written — most work set is "exercices
 * p.42", and an empty card headed "Questions" on every mark sheet would be a
 * reproach rather than information.
 *
 * The barème is shown against the paper's own `maxScore`, and called out when
 * the two disagree. That is not an error — a bonus question is deliberate — but
 * it is the one thing about a barème worth noticing before thirty copies have
 * been marked against it.
 */
export function PaperCard({
  questions,
  total,
  maxScore,
}: {
  questions: PaperQuestion[];
  total: number;
  maxScore: number;
}) {
  const { t, locale } = useI18n();

  if (questions.length === 0) return null;

  const matches = total === maxScore;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{t.classroom.questions}</CardTitle>
        <CardDescription>
          {interpolate(t.classroom.questionsTotal, {
            total: formatNumber(total, locale),
          })}
        </CardDescription>
        <div className="ms-auto">
          <Badge
            variant="outline"
            className={cn(
              "tabular-nums",
              matches ? "text-success border-success/40" : "text-warning border-warning/40",
            )}
          >
            {formatNumber(total, locale)}/{maxScore}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <ol className="grid gap-3">
          {questions.map((question) => (
            <li key={question.id} className="flex items-start gap-3">
              <span className="text-muted-foreground w-5 shrink-0 text-sm tabular-nums">
                {question.position}.
              </span>
              {/* The wording is plain text and may run to several lines — kept
                  as the teacher typed it rather than collapsed. */}
              <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap">
                {question.text}
              </p>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatNumber(question.points, locale)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
