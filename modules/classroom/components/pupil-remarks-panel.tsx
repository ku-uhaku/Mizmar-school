"use client";

import {
  EyeIcon,
  MessageSquareTextIcon,
  MinusIcon,
  ThumbsUpIcon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { REMARK_KINDS, REMARK_TONES } from "@/modules/classroom/enums";
import type { PupilRemarkRow } from "@/modules/classroom/queries";

/** Tone decides the colour; kind decides the label. See REMARK_TONES. */
const TONE_STYLES: Record<
  string,
  { surface: string; text: string; icon: React.ReactNode }
> = {
  POSITIVE: {
    surface: "border-success/30 bg-success/5",
    text: "text-success",
    icon: <ThumbsUpIcon className="size-3.5" />,
  },
  CONCERN: {
    surface: "border-destructive/30 bg-destructive/5",
    text: "text-destructive",
    icon: <TriangleAlertIcon className="size-3.5" />,
  },
  NEUTRAL: {
    surface: "",
    text: "text-muted-foreground",
    icon: <MinusIcon className="size-3.5" />,
  },
};

/**
 * Le carnet: what teachers have written about this pupil.
 *
 * A timeline rather than a table, because a remark is a paragraph somebody
 * wrote and a table would truncate every one of them into uselessness. Newest
 * first: the question at the desk is almost always "what has happened lately".
 *
 * Praise is coloured as clearly as concern. A carnet that only ever shows
 * problems is one nobody reads to the child's credit — the same reason `tone`
 * exists apart from `kind` at all.
 *
 * Read-only here. Remarks are written in the espace enseignant, by the teacher
 * who is answerable for them; the office reads the whole picture and edits
 * none of it.
 */
export function PupilRemarksPanel({ remarks }: { remarks: PupilRemarkRow[] }) {
  const { t, locale } = useI18n();
  const [tone, setTone] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<string | null>(null);

  const shown = remarks.filter(
    (remark) =>
      (tone === null || remark.tone === tone) &&
      (kind === null || remark.kind === kind),
  );

  if (remarks.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<MessageSquareTextIcon className="size-5" />}
            title={t.classroom.noRemarksYet}
            description={t.classroom.noRemarksHint}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Two small filter rows rather than a DataTable toolbar: there are three
          tones and five kinds, and a dropdown to choose among three is slower
          than the three buttons themselves. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label={t.common.all}
          active={tone === null && kind === null}
          onClick={() => {
            setTone(null);
            setKind(null);
          }}
        />
        <span className="bg-border h-4 w-px" />
        {REMARK_TONES.map((option) => (
          <FilterChip
            key={option}
            label={t.classroomOptions.remarkTones[option]}
            active={tone === option}
            onClick={() => setTone(tone === option ? null : option)}
          />
        ))}
        <span className="bg-border h-4 w-px" />
        {REMARK_KINDS.map((option) => (
          <FilterChip
            key={option}
            label={t.classroomOptions.remarkKinds[option]}
            active={kind === option}
            onClick={() => setKind(kind === option ? null : option)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {t.common.noResults}
          </CardContent>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {shown.map((remark) => {
            const style = TONE_STYLES[remark.tone] ?? TONE_STYLES.NEUTRAL;

            return (
              <li key={remark.id}>
                <Card className={cn("gap-0 py-0", style.surface)}>
                  <CardContent className="grid gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn("flex items-center gap-1.5", style.text)}
                      >
                        {style.icon}
                        <span className="text-xs font-medium">
                          {
                            t.classroomOptions.remarkTones[
                              remark.tone as keyof typeof t.classroomOptions.remarkTones
                            ]
                          }
                        </span>
                      </span>
                      <Badge variant="outline">
                        {
                          t.classroomOptions.remarkKinds[
                            remark.kind as keyof typeof t.classroomOptions.remarkKinds
                          ]
                        }
                      </Badge>
                      {remark.subjectName ? (
                        <Badge variant="secondary">{remark.subjectName}</Badge>
                      ) : null}
                      {remark.isVisibleToFamily ? (
                        <Badge variant="outline" className="gap-1">
                          <EyeIcon className="size-3" />
                          {t.classroom.visibleToFamily}
                        </Badge>
                      ) : null}
                      <span className="text-muted-foreground ms-auto text-xs whitespace-nowrap">
                        {formatDate(remark.occurredOn, locale)}
                      </span>
                    </div>

                    <p className="text-sm whitespace-pre-line">{remark.body}</p>

                    {remark.authorName ? (
                      <p className="text-muted-foreground text-xs">
                        {remark.authorName}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
