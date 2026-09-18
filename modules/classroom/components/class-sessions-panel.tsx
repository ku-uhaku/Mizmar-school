"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  CalendarOffIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  LockIcon,
  MoreHorizontalIcon,
  SaveIcon,
  SearchIcon,
  UnlockIcon,
} from "lucide-react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  reopenSessionAction,
  saveSessionAction,
} from "@/modules/classroom/actions";
import {
  MAX_MINUTES_LATE,
  SESSION_TEXT_MAX,
  type AttendanceStatus,
} from "@/modules/classroom/enums";
import { DAY_SESSIONS } from "@/modules/timetable/enums";
import type {
  ClassDay,
  ClassLesson,
  ClassSessionRow,
  Register,
} from "@/modules/classroom/queries";

/**
 * La séance, from the class file: what was taught, and who was in the room.
 *
 * ── Why the appel opens on "everyone present" ───────────────────────────────
 * The sheet used to open blank and ask for a decision per pupil — thirty-five
 * taps to record a class where nobody was missing. That is backwards: an appel
 * is a search for the empty chairs, and the teacher already knows the rest
 * turned up. So presence is the default and only the exceptions are marked,
 * which is also why there is no "unmarked" count any more. Whether the register
 * was taken at all is the séance's own business now (`isClosed`), not something
 * inferred from counting rows.
 *
 * ── The day is in the URL, the marks are in the browser ─────────────────────
 * The date and the period are query parameters, so the roster is read on the
 * server with everything already recorded against it and a half-taken register
 * is a link somebody can send. The marks stay local until Save, for the same
 * reason the mark sheet's do: an appel is one pass in front of a class, and a
 * round trip per pupil is a chance to lose one.
 */
