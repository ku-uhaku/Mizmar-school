"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheckIcon, Trash2Icon } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { useI18n } from "@/components/providers/i18n-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { deleteAssessmentAction } from "@/modules/assessments/actions";
import { ASSESSMENT_STATUSES } from "@/modules/assessments/enums";
import { GenerateDialog } from "@/modules/assessments/components/generate-dialog";
import type {
  AssessmentRow,
  AssessmentTypeOption,
  ClassOption,
  ProgrammeEntry,
  TermOption,
} from "@/modules/assessments/queries";

/**
 * The papers of a class and term.
 *
 * The class and the term travel in the URL rather than in component state: what
 * a class is sitting is a permission-scoped server read, and keeping it in the
 * address means a reload — or a link sent to a colleague — lands on the same
 * round instead of an empty screen. Same reasoning as the encaissement screen.
 */
export function AssessmentsManager({
  assessments,
  classes,
  terms,
  types,
  programmes,
  classId,
  termId,
  defaultDate,
  permissions,
}: {
  assessments: AssessmentRow[];
  classes: ClassOption[];
  terms: TermOption[];
  types: AssessmentTypeOption[];
  programmes: Record<string, ProgrammeEntry[]>;
  classId: string | null;
  termId: string | null;
  /** Clamped into the school year — see lib/school-year.ts. */
  defaultDate: string;
  permissions: { canManage: boolean; canDelete: boolean };
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [deleting, setDeleting] = React.useState<AssessmentRow | null>(null);

  function navigate(next: { classId?: string; termId?: string }) {
    const params = new URLSearchParams();
    const resolvedClass = next.classId ?? classId;
    const resolvedTerm = next.termId ?? termId;
    if (resolvedClass) params.set("class", resolvedClass);
    if (resolvedTerm) params.set("term", resolvedTerm);
    router.push(`/assessments?${params.toString()}`);
  }

  const columns = React.useMemo<ColumnDef<AssessmentRow, unknown>[]>(
    () => [
      {
        id: "paper",
        accessorFn: (row) => `${row.title} ${row.subjectName} ${row.classCode}`,
        header: t.assessment.paper,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="h-8 w-1 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  row.original.subjectColorHex ??
                  row.original.typeColorHex ??
                  undefined,
              }}
            />
            <div className="min-w-0">
              <Link
                href={`/assessments/${row.original.id}`}
                className="truncate font-medium hover:underline"
              >
                {row.original.title}
              </Link>
              <p className="text-muted-foreground truncate text-xs">
                {row.original.subjectName}
                {row.original.groupLabel ? ` · ${row.original.groupLabel}` : ""}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "typeName",
        header: t.assessment.kind,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.typeCode}</Badge>
        ),
      },
      {
        // The subject facet needs a column of its own to filter: it used to
        // point at an id nothing declared, so the filter did nothing and
        // TanStack logged "Column with id 'subjectName' does not exist".
        // Hidden by default because the subject is already printed under the
        // title in `paper` — the Columns menu can bring it out as its own.
        id: "subjectName",
        accessorFn: (row) => row.subjectName,
        header: t.assessment.subject,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.subjectName}</span>
        ),
      },
      {
        id: "scheduled",
        accessorFn: (row) => row.scheduledOn ?? "",
        header: t.assessment.scheduledOn,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) =>
          row.original.scheduledOn ? (
            <span className="text-sm">
              {formatDate(row.original.scheduledOn, locale)}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">
              {t.assessment.notScheduled}
            </span>
          ),
      },
      {
        id: "progress",
        accessorFn: (row) => row.markedCount,
        header: t.assessment.progress,
        cell: ({ row }) => {
          const { markedCount, absentCount, rosterCount } = row.original;
          const accounted = markedCount + absentCount;
          const done = rosterCount > 0 && accounted >= rosterCount;

          return (
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm tabular-nums",
                  done ? "text-success" : "text-muted-foreground",
                )}
              >
                {interpolate(t.assessment.markedOf, {
                  marked: accounted,
                  total: rosterCount,
                })}
              </p>
              <div className="bg-muted mt-1 h-1 w-20 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full",
                    done ? "bg-success" : "bg-primary",
                  )}
                  style={{
                    width:
                      rosterCount > 0
                        ? `${Math.min(100, (accounted / rosterCount) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          );
        },
      },
      {
        id: "average",
        accessorFn: (row) => row.average ?? -1,
        header: t.assessment.average,
        meta: { className: "hidden @5xl/table:table-cell" },
        cell: ({ row }) =>
          row.original.average === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">
              {formatNumber(row.original.average, locale)}
              <span className="text-muted-foreground">
                /{row.original.maxScore}
              </span>
            </span>
          ),
      },
      {
        accessorKey: "status",
        header: t.school.status,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          if (!permissions.canDelete) return null;
          return (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.common.delete}
                onClick={() => setDeleting(row.original)}
              >
                <Trash2Icon />
              </Button>
            </div>
          );
        },
      },
    ],
    [t, locale, permissions.canDelete],
  );

  const facets = React.useMemo<FacetDef[]>(() => {
    const subjects = [
      ...new Set(assessments.map((row) => row.subjectName)),
    ].sort();

    return [
      {
        columnId: "status",
        label: t.school.status,
        options: ASSESSMENT_STATUSES.map((status) => ({
          value: status,
          label: t.assessmentOptions.statuses[status],
        })),
      },
      {
        columnId: "typeName",
        label: t.assessment.kind,
        options: [...new Set(assessments.map((row) => row.typeName))]
          .sort()
          .map((name) => ({ value: name, label: name })),
      },
      ...(subjects.length > 1
        ? [
            {
              columnId: "subjectName",
              label: t.assessment.subject,
              options: subjects.map((name) => ({ value: name, label: name })),
            },
          ]
        : []),
    ];
  }, [assessments, t]);

  const generateButton = permissions.canManage ? (
    <GenerateDialog
      classes={classes}
      terms={terms}
      types={types}
      programmes={programmes}
      defaultClassId={classId}
      defaultTermId={termId}
      defaultDate={defaultDate}
    />
  ) : undefined;

  return (
    <div className="grid gap-4">
      {/* The two pickers that decide what the table is showing. */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={classId ?? ""}
          onValueChange={(value) => navigate({ classId: value })}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={t.assessment.class} />
          </SelectTrigger>
          <SelectContent>
            {classes.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.code} · {option.levelLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={termId ?? ""}
          onValueChange={(value) => navigate({ termId: value })}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t.assessment.term} />
          </SelectTrigger>
          <SelectContent>
            {terms.map((term) => (
              <SelectItem key={term.id} value={term.id}>
                {term.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={assessments}
        searchPlaceholder={t.assessment.searchPlaceholder}
        facets={facets}
        initialColumnVisibility={{ subjectName: false }}
        pageSize={20}
        emptyState={
          <EmptyState
            icon={<ClipboardCheckIcon className="size-5" />}
            title={t.assessment.noAssessments}
            description={t.assessment.noAssessmentsHint}
            action={generateButton}
          />
        }
        toolbar={generateButton}
      />

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.assessment.deleteTitle}
          description={interpolate(t.assessment.deleteBody, {
            name: deleting.title,
          })}
          action={() => deleteAssessmentAction(deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}

/** Colour carries the state, and the translated label carries it too. */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const label =
    t.assessmentOptions.statuses[
      status as keyof typeof t.assessmentOptions.statuses
    ] ?? status;

  if (status === "GRADED") {
    return (
      <Badge variant="outline" className="text-success border-success/40">
        {label}
      </Badge>
    );
  }
  if (status === "PUBLISHED") return <Badge>{label}</Badge>;
  if (status === "CANCELLED") {
    return <Badge variant="destructive">{label}</Badge>;
  }
  return <Badge variant="secondary">{label}</Badge>;
}
