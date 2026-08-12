"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { EyeIcon, LockIcon, MessageSquareTextIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { publishRemarkAction } from "@/modules/classroom/actions";
import {
  REMARK_KINDS,
  REMARK_PAGE_SIZE,
  REMARK_TONES,
} from "@/modules/classroom/enums";
import type {
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
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

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
    </div>
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
  options: { id: string; label: string }[];
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
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
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
