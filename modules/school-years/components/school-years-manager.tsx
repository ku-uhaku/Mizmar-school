"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarRangeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteSchoolYearAction,
  setDefaultSchoolYearAction,
} from "@/modules/school-years/actions";
import { DataTable } from "@/components/data-table/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  SchoolYearDialog,
  type SchoolYearRow,
} from "@/modules/school-years/components/school-year-dialog";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, interpolate } from "@/lib/i18n/format";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PLANNED: "secondary",
  CLOSED: "outline",
};

export function SchoolYearsManager({
  years,
  permissions,
  currentYearId,
}: {
  years: SchoolYearRow[];
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
  currentYearId: string | null;
}) {
  const { t, locale } = useI18n();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SchoolYearRow | undefined>();
  const [deleting, setDeleting] = React.useState<SchoolYearRow | null>(null);
  const [, startTransition] = React.useTransition();

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function makeDefault(year: SchoolYearRow) {
    startTransition(async () => {
      const result = await setDefaultSchoolYearAction(year.id);
      if (result.status === "success") {
        toast.success(result.message ?? t.schoolYear.updated);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  const columns = React.useMemo<ColumnDef<SchoolYearRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t.schoolYear.name,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium" dir="ltr">
              {row.original.name}
            </span>
            {row.original.isDefault ? (
              <Badge variant="secondary" className="gap-1">
                <StarIcon className="size-3" />
                {t.schoolYear.defaultBadge}
              </Badge>
            ) : null}
            {row.original.id === currentYearId ? (
              <Badge variant="outline">{t.context.schoolYear}</Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "startDate",
        header: t.schoolYear.startDate,
        cell: ({ row }) => formatDate(row.original.startDate, locale),
      },
      {
        accessorKey: "endDate",
        header: t.schoolYear.endDate,
        cell: ({ row }) => formatDate(row.original.endDate, locale),
      },
      {
        accessorKey: "status",
        header: t.schoolYear.status,
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"}>
            {
              t.schoolYear.statuses[
                row.original.status as keyof typeof t.schoolYear.statuses
              ]
            }
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const year = row.original;
          if (!permissions.canUpdate && !permissions.canDelete) return null;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t.common.openMenu}
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {permissions.canUpdate ? (
                    <>
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(year);
                          setDialogOpen(true);
                        }}
                      >
                        <PencilIcon />
                        {t.common.edit}
                      </DropdownMenuItem>
                      {!year.isDefault ? (
                        <DropdownMenuItem onSelect={() => makeDefault(year)}>
                          <StarIcon />
                          {t.schoolYear.makeDefault}
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  ) : null}

                  {permissions.canDelete ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(year)}
                      >
                        <Trash2Icon />
                        {t.common.delete}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, permissions.canUpdate, permissions.canDelete, currentYearId],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={years}
        emptyState={
          <EmptyState
            icon={<CalendarRangeIcon className="size-5" />}
            title={t.schoolYear.noYears}
            action={
              permissions.canCreate ? (
                <Button onClick={openCreate} size="sm">
                  <PlusIcon />
                  {t.schoolYear.newYear}
                </Button>
              ) : undefined
            }
          />
        }
        toolbar={
          permissions.canCreate ? (
            <Button onClick={openCreate} className="ms-auto">
              <PlusIcon />
              {t.schoolYear.newYear}
            </Button>
          ) : undefined
        }
      />

      <SchoolYearDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        year={editing}
      />

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.schoolYear.deleteTitle}
          description={interpolate(t.schoolYear.deleteBody, {
            name: deleting.name,
          })}
          action={() => deleteSchoolYearAction(deleting.id)}
        />
      ) : null}
    </>
  );
}
