"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  EyeIcon,
  LockIcon,
  MessageSquareTextIcon,
  PlusIcon,
} from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  publishRemarkAction,
  saveRemarkAction,
} from "@/modules/classroom/actions";
import {
  REMARK_KINDS,
  REMARK_MAX_LENGTH,
  REMARK_PAGE_SIZE,
  REMARK_TONES,
} from "@/modules/classroom/enums";
import type {
  ClassPupilOption,
  RemarkFilterChoices,
  RemarkRow,
} from "@/modules/classroom/queries";

/**
 * The direction's view of what teachers have written.
 *
 * ── Why this is a vie scolaire screen and not a teacher one ─────────────────
 * `/teacher/remarks` is a carnet: one teacher's own notes, in the space they
 * work out of. This asks the opposite question — across every class and every
 * colleague, what has been written, and what is still waiting on a decision.
 * The two were the same screen for a while and it served neither: a teacher had
 * to scroll past other people's classes, and a director had no way to ask "show
 * me what Mme Bennani wrote this week".
 *
 * ── Filtered on the server ──────────────────────────────────────────────────
 * The carnet filters in the browser because a teacher's own notes are a short
 * list. This one is the school's, and the read is capped — so filtering client
 * side would filter *the newest 200 rows* and quietly hide the rest. Every
 * filter is a query parameter, which also makes a filtered view a link
 * somebody can send to a colleague.
 */

const ALL = "__all__";

const TONE_STYLES: Record<string, string> = {
  POSITIVE: "border-success/30 bg-success/5",
  CONCERN: "border-destructive/30 bg-destructive/5",
  NEUTRAL: "",
};