export function ClassSessionsPanel({
  schoolClassId,
  day,
  register,
  journal,
  selectedTimeSlotId,
  canMark,
  canReopen,
}: {
  schoolClassId: string;
  /** The class's lessons on the date in the URL — see `listClassLessons`. */
  day: ClassDay;
  /** The selected period's roster. Null when the day has no séance selected. */
  register: Register | null;
  /** The class's recent séances — the cahier de textes. */
  journal: ClassSessionRow[];
  selectedTimeSlotId: string | null;
  /** CLASSROOM_ATTENDANCE_MARK. A reader without it sees the sheet read-only. */
  canMark: boolean;
  /** CLASSROOM_ATTENDANCE_JUSTIFY. May reopen a closed séance. */
  canReopen: boolean;
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
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      startTransition(() => {
        router.replace(next.size > 0 ? `?${next.toString()}` : "?");
      });
    },
    [params, router],
  );

  /** Steps a whole day, which is what somebody catching up actually does. */
  function shiftDay(days: number) {
    const [year, month, date] = day.date.split("-").map(Number);
    const moved = new Date(year!, month! - 1, date! + days);
    setParam({
      reg_date: toDateValue(moved),
      // The period of one day means nothing on the next.
      reg_slot: null,
    });
  }

  return (
    <div className="grid gap-4">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-medium">{t.classroom.sessions}</h2>
            <p className="text-muted-foreground text-xs">
              {t.classroom.sessionsHint}
            </p>
          </div>

          <div className="ms-auto flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => shiftDay(-1)}
              aria-label={t.common.previous}
            >
              {/* Logical, not left: the day before is to the right in Arabic. */}
              <ChevronLeftIcon className="rtl:rotate-180" />
            </Button>
            <Input
              type="date"
              value={day.date}
              // An empty box would read the whole year's registers as one, so a
              // cleared date falls back to the day it was showing.
              onChange={(event) =>
                setParam({
                  reg_date: event.target.value || day.date,
                  reg_slot: null,
                })
              }
              className="h-9 w-40"
              dir="ltr"
              aria-label={t.classroom.date}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => shiftDay(1)}
              aria-label={t.common.next}
            >
              <ChevronRightIcon className="rtl:rotate-180" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ms-1"
              onClick={() =>
                setParam({ reg_date: toDateValue(new Date()), reg_slot: null })
              }
            >
              {t.classroom.today}
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {day.lessons.length === 0 ? (
            <div className="p-4">
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
            </div>
          ) : (
            /*
              Split into morning and afternoon, which is how a school day is
              actually spoken about — and the bell schedule already knows which
              half a period belongs to, so the grouping is read rather than
              guessed. A flat list of fifteen identical rows is a wall; two
              short lists under their own headings is a day.
            */
            <div className="grid gap-4 p-4">
              {DAY_SESSIONS.map((half) => {
                const lessons = day.lessons.filter(
                  (lesson) => lesson.session === half,
                );
                if (lessons.length === 0) return null;

                return (
                  <div key={half}>
                    <h3 className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
                      {t.timetable.daySessions[half]}
                    </h3>
                    <ul className="grid gap-1.5">
                      {lessons.map((lesson) => (
                        <LessonRow
                          key={`${lesson.timeSlotId}:${lesson.classGroupId ?? ""}`}
                          lesson={lesson}
                          isSelected={lesson.timeSlotId === selectedTimeSlotId}
                          onSelect={() =>
                            setParam({ reg_slot: lesson.timeSlotId })
                          }
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {register ? (
        <SessionSheet
          key={`${register.date}:${register.timeSlotId ?? ""}`}
          schoolClassId={schoolClassId}
          register={register}
          canMark={canMark}
          canReopen={canReopen}
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

      <Journal
        rows={journal}
        onOpen={(row) => setParam({ reg_date: row.date, reg_slot: null })}
      />
    </div>
  );
}

/** `YYYY-MM-DD` in local time — never `toISOString`, which shifts the day. */
function toDateValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * One séance of the day: what, when, who, and how far the appel has got.
 *
 * The subject leads and the clock follows it. A day is read by looking for a
 * lesson, not for a time — and the times are near-identical strings down the
 * column, so leading with them made every row look the same.
 */
function LessonRow({
  lesson,
  isSelected,
  onSelect,
}: {
  lesson: ClassLesson;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const isCancelled =
    lesson.exceptionKind === "CANCELLED" ||
    lesson.sessionStatus === "CANCELLED";

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        // A cancelled period is still shown — a reader looking for it must be
        // told it was called off, not left wondering why it is missing — but
        // there is no register to take for a lesson nobody sat.
        disabled={isCancelled}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors",
          isSelected
            ? "border-primary bg-accent"
            : "hover:bg-accent/50 border-transparent",
          isCancelled && "opacity-60",
        )}
        aria-pressed={isSelected}
      >
        {/* The subject's colour as a bar rather than a dot: it is the one thing
          that tells two rows apart at a glance. */}
        <span
          aria-hidden
          className="h-9 w-1 shrink-0 rounded-full"
          style={{
            backgroundColor: lesson.subjectColorHex ?? "var(--color-border)",
          }}
        />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {lesson.subjectName}
            </span>
            {lesson.groupLabel ? (
              <Badge variant="outline" className="font-normal">
                {lesson.groupLabel}
              </Badge>
            ) : null}
          </span>
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {lesson.periods > 1
              ? `${interpolate(t.classroom.periodCount, { count: lesson.periods })} · `
              : ""}
            {lesson.teacherName ?? "—"}
            {lesson.roomCode ? ` · ${lesson.roomCode}` : ""}
          </span>
        </span>

        <span className="shrink-0 text-end">
          <span className="block text-xs tabular-nums" dir="ltr">
            {lesson.startTime} — {lesson.endTime}
          </span>
          <span className="mt-0.5 flex items-center justify-end gap-1.5">
            {/* What the register found, where a reader is already looking. */}
            {lesson.absent > 0 || lesson.late > 0 ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {lesson.absent > 0
                  ? interpolate(t.classroom.absentCount, {
                      count: lesson.absent,
                    })
                  : null}
                {lesson.absent > 0 && lesson.late > 0 ? " · " : null}
                {lesson.late > 0
                  ? interpolate(t.classroom.lateCount, { count: lesson.late })
                  : null}
              </span>
            ) : null}
            <Badge
              variant={
                !isCancelled && lesson.isClosed ? "secondary" : "outline"
              }
            >
              {isCancelled
                ? lesson.exceptionKind === "CANCELLED"
                  ? t.classroom.lessonCancelled
                  : t.classroom.sessionCancelled
                : lesson.isClosed
                  ? t.classroom.taken
                  : t.classroom.notTakenYet}
            </Badge>
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * A pupil's mark while the sheet is open.
 *
 * `null` is present: nothing has been said about them, and that is exactly what
 * the register will record. Only the three exceptions are ever stored here.
 */
type Exception = Exclude<AttendanceStatus, "PRESENT">;

type Mark = {
  status: Exception | null;
  minutesLate: string;
  reason: string;
};

const EXCEPTIONS: readonly Exception[] = ["ABSENT", "LATE", "EXCUSED"];

/** The séance itself: the cahier de textes above, the appel below. */
function SessionSheet({
  schoolClassId,
  register,
  canMark,
  canReopen,
}: {
  schoolClassId: string;
  register: Register;
  canMark: boolean;
  canReopen: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction] = React.useActionState(saveSessionAction, IDLE);
  useActionFeedback(state);

  const [reopenState, reopenAction] = React.useActionState(
    reopenSessionAction,
    IDLE,
  );
  useActionFeedback(reopenState);

  const [marks, setMarks] = React.useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      register.pupils.map((pupil) => [
        pupil.enrollmentId,
        {
          status:
            pupil.status && pupil.status !== "PRESENT"
              ? (pupil.status as Exception)
              : null,
          minutesLate:
            pupil.minutesLate === null ? "" : String(pupil.minutesLate),
          reason: pupil.reason ?? "",
        },
      ]),
    ),
  );
  const [isCancelled, setIsCancelled] = React.useState(register.isCancelled);
  const [search, setSearch] = React.useState("");

  // Closed means final: the sheet reads, and only the office can lift it.
  const isReadOnly = !canMark || register.isClosed;

  function update(enrollmentId: string, patch: Partial<Mark>) {
    setMarks((current) => ({
      ...current,
      [enrollmentId]: { ...current[enrollmentId]!, ...patch },
    }));
  }

  /** Sets a pupil's state outright, clearing what no longer applies. */
  function setStatus(enrollmentId: string, status: Exception | null) {
    update(enrollmentId, {
      status,
      // A pupil who turned out not to be late keeps no stale figure — the same
      // rule the service applies when it writes.
      ...(status === "LATE" ? {} : { minutesLate: "" }),
      ...(status === null ? { reason: "" } : {}),
    });
  }

  /**
   * Tapping a tile walks the states a teacher actually calls out.
   *
   * Présent → absent → retard → présent. Excusé is off the cycle on purpose: it
   * means the office has accepted a reason, which is not something decided
   * standing in front of the class, so it lives on the tile's own menu.
   */
  function cycle(enrollmentId: string) {
    const current = marks[enrollmentId]!.status;
    setStatus(
      enrollmentId,
      current === null ? "ABSENT" : current === "ABSENT" ? "LATE" : null,
    );
  }

  const counts = React.useMemo(() => {
    const flagged = Object.values(marks);
    const of = (status: Exception) =>
      flagged.filter((mark) => mark.status === status).length;
    const absent = of("ABSENT");
    const late = of("LATE");
    const excused = of("EXCUSED");
    return {
      absent,
      late,
      excused,
      present: register.pupils.length - absent - late - excused,
    };
  }, [marks, register.pupils.length]);

  const needle = search.trim().toLowerCase();
  const shown = needle
    ? register.pupils.filter((pupil) =>
        `${pupil.lastName} ${pupil.firstName} ${pupil.studentCode}`
          .toLowerCase()
          .includes(needle),
      )
    : register.pupils;

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
      {/* All four from the server's own read of the séance, never from the row
        the reader clicked: the action re-derives the class against the school
        anyway, and a form that posted a different subject to the one on screen
        would file the marks under the wrong lesson. */}
      <input type="hidden" name="schoolClassId" value={schoolClassId} />
      <input type="hidden" name="subjectId" value={register.subjectId ?? ""} />
      <input type="hidden" name="timeSlotId" value={register.timeSlotId ?? ""} />
      <input type="hidden" name="date" value={register.date} />
      <input
        type="hidden"
        name="isCancelled"
        value={isCancelled ? "on" : ""}
      />

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
              {register.isClosed
                ? t.classroom.sessionClosedHint
                : register.groupLabel
                  ? interpolate(t.classroom.groupLessonWholeClass, {
                      group: register.groupLabel,
                    })
                  : canMark
                    ? t.classroom.standingIn
                    : t.classroom.cannotMark}
            </p>
          </div>

          <div className="ms-auto flex items-center gap-2">
            {register.isClosed ? (
              <Badge variant="secondary">
                <LockIcon className="size-3" />
                {t.classroom.sessionClosed}
              </Badge>
            ) : null}
            {canReopen && register.isClosed && register.sessionId ? (
              <ReopenButton sessionId={register.sessionId} action={reopenAction} />
            ) : null}
          </div>
        </div>

        {/* ── The cahier de textes ──────────────────────────────────────── */}
        <div className="grid gap-4 border-b p-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="session-theme">{t.classroom.theme}</Label>
            <Textarea
              id="session-theme"
              name="theme"
              defaultValue={register.theme ?? ""}
              placeholder={t.classroom.themePlaceholder}
              maxLength={SESSION_TEXT_MAX}
              rows={3}
              disabled={isReadOnly}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="session-homework">{t.classroom.homework}</Label>
            <Textarea
              id="session-homework"
              name="homework"
              defaultValue={register.homework ?? ""}
              placeholder={t.classroom.homeworkPlaceholder}
              maxLength={SESSION_TEXT_MAX}
              rows={3}
              disabled={isReadOnly}
            />
          </div>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={isCancelled}
              onCheckedChange={(checked) => setIsCancelled(checked === true)}
              disabled={isReadOnly}
            />
            <span>{t.classroom.markCancelled}</span>
            <span className="text-muted-foreground text-xs">
              {t.classroom.markCancelledHint}
            </span>
          </label>
        </div>

        {/* ── The appel ─────────────────────────────────────────────────── */}
        {isCancelled ? null : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
              <p className="text-sm tabular-nums">
                <span className="text-success font-medium">
                  {interpolate(t.classroom.presentCount, {
                    count: counts.present,
                  })}
                </span>
                {counts.absent > 0 ? (
                  <span className="text-destructive ms-3 font-medium">
                    {interpolate(t.classroom.absentCount, {
                      count: counts.absent,
                    })}
                  </span>
                ) : null}
                {counts.late > 0 ? (
                  <span className="text-warning ms-3 font-medium">
                    {interpolate(t.classroom.lateCount, { count: counts.late })}
                  </span>
                ) : null}
                {counts.excused > 0 ? (
                  <span className="text-muted-foreground ms-3">
                    {t.classroomOptions.attendanceStatuses.EXCUSED} ·{" "}
                    {counts.excused}
                  </span>
                ) : null}
              </p>

              <div className="relative ms-auto">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.classroom.findPupil}
                  aria-label={t.classroom.findPupil}
                  className="h-9 w-48 ps-8"
                />
              </div>
            </div>

            {!isReadOnly ? (
              <p className="text-muted-foreground border-b px-4 py-2 text-xs">
                {t.classroom.presentByDefault}
              </p>
            ) : null}

            {/*
              A seating chart, not a list. Thirty-five rows of buttons is a form
              to fill in; a grid of names is a room to look at, and the two that
              are wrong stand out by colour before anybody reads a word.
            */}
            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((pupil) => (
                <PupilTile
                  key={pupil.enrollmentId}
                  pupil={pupil}
                  mark={marks[pupil.enrollmentId]!}
                  isReadOnly={isReadOnly}
                  onCycle={cycle}
                  onSet={(status) => setStatus(pupil.enrollmentId, status)}
                  onChange={update}
                />
              ))}
            </div>
          </>
        )}

        {/* Every pupil posts a row, shown or filtered out: the action reads
          parallel arrays and the whole roster is written in one transaction,
          so a search box must not silently drop the pupils it hides. */}
        {isCancelled
          ? null
          : register.pupils.map((pupil) => (
              <React.Fragment key={`fields-${pupil.enrollmentId}`}>
                <input
                  type="hidden"
                  name="enrollmentId"
                  value={pupil.enrollmentId}
                />
                <input
                  type="hidden"
                  name="status"
                  value={marks[pupil.enrollmentId]?.status ?? "PRESENT"}
                />
                <input
                  type="hidden"
                  name="minutesLate"
                  value={
                    marks[pupil.enrollmentId]?.status === "LATE"
                      ? (marks[pupil.enrollmentId]?.minutesLate ?? "")
                      : ""
                  }
                />
                <input
                  type="hidden"
                  name="reason"
                  value={marks[pupil.enrollmentId]?.reason ?? ""}
                />
              </React.Fragment>
            ))}
      </Card>

      {!isReadOnly ? (
        <div className="flex justify-end">
          <SubmitButton size="lg">
            <SaveIcon />
            {t.classroom.saveSession}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

/**
 * Reopening is its own form, posted outside the sheet's.
 *
 * Nested forms are not a thing the HTML parser allows, and this one must reach
 * a different action with a different permission behind it.
 */
function ReopenButton({
  sessionId,
  action,
}: {
  sessionId: string;
  action: (formData: FormData) => void;
}) {
  const { t } = useI18n();

  return (
    <form
      action={action}
      // Outside the enclosing <form> in the DOM sense: React renders it as a
      // sibling because this component is not nested inside it.
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton variant="outline" size="sm">
        <UnlockIcon />
        {t.classroom.reopenSession}
      </SubmitButton>
    </form>
  );
}

/**
 * One pupil in the room.
 *
 * Quiet while they are present — a name and nothing else — and loud the moment
 * they are not. The tile itself is the control: tapping it walks the states
 * (see `cycle`), and the menu beside it reaches the two that a tap should not
 * decide, plus the minutes and the reason once there is something to explain.
 */
function PupilTile({
  pupil,
  mark,
  isReadOnly,
  onCycle,
  onSet,
  onChange,
}: {
  pupil: Register["pupils"][number];
  mark: Mark;
  isReadOnly: boolean;
  onCycle: (enrollmentId: string) => void;
  onSet: (status: Exception | null) => void;
  onChange: (enrollmentId: string, patch: Partial<Mark>) => void;
}) {
  const { t } = useI18n();
  const initials = `${pupil.firstName[0] ?? ""}${pupil.lastName[0] ?? ""}`
    .toUpperCase()
    .trim();

  const tone =
    mark.status === "ABSENT"
      ? "border-destructive/40 bg-destructive/10"
      : mark.status === "LATE"
        ? "border-warning/40 bg-warning/10"
        : mark.status === "EXCUSED"
          ? "border-muted-foreground/30 bg-muted"
          : "hover:bg-accent/50";

  return (
    <div className={cn("rounded-lg border p-2 transition-colors", tone)}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onCycle(pupil.enrollmentId)}
          disabled={isReadOnly}
          className="flex min-w-0 flex-1 items-center gap-2 text-start disabled:cursor-default"
          aria-label={`${pupil.lastName} ${pupil.firstName}`}
        >
          <Avatar className="size-7 shrink-0">
            {pupil.photoUrl ? <AvatarImage src={pupil.photoUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {pupil.lastName}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {pupil.firstName}
            </span>
          </span>
        </button>

        {!isReadOnly ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={t.classroom.status}
              >
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onSet(null)}>
                {t.classroomOptions.attendanceStatuses.PRESENT}
              </DropdownMenuItem>
              {EXCEPTIONS.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => onSet(status)}
                >
                  {t.classroomOptions.attendanceStatuses[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* The year's running count, beside the decision it informs: a third
        retard is a different fact from a first, and nobody goes looking. */}
      {mark.status === null &&
      (pupil.absencesThisYear > 0 || pupil.latesThisYear > 0) ? (
        <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
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
        </p>
      ) : null}

      {mark.status !== null ? (
        <div className="mt-1.5 grid gap-1.5">
          <div className="flex items-center gap-1.5">
            <Badge
              variant={mark.status === "ABSENT" ? "destructive" : "secondary"}
            >
              {t.classroomOptions.attendanceStatuses[mark.status]}
            </Badge>
            {pupil.isJustified ? (
              <Badge variant="outline">{t.classroom.justified}</Badge>
            ) : null}
            {mark.status === "LATE" ? (
              <Input
                value={mark.minutesLate}
                onChange={(event) =>
                  onChange(pupil.enrollmentId, {
                    minutesLate: event.target.value,
                  })
                }
                disabled={isReadOnly}
                type="number"
                min={0}
                max={MAX_MINUTES_LATE}
                dir="ltr"
                aria-label={t.classroom.minutesLate}
                className="h-7 w-16 tabular-nums"
              />
            ) : null}
          </div>
          <Input
            value={mark.reason}
            onChange={(event) =>
              onChange(pupil.enrollmentId, { reason: event.target.value })
            }
            disabled={isReadOnly}
            placeholder={t.classroom.reason}
            aria-label={t.classroom.reason}
            className="h-7 text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}

/** The class's cahier de textes, newest first. */
function Journal({
  rows,
  onOpen,
}: {
  rows: ClassSessionRow[];
  onOpen: (row: ClassSessionRow) => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="gap-0 py-0">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-medium">{t.classroom.journal}</h2>
        <p className="text-muted-foreground text-xs">
          {t.classroom.journalHint}
        </p>
      </div>

      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={t.classroom.noSessionsYet}
              description={t.classroom.noSessionsYetHint}
            />
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className="hover:bg-accent/50 flex w-full flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-start transition-colors"
                >
                  <span className="w-24 shrink-0 text-xs tabular-nums" dir="ltr">
                    {row.date}
                  </span>
                  <span
                    className="text-muted-foreground w-28 shrink-0 text-xs tabular-nums"
                    dir="ltr"
                  >
                    {row.slotLabel ?? t.classroom.wholeDay}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {row.subjectColorHex ? (
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.subjectColorHex }}
                        />
                      ) : null}
                      <span className="truncate">{row.subjectName ?? "—"}</span>
                      {row.groupLabel ? (
                        <Badge variant="outline" className="font-normal">
                          {row.groupLabel}
                        </Badge>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-xs",
                        row.theme
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60 italic",
                      )}
                    >
                      {row.status === "CANCELLED"
                        ? t.classroom.sessionCancelled
                        : (row.theme ?? t.classroom.noTheme)}
                    </span>
                  </span>

                  {row.absent > 0 || row.late > 0 ? (
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {row.absent > 0
                        ? interpolate(t.classroom.absentCount, {
                            count: row.absent,
                          })
                        : null}
                      {row.absent > 0 && row.late > 0 ? " · " : null}
                      {row.late > 0
                        ? interpolate(t.classroom.lateCount, {
                            count: row.late,
                          })
                        : null}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
