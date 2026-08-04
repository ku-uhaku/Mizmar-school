"use client";

import * as React from "react";
import { CheckCheckIcon, SaveIcon } from "lucide-react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { saveRegisterAction } from "@/modules/classroom/actions";
import {
  ATTENDANCE_STATUSES,
  tallyAttendance,
  type AttendanceStatus,
} from "@/modules/classroom/enums";
import type { Register, RegisterPupil } from "@/modules/classroom/queries";

/** How each status is drawn. Colour reinforces the label; it never replaces it. */
const STATUS_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: "data-[on=true]:bg-success data-[on=true]:text-background",
  LATE: "data-[on=true]:bg-warning data-[on=true]:text-background",
  ABSENT: "data-[on=true]:bg-destructive data-[on=true]:text-background",
  EXCUSED: "data-[on=true]:bg-primary data-[on=true]:text-primary-foreground",
};

/**
 * Taking the register for one lesson.
 *
 * ── Why it opens with everybody present ─────────────────────────────────────
 * In a class of thirty, two are away. A register that starts blank makes the
 * teacher touch thirty rows to record two facts; one that starts on PRESENT
 * makes them touch two. So the sheet defaults to present and the save writes
 * the whole roster — the absence of a mark is not evidence that a pupil was
 * there, and only a saved row is.
 *
 * Each pupil carries their running totals for the year, because a teacher
 * deciding whether this retard matters needs to know it is the child's fourth,
 * and they will not go and look it up.
 */
