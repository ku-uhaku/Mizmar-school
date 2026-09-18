"use client";

import * as React from "react";
import { SaveIcon, UserXIcon } from "lucide-react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IDLE } from "@/lib/action-state";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import { gradingScaleOf } from "@/lib/school-settings";
import { cn } from "@/lib/utils";
import { saveMarksAction } from "@/modules/assessments/actions";
import {
  appreciationFor,
  isPassing,
  markStatistics,
} from "@/modules/assessments/enums";
import type {
  MarkRow,
  MarkSheet as MarkSheetData,
} from "@/modules/assessments/queries";

/**
 * Entering a whole class's marks in one pass.
 *
 * ── Why it is one form and not one save per pupil ────────────────────────────
 * A teacher marks a pile of papers and types the results in one sitting. Saving
 * per row would mean thirty round trips, thirty chances to lose one, and a
 * screen that cannot tell them what the class average came to until they
 * reload. So the whole sheet posts at once and the statistics update live as
 * they type — the figure they actually want is "how did the class do", and they
 * should not have to wait for a server to find out.
 *
 * Absent is a checkbox rather than a score of zero, because they are different
 * facts: see the note on AssessmentGrade.score. Ticking it clears and disables
 * the mark, so the two cannot disagree.
 *
 * ── Enter walks down the column ──────────────────────────────────────────────
 * A teacher types thirty marks off a pile of papers without looking up. Enter
 * moves to the next pupil's box and selects what is in it, so the whole class
 * goes in from the keyboard alone; Shift+Enter goes back up for the one that
 * was mistyped. Rows marked absent are stepped over, since their box is
 * disabled and stopping on it would break the rhythm the shortcut exists for.
 *
 * It also stops Enter from submitting. In a form with a submit button that is
 * the browser default, so the very first Enter used to save a sheet with one
 * mark on it — which is not what anybody pressing Enter mid-column meant.
 */
