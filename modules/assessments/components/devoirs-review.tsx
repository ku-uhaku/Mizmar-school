"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { ClipboardCheckIcon, ClipboardListIcon } from "lucide-react";

import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clusterByGroup } from "@/components/form/option-groups";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDLE } from "@/lib/action-state";
import { formatDate, interpolate } from "@/lib/i18n/format";
import {
  setAssessmentCountsAction,
  setAssessmentStatusAction,
} from "@/modules/assessments/actions";
import {
  ASSESSMENT_PAGE_SIZE,
  ASSESSMENT_STAGES,
  awaitingValidation,
  stageOf,
} from "@/modules/assessments/enums";
import type {
  AssessmentFilterChoices,
  AssessmentRow,
  TermOption,
} from "@/modules/assessments/queries";

/**
 * The devoirs the teaching staff has set, seen from the direction.
 *
 * ── Why this screen exists ──────────────────────────────────────────────────
 * A devoir is an `Assessment` like a contrôle, but it is set from the phone and
 * `/assessments` deliberately hides it: that screen is the office's round of
 * contrôles for one class and one term, and interleaving every piece of homework
 * every teacher of the class had set made it unreadable. The consequence was
 * that a devoir existed nowhere on the web at all. A teacher set one, marked it,
 * handed it in — and the office had to already know it existed to go and accept
 * it. Until they did, the marks stayed invisible to the family.
 *
 * So this is the other half of that decision: the whole school's devoirs, across
 * every class and every colleague, with the validation queue on top of them.
 * `AssessmentsAwaiting` shows the same queue on `/assessments`, but only the
 * handed-in ones and with nothing to filter — this is where you come to ask
 * "what has Mme Bennani set this week", which that panel cannot answer.
 *
 * ── Filtered on the server ──────────────────────────────────────────────────
 * The read is capped, and the scope is the school and the year rather than one
 * class — so filtering in the browser would filter *the newest page* and quietly
 * hide the rest. Every filter is a query parameter, which also makes a filtered
 * view a link somebody can send to a colleague.
 */

const ALL = "__all__";