export function RegisterSheet({
  register,
  canMark,
}: {
  register: Register;
  canMark: boolean;
}) {
  const { t, locale } = useI18n();
  const [state, formAction] = React.useActionState(saveRegisterAction, IDLE);
  useActionFeedback(state);

  const [marks, setMarks] = React.useState<
    Record<
      string,
      { status: AttendanceStatus; minutesLate: string; reason: string }
    >
  >(() =>
    Object.fromEntries(
      register.pupils.map((pupil) => [
        pupil.enrollmentId,
        {
          // An unmarked pupil starts present — see the note above.
          status: (pupil.status ?? "PRESENT") as AttendanceStatus,
          minutesLate:
            pupil.minutesLate === null ? "" : String(pupil.minutesLate),
          reason: pupil.reason ?? "",
        },
      ]),
    ),
  );

  function update(
    enrollmentId: string,
    patch: Partial<{
      status: AttendanceStatus;
      minutesLate: string;
      reason: string;
    }>,
  ) {
    setMarks((current) => ({
      ...current,
      [enrollmentId]: { ...current[enrollmentId], ...patch },
    }));
  }

  function allPresent() {
    setMarks((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, entry]) => [
          id,
          { ...entry, status: "PRESENT" as AttendanceStatus, minutesLate: "" },
        ]),
      ),
    );
  }

  // Recomputed as they tap, through the same function the server would use.
  const live = React.useMemo(
    () =>
      tallyAttendance(
        register.pupils.map((pupil) => ({
          status: marks[pupil.enrollmentId]?.status ?? null,
        })),
      ),
    [marks, register.pupils],
  );

  if (register.pupils.length === 0) {
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
      <input
        type="hidden"
        name="schoolClassId"
        value={register.schoolClassId}
      />
      <input type="hidden" name="subjectId" value={register.subjectId ?? ""} />
      <input
        type="hidden"
        name="timeSlotId"
        value={register.timeSlotId ?? ""}
      />
      <input type="hidden" name="date" value={register.date} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tally
          label={t.classroomOptions.attendanceStatuses.PRESENT}
          value={formatNumber(live.present, locale)}
          tone="good"
        />
        <Tally
          label={t.classroomOptions.attendanceStatuses.LATE}
          value={formatNumber(live.late, locale)}
          tone={live.late > 0 ? "warn" : undefined}
        />
        <Tally
          label={t.classroomOptions.attendanceStatuses.ABSENT}
          value={formatNumber(live.absent, locale)}
          tone={live.absent > 0 ? "bad" : undefined}
        />
        <Tally
          label={t.classroomOptions.attendanceStatuses.EXCUSED}
          value={formatNumber(live.excused, locale)}
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-medium">{t.classroom.register}</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {register.classCode}
            {register.groupLabel ? ` · ${register.groupLabel}` : ""}
            {register.slotLabel
              ? ` · ${register.slotLabel}`
              : ` · ${t.classroom.wholeDay}`}
          </span>
          {canMark ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ms-auto"
              onClick={allPresent}
            >
              <CheckCheckIcon />
              {t.classroom.markAllPresent}
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.classroom.pupil}</TableHead>
                <TableHead className="w-72">{t.classroom.status}</TableHead>
                <TableHead className="hidden w-28 sm:table-cell">
                  {t.classroom.minutesLate}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t.classroom.reason}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {register.pupils.map((pupil) => (
                <PupilRow
                  key={pupil.enrollmentId}
                  pupil={pupil}
                  entry={marks[pupil.enrollmentId]}
                  canMark={canMark}
                  onChange={update}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {canMark ? (
        <div className="flex justify-end">
          <SubmitButton size="lg">
            <SaveIcon />
            {t.classroom.saveRegister}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

function PupilRow({
  pupil,
  entry,
  canMark,
  onChange,
}: {
  pupil: RegisterPupil;
  entry: { status: AttendanceStatus; minutesLate: string; reason: string };
  canMark: boolean;
  onChange: (
    enrollmentId: string,
    patch: Partial<{
      status: AttendanceStatus;
      minutesLate: string;
      reason: string;
    }>,
  ) => void;
}) {
  const { t } = useI18n();

  const initials = `${pupil.firstName[0] ?? ""}${pupil.lastName[0] ?? ""}`
    .toUpperCase()
    .trim();

  return (
    <TableRow>
      <TableCell>
        {/*
          Parallel arrays indexed by pupil, so every row contributes exactly one
          value to every field — the same shape as the mark sheet, and for the
          same reason: a blank reason must not shift the next pupil's status onto
          the wrong child.

          Inside the cell rather than directly under the row: `<tr>` may only
          hold `<td>`, so a browser parsing the markup hoists a stray `<input>`
          out of the table altogether — which both loses the field and makes the
          parsed DOM differ from what React rendered, i.e. a hydration error.
          Document order across rows is unchanged, which is all the parallel
          arrays depend on.
        */}
        <input type="hidden" name="enrollmentId" value={pupil.enrollmentId} />
        <input type="hidden" name="status" value={entry.status} />
        <input
          type="hidden"
          name="minutesLate"
          value={entry.status === "LATE" ? entry.minutesLate : ""}
        />
        <input type="hidden" name="reason" value={entry.reason} />

        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8 shrink-0">
            {pupil.photoUrl ? (
              <AvatarImage src={pupil.photoUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {pupil.lastName} {pupil.firstName}
            </p>
            <p className="text-muted-foreground flex flex-wrap gap-1.5 text-xs">
              {pupil.absencesThisYear > 0 ? (
                <span className="text-destructive">
                  {interpolate(t.classroom.absencesShort, {
                    count: pupil.absencesThisYear,
                  })}
                </span>
              ) : null}
              {pupil.latesThisYear > 0 ? (
                <span className="text-warning">
                  {interpolate(t.classroom.latesShort, {
                    count: pupil.latesThisYear,
                  })}
                </span>
              ) : null}
              {pupil.absencesThisYear === 0 && pupil.latesThisYear === 0 ? (
                <span dir="ltr">{pupil.studentCode}</span>
              ) : null}
            </p>
          </div>
        </div>
      </TableCell>

      <TableCell>
        {/* Four taps, not a dropdown: the whole job is thirty of these. */}
        <div className="flex flex-wrap gap-1">
          {ATTENDANCE_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant="outline"
              disabled={!canMark}
              data-on={entry.status === status}
              onClick={() =>
                onChange(pupil.enrollmentId, {
                  status,
                  // A status that is not LATE cannot carry a lateness.
                  ...(status === "LATE" ? {} : { minutesLate: "" }),
                })
              }
              className={cn("h-8 px-2 text-xs", STATUS_STYLES[status])}
            >
              {t.classroomOptions.attendanceStatuses[status]}
            </Button>
          ))}
        </div>
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <Input
          value={entry.minutesLate}
          onChange={(event) =>
            onChange(pupil.enrollmentId, { minutesLate: event.target.value })
          }
          // Only meaningful on a retard, and disabled so the two cannot disagree.
          disabled={!canMark || entry.status !== "LATE"}
          type="number"
          min={0}
          max={120}
          dir="ltr"
          className="h-8 w-20"
          aria-label={t.classroom.minutesLate}
        />
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <Input
          value={entry.reason}
          onChange={(event) =>
            onChange(pupil.enrollmentId, { reason: event.target.value })
          }
          disabled={!canMark || entry.status === "PRESENT"}
          className="h-8"
          aria-label={t.classroom.reason}
        />
        {pupil.isJustified ? (
          <Badge variant="secondary" className="mt-1">
            {t.classroom.justified}
          </Badge>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
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
      </CardContent>
    </Card>
  );
}