export function MarkSheet({
  sheet,
  canGrade,
}: {
  sheet: MarkSheetData;
  canGrade: boolean;
}) {
  const { t, locale } = useI18n();
  const [state, formAction] = React.useActionState(saveMarksAction, IDLE);
  useActionFeedback(state);

  const settings = useSettings();
  const { assessment, rows } = sheet;
  // The niveau's own reporting scale, or the school's — shown beside the pass
  // rate so "60% passed" reads against what this school calls a pass, on the
  // scale its bulletins actually use.
  const reportScale = gradingScaleOf(settings, assessment.reportMaxScore);

  const [marks, setMarks] = React.useState<
    Record<
      string,
      { score: string; isAbsent: boolean; isExcused: boolean; comment: string }
    >
  >(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.enrollmentId,
        {
          score: row.score === null ? "" : String(row.score),
          isAbsent: row.isAbsent,
          isExcused: row.isExcused,
          comment: row.comment ?? "",
        },
      ]),
    ),
  );

  /**
   * The remark the school's scale suggests for a mark — see `appreciationFor`.
   *
   * Written into the box as the mark is typed, and only over a box the teacher
   * has not written in themselves: an empty one, or one still holding a
   * suggestion from a previous mark. Anything else is their own wording and is
   * left alone, which is what makes the suggestion safe to apply without asking.
   */
  const suggestions = React.useMemo(
    () => new Set(sheet.appreciationBands.map((band) => band.label)),
    [sheet.appreciationBands],
  );

  function update(
    enrollmentId: string,
    patch: Partial<{
      score: string;
      isAbsent: boolean;
      isExcused: boolean;
      comment: string;
    }>,
  ) {
    setMarks((current) => {
      const entry = { ...current[enrollmentId], ...patch };

      if (patch.score !== undefined && patch.comment === undefined) {
        const previous = current[enrollmentId]?.comment ?? "";
        if (previous === "" || suggestions.has(previous)) {
          const parsed = Number(entry.score);
          const suggested = appreciationFor(
            entry.score.trim() === "" || !Number.isFinite(parsed)
              ? null
              : parsed,
            assessment.maxScore,
            sheet.appreciationBands,
          );
          entry.comment = suggested?.label ?? "";
        }
      }

      return { ...current, [enrollmentId]: entry };
    });
  }

  /*
    The score boxes are found by walking the rendered table rather than by
    keeping a ref per row: document order is already what the parallel arrays
    depend on (see the note in MarkRowCells), so reading the same order back out
    of the DOM cannot drift from what the form will post.
  */
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);

  function stepScore(from: HTMLInputElement, direction: 1 | -1) {
    const boxes = Array.from(
      bodyRef.current?.querySelectorAll<HTMLInputElement>(
        "input[data-score-cell]",
      ) ?? [],
      // A disabled box cannot be typed into, so an absent pupil is stepped over
      // rather than landed on.
    ).filter((box) => !box.disabled);

    const next = boxes[boxes.indexOf(from) + direction];
    if (!next) return;

    next.focus();
    // Selected, not just focused: the next thing typed replaces the mark
    // instead of being appended to it, which is what makes the column fast.
    next.select();
  }

  /** Everyone with no mark and no absence yet — the "rest" of the sheet. */
  function markRemainingAbsent() {
    setMarks((current) => {
      const next = { ...current };
      for (const row of rows) {
        const entry = next[row.enrollmentId];
        if (entry.score.trim() === "" && !entry.isAbsent) {
          next[row.enrollmentId] = { ...entry, isAbsent: true, score: "" };
        }
      }
      return next;
    });
  }

  // Recomputed as they type, through the same function the server uses — so the
  // average on screen is the average that will be stored.
  const live = React.useMemo(
    () =>
      markStatistics(
        rows.map((row) => {
          const entry = marks[row.enrollmentId];
          const parsed = Number(entry?.score);
          return {
            score:
              entry?.score.trim() === "" || !Number.isFinite(parsed)
                ? null
                : parsed,
            isAbsent: entry?.isAbsent ?? false,
          };
        }),
        assessment.maxScore,
        settings.passMarkBps,
      ),
    [marks, rows, assessment.maxScore, settings.passMarkBps],
  );

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState title={t.assessment.emptyRoster} />
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="assessmentId" value={assessment.id} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t.assessment.average}
          value={
            live.average === null
              ? "—"
              : `${formatNumber(live.average, locale)}/${assessment.maxScore}`
          }
        />
        <Stat
          label={t.assessment.passRate}
          // The threshold beside the rate, because "60% passed" means nothing
          // without knowing what this school calls a pass.
          hint={interpolate(t.assessment.passMarkIs, {
            mark: formatNumber(reportScale.passMark, locale),
            max: reportScale.outOf,
          })}
          value={live.passRate === null ? "—" : `${live.passRate}%`}
          tone={
            live.passRate === null
              ? undefined
              : live.passRate >= 50
                ? "good"
                : "bad"
          }
        />
        <Stat
          label={t.assessment.pending}
          value={formatNumber(live.pendingCount, locale)}
          tone={live.pendingCount > 0 ? "warn" : "good"}
        />
        <Stat
          label={t.assessment.absent}
          value={formatNumber(live.absentCount, locale)}
          hint={
            live.absentCount > 0 ? t.assessment.absencesExcluded : undefined
          }
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-medium">{t.assessment.markSheet}</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {interpolate(t.assessment.markedOf, {
              marked: live.markedCount + live.absentCount,
              total: rows.length,
            })}
          </span>
          {canGrade ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ms-auto"
              onClick={markRemainingAbsent}
              disabled={live.pendingCount === 0}
            >
              <UserXIcon />
              {t.assessment.markAllAbsent}
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.assessment.pupil}</TableHead>
                <TableHead className="w-32">
                  {t.assessment.score}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    /{assessment.maxScore}
                  </span>
                </TableHead>
                <TableHead className="w-24">{t.assessment.absent}</TableHead>
                <TableHead className="hidden w-24 sm:table-cell">
                  {t.assessment.excused}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t.assessment.comment}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody ref={bodyRef}>
              {rows.map((row) => (
                <MarkRowCells
                  key={row.enrollmentId}
                  row={row}
                  entry={marks[row.enrollmentId]}
                  maxScore={assessment.maxScore}
                  passBps={settings.passMarkBps}
                  canGrade={canGrade}
                  onChange={update}
                  onStep={stepScore}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {canGrade ? (
        <div className="flex justify-end">
          <SubmitButton size="lg">
            <SaveIcon />
            {t.assessment.saveMarks}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

function MarkRowCells({
  row,
  entry,
  maxScore,
  passBps,
  canGrade,
  onChange,
  onStep,
}: {
  row: MarkRow;
  entry: {
    score: string;
    isAbsent: boolean;
    isExcused: boolean;
    comment: string;
  };
  maxScore: number;
  /** The school's pass threshold — see isPassing. */
  passBps: number;
  canGrade: boolean;
  onChange: (
    enrollmentId: string,
    patch: Partial<{
      score: string;
      isAbsent: boolean;
      isExcused: boolean;
      comment: string;
    }>,
  ) => void;
  /** Moves to the next or previous pupil's score box — see the note on MarkSheet. */
  onStep: (from: HTMLInputElement, direction: 1 | -1) => void;
}) {
  const { t } = useI18n();

  const parsed = Number(entry.score);
  const hasScore = entry.score.trim() !== "" && Number.isFinite(parsed);
  const failing = hasScore && !isPassing(parsed, maxScore, passBps);

  const initials = `${row.firstName[0] ?? ""}${row.lastName[0] ?? ""}`
    .toUpperCase()
    .trim();

  return (
    <TableRow className={cn(entry.isAbsent && "opacity-60")}>
      <TableCell>
        {/*
          The action reads these as parallel arrays indexed by pupil, so every
          row must contribute exactly one value to every field — including the
          ones it is not using. Emitting the whole block here, once, is what
          makes that structural: a blank comment cannot shift the next pupil's
          mark onto the wrong child.

          Inside the cell rather than directly under the row: `<tr>` may only
          hold `<td>`, so a browser parsing the markup hoists a stray `<input>`
          out of the table altogether — which both loses the field and makes the
          parsed DOM differ from what React rendered, i.e. a hydration error.
          Document order across rows is unchanged, which is all the parallel
          arrays depend on.
        */}
        <input type="hidden" name="enrollmentId" value={row.enrollmentId} />
        <input
          type="hidden"
          name="score"
          value={entry.isAbsent ? "" : entry.score}
        />
        <input type="hidden" name="absent" value={entry.isAbsent ? "1" : "0"} />
        <input
          type="hidden"
          name="excused"
          value={entry.isAbsent && entry.isExcused ? "1" : "0"}
        />
        <input type="hidden" name="comment" value={entry.comment} />

        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8 shrink-0">
            {row.photoUrl ? <AvatarImage src={row.photoUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.firstName} {row.lastName}
            </p>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {row.studentCode}
            </p>
          </div>
          {row.groupLabel ? (
            <Badge variant="outline" className="shrink-0">
              {row.groupLabel}
            </Badge>
          ) : null}
        </div>
      </TableCell>

      <TableCell>
        <Input
          data-score-cell=""
          value={entry.isAbsent ? "" : entry.score}
          onChange={(event) =>
            onChange(row.enrollmentId, { score: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // Always prevented, even on the last row where there is nowhere to
            // go: Enter in this column means "next pupil", never "save".
            event.preventDefault();
            onStep(event.currentTarget, event.shiftKey ? -1 : 1);
          }}
          // Disabled rather than merely ignored: an absence and a mark are
          // contradictory, and a greyed box says so before anybody types.
          disabled={!canGrade || entry.isAbsent}
          type="number"
          step="0.25"
          min={0}
          max={maxScore}
          dir="ltr"
          aria-label={t.assessment.score}
          className={cn(
            "h-9 w-24 tabular-nums",
            failing && "text-destructive font-medium",
            hasScore && !failing && "text-success font-medium",
          )}
        />
      </TableCell>

      <TableCell>
        <Checkbox
          checked={entry.isAbsent}
          disabled={!canGrade}
          onCheckedChange={(value) =>
            onChange(row.enrollmentId, {
              isAbsent: value === true,
              // Clearing the mark keeps the row honest — see above.
              ...(value === true ? { score: "" } : { isExcused: false }),
            })
          }
          aria-label={t.assessment.absent}
        />
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <Checkbox
          checked={entry.isExcused}
          disabled={!canGrade || !entry.isAbsent}
          onCheckedChange={(value) =>
            onChange(row.enrollmentId, { isExcused: value === true })
          }
          aria-label={t.assessment.excused}
        />
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <Input
          value={entry.comment}
          onChange={(event) =>
            onChange(row.enrollmentId, { comment: event.target.value })
          }
          disabled={!canGrade}
          aria-label={t.assessment.comment}
          className="h-9"
        />
      </TableCell>
    </TableRow>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "warn";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "mt-1 text-xl font-semibold tabular-nums",
            tone === "good" && "text-success",
            tone === "bad" && "text-destructive",
            tone === "warn" && "text-warning",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