export function DevoirsReview({
  assessments,
  choices,
  terms,
  filters,
  canValidate,
  canReweigh,
}: {
  assessments: AssessmentRow[];
  choices: AssessmentFilterChoices;
  terms: TermOption[];
  filters: {
    search: string;
    teacherId: string;
    schoolClassId: string;
    subjectId: string;
    termId: string;
    stage: string;
  };
  canValidate: boolean;
  /** ASSESSMENT_MANAGE — whether a paper may be moved in or out of the average. */
  canReweigh: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [navigating, startTransition] = React.useTransition();

  const [state, formAction] = React.useActionState(
    setAssessmentStatusAction,
    IDLE,
  );
  useActionFeedback(state);

  // Its own state: reweighting a paper and moving its status are two different
  // results, and sharing one would let the second overwrite the first's toast.
  const [countsState, countsAction] = React.useActionState(
    setAssessmentCountsAction,
    IDLE,
  );
  useActionFeedback(countsState);

  /**
   * Rewrites one filter in the URL, keeping the rest.
   *
   * A replace rather than a push: twelve filter changes should not be twelve
   * entries in the back stack, and the reader's way out of this screen is the
   * one they came in by.
   */
  const setFilter = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "" || value === ALL) next.delete(key);
      else next.set(key, value);

      startTransition(() => {
        router.replace(next.size > 0 ? `?${next.toString()}` : "?");
      });
    },
    [params, router],
  );

  // Debounced so a title is one query at the end rather than one per keystroke.
  const [search, setSearch] = React.useState(filters.search);
  React.useEffect(() => {
    if (search === filters.search) return;
    const timer = setTimeout(() => setFilter("q", search), 350);
    return () => clearTimeout(timer);
  }, [search, filters.search, setFilter]);

  const hasFilter =
    filters.search !== "" ||
    filters.teacherId !== "" ||
    filters.schoolClassId !== "" ||
    filters.subjectId !== "" ||
    filters.termId !== "" ||
    filters.stage !== "";

  const awaitingOnly = filters.stage === "TO_VALIDATE";

  return (
    <div className="grid gap-4" data-pending={navigating ? "" : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.assessment.searchPlaceholder}
          aria-label={t.assessment.searchPlaceholder}
          className="w-full sm:max-w-56"
        />

        <FilterSelect
          value={filters.teacherId || ALL}
          onChange={(value) => setFilter("teacher", value)}
          placeholder={t.assessment.teacher}
          options={choices.teachers}
          allLabel={t.assessment.allTeachers}
        />

        <FilterSelect
          value={filters.schoolClassId || ALL}
          onChange={(value) => setFilter("class", value)}
          placeholder={t.assessment.class}
          options={choices.classes}
          allLabel={t.assessment.allClasses}
        />

        <FilterSelect
          value={filters.subjectId || ALL}
          onChange={(value) => setFilter("subject", value)}
          placeholder={t.assessment.subject}
          options={choices.subjects}
          allLabel={t.assessment.allSubjects}
        />

        <FilterSelect
          value={filters.termId || ALL}
          onChange={(value) => setFilter("term", value)}
          placeholder={t.assessment.term}
          options={terms.map((term) => ({ id: term.id, label: term.label }))}
          allLabel={t.assessmentOptions.stages.ALL}
        />

        <FilterSelect
          value={filters.stage || ALL}
          onChange={(value) => setFilter("stage", value)}
          placeholder={t.assessment.stage}
          options={ASSESSMENT_STAGES.map((stage) => ({
            id: stage,
            label: t.assessmentOptions.stages[stage],
          }))}
          allLabel={t.assessmentOptions.stages.ALL}
        />

        {/* The queue this screen exists for, with the school's whole backlog on
          it — counted in the database rather than off the page, so it keeps
          falling as they work through it. */}
        <Button
          variant={awaitingOnly ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter("stage", awaitingOnly ? null : "TO_VALIDATE")}
        >
          <ClipboardCheckIcon />
          {t.assessmentOptions.stages.TO_VALIDATE}
          {choices.awaitingCount > 0 ? (
            <Badge variant="secondary" className="ms-1 tabular-nums">
              {choices.awaitingCount}
            </Badge>
          ) : null}
        </Button>

        {hasFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              startTransition(() => router.replace("?"));
            }}
          >
            {t.common.reset}
          </Button>
        ) : null}
      </div>

      {/*
        Said out loud rather than truncated in silence. The scope here is the
        whole school's year, so without this somebody works through the visible
        list, sees the "to validate" badge still showing a number, and has no way
        to tell a bug from a backlog they have not reached. The count in the
        badge is the database's; this is the page's.
      */}
      {assessments.length >= ASSESSMENT_PAGE_SIZE ? (
        <p className="text-muted-foreground text-xs">
          {interpolate(t.assessment.showingFirst, {
            count: ASSESSMENT_PAGE_SIZE,
          })}
        </p>
      ) : null}

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<ClipboardListIcon className="size-5" />}
              title={hasFilter ? t.common.noResults : t.assessment.noDevoirs}
              description={hasFilter ? undefined : t.assessment.noDevoirsHint}
            />
          </CardContent>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {assessments.map((assessment) => (
            <li key={assessment.id}>
              <DevoirCard
                assessment={assessment}
                canValidate={canValidate}
                canReweigh={canReweigh}
                formAction={formAction}
                countsAction={countsAction}
                locale={locale}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** One paper, with how far its marking has got and whose move it is. */
function DevoirCard({
  assessment,
  canValidate,
  canReweigh,
  formAction,
  countsAction,
  locale,
}: {
  assessment: AssessmentRow;
  canValidate: boolean;
  canReweigh: boolean;
  formAction: (formData: FormData) => void;
  countsAction: (formData: FormData) => void;
  locale: Parameters<typeof formatDate>[1];
}) {
  const { t } = useI18n();
  const stage = stageOf(assessment.status);
  const isAwaiting = awaitingValidation(assessment.status);

  return (
    <Card className={isAwaiting ? "border-warning/40 bg-warning/5 gap-0 py-0" : "gap-0 py-0"}>
      <CardContent className="grid gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/assessments/${assessment.id}`}
            className="text-sm font-medium hover:underline"
          >
            {assessment.title}
          </Link>
          <Badge variant="secondary">{assessment.classCode}</Badge>
          {assessment.groupLabel ? (
            <Badge variant="outline">{assessment.groupLabel}</Badge>
          ) : null}
          <Badge variant="outline">{assessment.subjectLabel}</Badge>
          <Badge variant="outline">{assessment.typeLabel}</Badge>

          <span className="text-muted-foreground ms-auto text-xs whitespace-nowrap">
            {assessment.scheduledOn
              ? formatDate(assessment.scheduledOn, locale)
              : t.assessment.notScheduled}
          </span>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>{assessment.termLabel}</span>
          {assessment.teacherName ? <span>{assessment.teacherName}</span> : null}
          <span className="tabular-nums">
            {interpolate(t.assessment.markedOf, {
              marked: assessment.markedCount,
              total: assessment.rosterCount,
            })}
          </span>
          {assessment.average !== null ? (
            <span className="tabular-nums">
              {t.assessment.average}: {assessment.average}/{assessment.maxScore}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* The status as "whose move is it", which is the question this screen
              is opened with. A cancelled paper has no stage and says so with its
              status instead — nobody is waiting on it. */}
          <Badge variant="outline">
            {stage
              ? t.assessmentOptions.stages[stage]
              : t.assessmentOptions.statuses[
                  assessment.status as keyof typeof t.assessmentOptions.statuses
                ]}
          </Badge>

          {/* Said on the row, not only in the edit form. A paper outside the
            average looks exactly like one inside it — same marks, same class,
            same badge — and the whole reason a school marks work this way is
            that the distinction is invisible otherwise. Only the exception is
            shown: "counts" is the ordinary case and a badge on every row would
            say nothing. */}
          {assessment.countsTowardAverage ? null : (
            <Badge variant="secondary">{t.assessment.doesNotCount}</Badge>
          )}

          <div className="ms-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/assessments/${assessment.id}`}>
                {t.assessment.markSheet}
              </Link>
            </Button>

            {/*
              One form per row rather than one shared one: the paper's id is a
              hidden field, and a single form would need it swapped in before
              every submit — which is exactly the sort of thing that validates
              the wrong paper when two are pressed quickly.

              Accepting is refused server-side if the sheet is unfinished, and
              the message says so. That check is not repeated here: pressing it
              on a paper with two marks missing should tell the reader which rule
              stopped them, not leave a button mysteriously disabled.
            */}
            {canValidate && isAwaiting ? (
              <form action={formAction}>
                <input type="hidden" name="id" value={assessment.id} />
                <input type="hidden" name="status" value="GRADED" />
                <Button type="submit" size="sm">
                  {t.assessment.acceptMarks}
                </Button>
              </form>
            ) : null}

            {/*
              The other end of the same queue, and the half this screen was
              missing. A devoir set from here is written DRAFT — nothing has
              been said to the class or the families yet — and publishing is
              the one decision that both announces it and opens its mark sheet.
              Without this the office could set a devoir on this screen and
              then had to go and find the paper to release it.
            */}
            {/*
              Moving a paper in or out of the average, from the list.

              A devoir set on the phone has no such box — the office decides
              afterwards that this one was revision. Sending them through a full
              edit form to change a boolean is how it would never get done.
            */}
            {canReweigh ? (
              <form action={countsAction}>
                <input type="hidden" name="id" value={assessment.id} />
                {/* The value asked for, not the value held: an unticked
                  checkbox posts nothing, and "nothing" would read as false on
                  the way back and make the button one-way. */}
                <input
                  type="hidden"
                  name="countsTowardAverage"
                  value={assessment.countsTowardAverage ? "0" : "1"}
                />
                <Button type="submit" variant="ghost" size="sm">
                  {assessment.countsTowardAverage
                    ? t.assessment.makeNotCount
                    : t.assessment.makeCount}
                </Button>
              </form>
            ) : null}

            {canValidate && stage === "TO_PUBLISH" ? (
              <form action={formAction}>
                <input type="hidden" name="id" value={assessment.id} />
                <input type="hidden" name="status" value="PUBLISHED" />
                <Button type="submit" size="sm">
                  {t.assessment.publish}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** One picker, with an "all" entry that clears rather than selects. */
function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** `group` heads the option; set it on all of them or on none. */
  options: { id: string; label: string; group?: string }[];
  allLabel: string;
}) {
  if (options.length === 0) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-36" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {/* One nameless cluster is the ordinary case and renders as a plain
          run of items; the classes arrive headed by their cycle. */}
        {clusterByGroup(options).map((cluster, index) => (
          <SelectGroup key={cluster.heading ?? index}>
            {cluster.heading ? (
              <SelectLabel>{cluster.heading}</SelectLabel>
            ) : null}
            {cluster.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
