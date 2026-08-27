"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  CalendarOffIcon,
  CheckCheckIcon,
  ClipboardCheckIcon,
  SaveIcon,
} from "lucide-react";

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
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { saveRegisterAction } from "@/modules/classroom/actions";
import {
  ATTENDANCE_STATUSES,
  MAX_MINUTES_LATE,
  tallyAttendance,
  type AttendanceStatus,
} from "@/modules/classroom/enums";
import type {
  ClassDay,
  ClassLesson,
  Register,
} from "@/modules/classroom/queries";

/**
 * Taking the appel from the class file rather than from the teachers' space.
 *
 * ── Why this exists next to the espace enseignant's own register ────────────
 * The register was reachable only by the teacher assigned to the lesson, and
 * only from the phone. That is the ordinary case and not the only one: the
 * surveillant général covering an absent colleague, and the directrice ringing
 * the families of this morning's absentees, both start from a class and a day.
 * They have no teaching assignment to be confined to, so the espace enseignant
 * could never show them anything.
 *
 * The write already allowed it — `saveRegister` takes `actsForSchool`, decided
 * from `classroom.attendanceJustify` — so this screen is the way in, not a new
 * privilege. Whoever saves here is recorded as having marked it, which is why
 * the notice above the sheet says so.
 *
 * ── The day is in the URL, the marks are in the browser ─────────────────────
 * The date and the period are query parameters, so the roster is read on the
 * server with everything already recorded against it and a half-taken register
 * is a link somebody can send. The statuses are local state until Save, for the
 * same reason the mark sheet's are: an appel is thirty decisions made in one
 * pass in front of a class, and thirty round trips is thirty chances to lose
 * one.
 */