export function RemarksReview({
  remarks,
  choices,
  filters,
  canPublish,
  canWrite = false,
  pupils = [],
  defaultDate,
}: {
  remarks: RemarkRow[];
  choices: RemarkFilterChoices;
  filters: {
    search: string;
    authorId: string;
    schoolClassId: string;
    tone: string;
    kind: string;
    pendingOnly: boolean;
  };
  canPublish: boolean;
  /** Whether to offer the writing half at all. The action re-checks it. */
  canWrite?: boolean;
  /** Every seated pupil of the school, for the picker. See `listSchoolPupils`. */
  pupils?: ClassPupilOption[];
  /** Today, as a date input value — computed on the server, not in the browser. */
  defaultDate?: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [writing, setWriting] = React.useState(false);

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

  // Debounced so a name is one query at the end rather than one per keystroke.
  const [search, setSearch] = React.useState(filters.search);
  React.useEffect(() => {
    if (search === filters.search) return;
    const timer = setTimeout(() => setFilter("q", search), 350);
    return () => clearTimeout(timer);
  }, [search, filters.search, setFilter]);

  const hasFilter =
    filters.search !== "" ||
    filters.authorId !== "" ||
    filters.schoolClassId !== "" ||
    filters.tone !== "" ||
    filters.kind !== "" ||
    filters.pendingOnly;

  return (
    <div className="grid gap-4" data-pending={pending ? "" : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.classroom.searchRemarks}
          aria-label={t.classroom.searchRemarks}
          className="w-full sm:max-w-56"
        />

        <FilterSelect
          value={filters.authorId || ALL}
          onChange={(value) => setFilter("teacher", value)}
          placeholder={t.classroom.filterTeacher}
          options={choices.teachers}
          allLabel={t.classroom.allTeachers}
        />

        <FilterSelect
          value={filters.schoolClassId || ALL}
          onChange={(value) => setFilter("class", value)}
          placeholder={t.classroom.filterClass}
          options={choices.classes}
          allLabel={t.classroom.allClasses}
        />

        <FilterSelect
          value={filters.tone || ALL}
          onChange={(value) => setFilter("tone", value)}
          placeholder={t.classroom.remarkTone}
          options={REMARK_TONES.map((tone) => ({
            id: tone,
            label: t.classroomOptions.remarkTones[tone],
          }))}
          allLabel={t.common.all}
        />

        <FilterSelect
          value={filters.kind || ALL}
          onChange={(value) => setFilter("kind", value)}
          placeholder={t.classroom.remarkKind}
          options={REMARK_KINDS.map((kind) => ({
            id: kind,
            label: t.classroomOptions.remarkKinds[kind],
          }))}
          allLabel={t.common.all}
        />

        {/* The queue this screen exists for, with the school's whole backlog on
          it — counted in the database rather than off the page, so it keeps
          falling as they work through it. */}
        <Button
          variant={filters.pendingOnly ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter("pending", filters.pendingOnly ? null : "1")}
        >
          <LockIcon />
          {t.classroom.awaitingRelease}
          {choices.pendingCount > 0 ? (
            <Badge variant="secondary" className="ms-1 tabular-nums">
              {choices.pendingCount}
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

        {/*
          Writing one from the review screen.

          The office reads this screen with a parent on the telephone, and until
          now recording what came of that call meant finding the child in a list
          of several hundred on another screen. The pupil is chosen here rather
          than assumed — a class, then a child in it, which is how somebody
          holding a register thinks of a pupil and is far harder to get wrong
          than one long roll of the school.
        */}
        {canWrite && pupils.length > 0 ? (
          <Button className="ms-auto" onClick={() => setWriting(true)}>
            <PlusIcon />
            {t.classroom.newRemark}
          </Button>
        ) : null}
      </div>

      {/*
        Said out loud rather than truncated in silence.

        The read is capped, and on this screen the scope is the whole school —
        so without this a director works through the visible list, sees the
        "awaiting" badge still showing a number, and has no way to tell whether
        that is a bug or a backlog they have not reached. The count in the badge
        is the database's; this is the page's.
      */}
      {remarks.length >= REMARK_PAGE_SIZE ? (
        <p className="text-muted-foreground text-xs">
          {interpolate(t.classroom.showingFirst, { count: REMARK_PAGE_SIZE })}
        </p>
      ) : null}

      {remarks.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<MessageSquareTextIcon className="size-5" />}
              title={hasFilter ? t.common.noResults : t.classroom.noRemarks}
              description={
                hasFilter ? undefined : t.classroom.noRemarksHint
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {remarks.map((remark) => (
            <li key={remark.id}>
              <Card
                className={cn(
                  "gap-0 py-0",
                  TONE_STYLES[remark.tone] ?? TONE_STYLES.NEUTRAL,
                )}
              >
                <CardContent className="grid gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {remark.studentName}
                    </span>
                    <Badge variant="secondary">{remark.classCode}</Badge>
                    <Badge variant="outline">
                      {
                        t.classroomOptions.remarkKinds[
                          remark.kind as keyof typeof t.classroomOptions.remarkKinds
                        ]
                      }
                    </Badge>
                    {remark.subjectName ? (
                      <Badge variant="outline">{remark.subjectName}</Badge>
                    ) : null}

                    {remark.isVisibleToFamily ? (
                      <Badge variant="outline" className="gap-1">
                        <EyeIcon className="size-3" />
                        {t.classroom.visibleToFamily}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <LockIcon className="size-3" />
                        {t.classroom.awaitingRelease}
                      </Badge>
                    )}

                    <span className="text-muted-foreground ms-auto text-xs whitespace-nowrap">
                      {formatDate(remark.occurredOn, locale)}
                    </span>
                  </div>

                  <p className="text-sm whitespace-pre-line">{remark.body}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    {remark.authorName ? (
                      <p className="text-muted-foreground text-xs">
                        {remark.authorName}
                      </p>
                    ) : null}

                    {canPublish ? (
                      <div className="ms-auto">
                        <ReleaseButton remark={remark} />
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {/* Mounted once, outside the list, so it survives a filter change. */}
      {canWrite ? (
        <NewRemarkDialog
          open={writing}
          onOpenChange={setWriting}
          pupils={pupils}
          classes={choices.classes}
          defaultDate={defaultDate ?? ""}
          canPublish={canPublish}
        />
      ) : null}
    </div>
  );
}

/**
 * Writing an observation from the review screen: a class, then a pupil in it.
 *
 * ── Why the pupils all arrive with the page ─────────────────────────────────
 * The class picker filters a list that is already here, so choosing a class is
 * instant and the form has no loading state in the middle of it. A school is a
 * few hundred enrolments — see `listSchoolPupils` — which is worth the bytes to
 * avoid a round trip somebody waits on with a parent on the telephone.
 *
 * Nothing here decides anything: `saveRemarkAction` re-derives the right to
 * write against the signed-in user, resolves the enrolment against their own
 * school, and downgrades `isVisibleToFamily` for anyone without the publish
 * grant whatever this form sent.
 */
function NewRemarkDialog({
  open,
  onOpenChange,
  pupils,
  classes,
  defaultDate,
  canPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pupils: ClassPupilOption[];
  /** Headed by cycle, exactly as the filter above — see `RemarkFilterChoices`. */
  classes: { id: string; label: string; group?: string }[];
  defaultDate: string;
  canPublish: boolean;
}) {
  const { t } = useI18n();
  const [schoolClassId, setSchoolClassId] = React.useState("");
  const [enrollmentId, setEnrollmentId] = React.useState("");

  const [state, formAction] = React.useActionState(saveRemarkAction, IDLE);
  useActionFeedback(state, {
    onSuccess: () => {
      onOpenChange(false);
      // The next remark is rarely about the same child, and a stale name left
      // in the picker is the one mistake this form could make silently.
      setEnrollmentId("");
    },
  });

  const inClass = pupils.filter(
    (pupil) => pupil.schoolClassId === schoolClassId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the dialog default: this form carries five fields across
        two rows, and a pupil's name plus their code does not fit a narrow
        select without being cut off mid-surname — which is the one thing on
        this form somebody has to read to know they picked the right child. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{t.classroom.newRemarkTitle}</DialogTitle>
            <DialogDescription>{t.classroom.remarkBodyHint}</DialogDescription>
          </DialogHeader>

          {/* The chosen pupil travels as a hidden field, and is re-derived
            server-side against the writer's own school — a select is a request
            like any other. */}
          <input type="hidden" name="enrollmentId" value={enrollmentId} />

          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="schoolClassId" label={t.classroom.filterClass}>
                <Select
                  value={schoolClassId}
                  onValueChange={(value) => {
                    setSchoolClassId(value);
                    // The pupil belonged to the class that was there before.
                    setEnrollmentId("");
                  }}
                >
                  <SelectTrigger id="schoolClassId" className="w-full">
                    <SelectValue placeholder={t.classroom.chooseClass} />
                  </SelectTrigger>
                  <SelectContent>
                    {clusterByGroup(classes).map((cluster, index) => (
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
              </FormField>

              <FormField
                name="pupil"
                label={t.classroom.pupil}
                required
                error={state.fieldErrors?.enrollmentId}
              >
                <Select
                  value={enrollmentId}
                  onValueChange={setEnrollmentId}
                  disabled={schoolClassId === ""}
                >
                  <SelectTrigger id="pupil" className="w-full">
                    <SelectValue
                      placeholder={
                        schoolClassId === ""
                          ? t.classroom.chooseClassFirst
                          : t.classroom.choosePupil
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {inClass.map((pupil) => (
                      <SelectItem
                        key={pupil.enrollmentId}
                        value={pupil.enrollmentId}
                      >
                        {pupil.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField name="kind" label={t.classroom.remarkKind}>
                <Select name="kind" defaultValue="BEHAVIOUR">
                  <SelectTrigger id="kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMARK_KINDS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t.classroomOptions.remarkKinds[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField name="tone" label={t.classroom.remarkTone}>
                <Select name="tone" defaultValue="NEUTRAL">
                  <SelectTrigger id="tone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMARK_TONES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t.classroomOptions.remarkTones[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="occurredOn"
                label={t.classroom.occurredOn}
                error={state.fieldErrors?.occurredOn}
              >
                <Input
                  id="occurredOn"
                  name="occurredOn"
                  type="date"
                  defaultValue={defaultDate}
                  dir="ltr"
                  aria-invalid={Boolean(state.fieldErrors?.occurredOn)}
                />
              </FormField>
            </div>

            <FormField
              name="body"
              label={t.classroom.remarkBody}
              required
              error={state.fieldErrors?.body}
            >
              <Textarea
                id="body"
                name="body"
                rows={4}
                maxLength={REMARK_MAX_LENGTH}
                aria-invalid={Boolean(state.fieldErrors?.body)}
              />
            </FormField>

            {canPublish ? (
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="isVisibleToFamily"
                  name="isVisibleToFamily"
                  className="mt-0.5"
                />
                <Label
                  htmlFor="isVisibleToFamily"
                  className="grid cursor-pointer gap-1 font-normal"
                >
                  <span className="text-sm font-medium">
                    {t.classroom.visibleToFamily}
                  </span>
                  <span className="text-muted-foreground text-xs text-pretty">
                    {t.classroom.visibleToFamilyHint}
                  </span>
                </Label>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t.common.cancel}
              </Button>
            </DialogClose>
            <SubmitButton disabled={enrollmentId === ""}>
              {t.common.save}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
        {/* One nameless cluster is the ordinary case — the tones and the kinds
          — and renders as a plain run of items; the classes arrive headed by
          their cycle. */}
        {clusterByGroup(options).map((cluster, index) => (
          <SelectGroup key={cluster.heading ?? index}>
            {cluster.heading ? <SelectLabel>{cluster.heading}</SelectLabel> : null}
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

/** The same control as the carnet's and the pupil file's — see those notes. */
function ReleaseButton({ remark }: { remark: RemarkRow }) {
  const { t } = useI18n();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant={remark.isVisibleToFamily ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await publishRemarkAction(remark.id, !remark.isVisibleToFamily);
        })
      }
    >
      {remark.isVisibleToFamily ? (
        <>
          <LockIcon />
          {t.classroom.withdrawFromFamily}
        </>
      ) : (
        <>
          <EyeIcon />
          {t.classroom.releaseToFamily}
        </>
      )}
    </Button>
  );
}