export function ClassRegisterPanel({
  schoolClassId,
  day,
  register,
  selectedTimeSlotId,
  canMark,
}: {
  schoolClassId: string;
  /** The class's lessons on the date in the URL — see `listClassLessons`. */
  day: ClassDay;
  /** The selected period's roster. Null when the day has no lesson selected. */
  register: Register | null;
  selectedTimeSlotId: string | null;
  /** CLASSROOM_ATTENDANCE_MARK. A reader without it sees the sheet read-only. */
  canMark: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = React.useTransition();

  /**
   * Rewrites one of this panel's two parameters, keeping the other tabs' alone.
   *
   * A replace rather than a push, as on the paper tabs: stepping through six
   * periods should not be six entries in the back stack.
   */
  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      startTransition(() => {
        router.replace(next.size > 0 ? `?${next.toString()}` : "?");
      });
    },
    [params, router],
  );

  return (
    <div className="grid gap-4">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-medium">{t.classroom.register}</h2>
            <p className="text-muted-foreground text-xs">
              {t.classroom.dayRegisterHint}
            </p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Input
              type="date"
              value={day.date}
              // An empty box would read the whole year's registers as one, so a
              // cleared date falls back to the day it was showing.
              onChange={(event) =>
                setParam("reg_date", event.target.value || day.date)
              }
              className="h-9 w-40"
              dir="ltr"
              aria-label={t.classroom.date}
            />
          </div>
        </div>

        <CardContent className="p-4">
          {day.lessons.length === 0 ? (
            <EmptyState
              icon={<CalendarOffIcon className="size-5" />}
              title={
                day.holidayName
                  ? interpolate(t.classroom.schoolClosed, {
                      name: day.holidayName,
                    })
                  : day.isTeaching
                    ? t.classroom.noLessonsOnDay
                    : t.classroom.weekNotTaught
              }
              description={
                day.holidayName || !day.isTeaching
                  ? undefined
                  : t.classroom.noLessonsOnDayHint
              }
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {day.lessons.map((lesson) => (
                <LessonChip
                  key={lesson.timeSlotId}
                  lesson={lesson}
                  isSelected={lesson.timeSlotId === selectedTimeSlotId}
                  onSelect={() => setParam("reg_slot", lesson.timeSlotId)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {register ? (
        <RegisterSheet
          key={`${register.date}:${register.timeSlotId ?? ""}`}
          schoolClassId={schoolClassId}
          register={register}
          canMark={canMark}
        />
      ) : day.lessons.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<ClipboardCheckIcon className="size-5" />}
              title={t.classroom.chooseLesson}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** One period of the day: when, what, who, and whether the appel is done. */
function LessonChip({
  lesson,
  isSelected,
  onSelect,
}: {
  lesson: ClassLesson;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const isCancelled = lesson.exceptionKind === "CANCELLED";

  return (
    <button
      type="button"
      onClick={onSelect}
      // A cancelled period is still shown — a reader looking for it must be
      // told it was called off, not left wondering why it is missing — but
      // there is no register to take for a lesson nobody sat.
      disabled={isCancelled}
      className={cn(
        "flex min-w-44 flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors",
        isSelected ? "border-primary bg-accent" : "hover:bg-accent/50",
        isCancelled && "opacity-60",
      )}
      aria-pressed={isSelected}
    >
      <div className="flex w-full items-center gap-2">
        <span className="text-xs tabular-nums" dir="ltr">
          {lesson.startTime} — {lesson.endTime}
        </span>
        {lesson.isMarked ? (
          <Badge variant="secondary" className="ms-auto">
            {t.classroom.registerTaken}
          </Badge>
        ) : (
          <Badge variant="outline" className="ms-auto">
            {t.classroom.registerPending}
          </Badge>
        )}
      </div>

      <span className="flex items-center gap-1.5 text-sm font-medium">
        {lesson.subjectColorHex ? (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: lesson.subjectColorHex }}
          />
        ) : null}
        {lesson.subjectName}
        {lesson.groupLabel ? (
          <Badge variant="outline" className="font-normal">
            {lesson.groupLabel}
          </Badge>
        ) : null}
      </span>

      <span className="text-muted-foreground text-xs">
        {isCancelled
          ? t.classroom.lessonCancelled
          : lesson.exceptionKind === "REPLACED"
            ? t.classroom.lessonReplaced
            : (lesson.teacherName ?? "—")}
      </span>

      <span className="text-muted-foreground text-xs tabular-nums">
        {interpolate(t.classroom.markedOfRoster, {
          marked: lesson.marked,
          total: lesson.roster,
        })}
      </span>
    </button>
  );
}

type Mark = {
  status: AttendanceStatus | null;
  minutesLate: string;
  reason: string;
};

/**
 * The sheet itself: the whole class, one status each.
 *
 * Nothing is pre-selected for a pupil with no mark yet. A register that opened
 * on "everybody present" would be saved untouched by somebody who meant to read
 * it, and the school would have a day of attendance nobody actually took —
 * which is why the tally counts the unmarked separately and "Everyone present"
 * is a deliberate click.
 */
function RegisterSheet({
  schoolClassId,
  register,
  canMark,
}: {
  schoolClassId: string;
  register: Register;
  canMark: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction] = React.useActionState(saveRegisterAction, IDLE);
  useActionFeedback(state);

  const [marks, setMarks] = React.useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      register.pupils.map((pupil) => [
        pupil.enrollmentId,
        {
          status: (pupil.status as AttendanceStatus | null) ?? null,
          minutesLate:
            pupil.minutesLate === null ? "" : String(pupil.minutesLate),
          reason: pupil.reason ?? "",
        },
      ]),
    ),
  );

  function update(enrollmentId: string, patch: Partial<Mark>) {
    setMarks((current) => ({
      ...current,
      [enrollmentId]: { ...current[enrollmentId], ...patch },
    }));
  }

  /** Everyone nobody has decided about yet — the ordinary end of an appel. */
  function markRemainingPresent() {
    setMarks((current) => {
      const next = { ...current };
      for (const pupil of register.pupils) {
        if (next[pupil.enrollmentId].status === null) {
          next[pupil.enrollmentId] = {
            ...next[pupil.enrollmentId],
            status: "PRESENT",
          };
        }
      }
      return next;
    });
  }

  // Through the same function the query uses, so the figures on screen are the
  // figures that will be stored.
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
          <EmptyState title={t.schoolClass.emptyRoster} />
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      {/* All four from the server's own read of the lesson, never from the
        chip the reader clicked: the action re-derives the class against the
        school anyway, and a form that posted a different subject to the one on
        screen would file the marks under the wrong lesson. */}
      <input type="hidden" name="schoolClassId" value={schoolClassId} />
      <input type="hidden" name="subjectId" value={register.subjectId ?? ""} />
      <input type="hidden" name="timeSlotId" value={register.timeSlotId ?? ""} />
      <input type="hidden" name="date" value={register.date} />

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <Stat
          label={t.classroomOptions.attendanceStatuses.PRESENT}
          value={live.present}
          tone="good"
        />
        <Stat
          label={t.classroomOptions.attendanceStatuses.LATE}
          value={live.late}
          tone={live.late > 0 ? "warn" : undefined}
        />
        <Stat
          label={t.classroomOptions.attendanceStatuses.ABSENT}
          value={live.absent}
          tone={live.absent > 0 ? "bad" : undefined}
        />
        <Stat
          label={t.classroomOptions.attendanceStatuses.EXCUSED}
          value={live.excused}
        />
        <Stat
          label={t.classroom.notMarked}
          value={live.unmarked}
          tone={live.unmarked > 0 ? "warn" : "good"}
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">
              {register.subjectName ?? t.classroom.wholeDay}
              {register.slotLabel ? (
                <span className="text-muted-foreground ms-2 text-xs tabular-nums">
                  {register.slotLabel}
                </span>
              ) : null}
            </h2>
            <p className="text-muted-foreground text-xs">
              {register.groupLabel
                ? interpolate(t.classroom.groupLessonWholeClass, {
                    group: register.groupLabel,
                  })
                : canMark
                  ? t.classroom.standingIn
                  : t.classroom.cannotMark}
            </p>
          </div>

          {canMark ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ms-auto"
              onClick={markRemainingPresent}
              disabled={live.unmarked === 0}
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
                <TableHead className="w-[22rem]">
                  {t.classroom.status}
                </TableHead>
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
                  mark={marks[pupil.enrollmentId]}
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
  mark,
  canMark,
  onChange,
}: {
  pupil: Register["pupils"][number];
  mark: Mark;
  canMark: boolean;
  onChange: (enrollmentId: string, patch: Partial<Mark>) => void;
}) {
  const { t } = useI18n();
  const isLate = mark.status === "LATE";

  const initials = `${pupil.firstName[0] ?? ""}${pupil.lastName[0] ?? ""}`
    .toUpperCase()
    .trim();

  return (
    <TableRow className={cn(mark.status === null && "bg-muted/30")}>
      <TableCell>
        {/*
          The action reads these as parallel arrays indexed by pupil, so every
          row contributes exactly one value to every field — including the ones
          it is not using. Emitted here in one block, inside a cell, for the
          reason the mark sheet gives: a stray input under a `<tr>` is hoisted
          out of the table by the parser and the marks shift onto the wrong
          child.

          An unmarked pupil posts PRESENT, because the whole roster is written
          in one transaction and leaving them out is not an option the shape
          allows. That is what the unmarked tally and the deliberate "Everyone
          present" button are there to make visible before anybody saves.
        */}
        <input type="hidden" name="enrollmentId" value={pupil.enrollmentId} />
        <input type="hidden" name="status" value={mark.status ?? "PRESENT"} />
        <input
          type="hidden"
          name="minutesLate"
          value={isLate ? mark.minutesLate : ""}
        />
        <input type="hidden" name="reason" value={mark.reason} />

        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8 shrink-0">
            {pupil.photoUrl ? <AvatarImage src={pupil.photoUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {pupil.lastName} {pupil.firstName}
            </p>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {pupil.studentCode}
            </p>
          </div>
          {/* The year's running count, beside the decision it informs: a third
            retard is a different fact from a first, and nobody goes looking. */}
          {pupil.absencesThisYear > 0 || pupil.latesThisYear > 0 ? (
            <span className="text-muted-foreground ms-auto shrink-0 text-xs tabular-nums">
              {pupil.absencesThisYear > 0
                ? interpolate(t.classroom.absencesShort, {
                    count: pupil.absencesThisYear,
                  })
                : null}
              {pupil.absencesThisYear > 0 && pupil.latesThisYear > 0 ? " · " : null}
              {pupil.latesThisYear > 0
                ? interpolate(t.classroom.latesShort, {
                    count: pupil.latesThisYear,
                  })
                : null}
            </span>
          ) : null}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap gap-1">
          {ATTENDANCE_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={mark.status === status ? "default" : "outline"}
              disabled={!canMark}
              onClick={() =>
                onChange(pupil.enrollmentId, {
                  status,
                  // A pupil who turned out not to be late keeps no stale figure
                  // — the same rule the service applies when it writes.
                  ...(status === "LATE" ? {} : { minutesLate: "" }),
                })
              }
              className="h-8"
            >
              {t.classroomOptions.attendanceStatuses[status]}
            </Button>
          ))}
        </div>
        {pupil.isJustified ? (
          <Badge variant="outline" className="mt-1">
            {t.classroom.justified}
          </Badge>
        ) : null}
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <Input
          value={mark.minutesLate}
          onChange={(event) =>
            onChange(pupil.enrollmentId, { minutesLate: event.target.value })
          }
          // Only a retard has a number of minutes; anything else greys out
          // rather than being silently ignored on save.
          disabled={!canMark || !isLate}
          type="number"
          min={0}
          max={MAX_MINUTES_LATE}
          dir="ltr"
          aria-label={t.classroom.minutesLate}
          className="h-9 w-20 tabular-nums"
        />
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <Input
          value={mark.reason}
          onChange={(event) =>
            onChange(pupil.enrollmentId, { reason: event.target.value })
          }
          disabled={!canMark || mark.status === null}
          aria-label={t.classroom.reason}
          className="h-9"
        />
      </TableCell>
    </TableRow>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
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
