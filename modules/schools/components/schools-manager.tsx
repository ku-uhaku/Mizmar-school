"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SchoolIcon,
  TargetIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { switchSchoolAction } from "@/modules/context/actions";
import { deleteSchoolAction } from "@/modules/schools/actions";
import { useI18n } from "@/components/providers/i18n-provider";
import { DataTable } from "@/components/data-table/data-table";
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
import { interpolate } from "@/lib/i18n/format";
import { isDisplayableImage } from "@/lib/images";

export type SchoolRow = {
  id: string;
  code: string;
  name: string;
  level: string;
  directorName: string | null;
  capacity: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  isActive: boolean;
  yearCount: number;
  memberCount: number;
};

export type SchoolPermissions = {
  canCreate: boolean;
  canDelete: boolean;
  /** Ids the user may edit — a director can edit only their own school. */
  editableIds: string[];
};

export function SchoolsManager({
  schools,
  permissions,
  currentSchoolId,
}: {
  schools: SchoolRow[];
  permissions: SchoolPermissions;
  currentSchoolId: string | null;
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = React.useState<SchoolRow | null>(null);
  const [, startTransition] = React.useTransition();

  const editable = React.useMemo(
    () => new Set(permissions.editableIds),
    [permissions.editableIds],
  );

  function makeCurrent(school: SchoolRow) {
    startTransition(async () => {
      const result = await switchSchoolAction(school.id);
      if (result.status === "success") {
        toast.success(result.message ?? t.context.switched);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  const columns = React.useMemo<ColumnDef<SchoolRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t.school.name,
        cell: ({ row }) => {
          const school = row.original;
          const canEdit = editable.has(school.id);

          return (
            <div className="flex min-w-0 items-center gap-3">
              {/* The crest when there is one, the generic mark otherwise. */}
              {isDisplayableImage(school.logoUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={school.logoUrl as string}
                  alt=""
                  className="bg-background size-9 shrink-0 rounded-lg border object-contain"
                />
              ) : (
                <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <SchoolIcon className="size-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <Link
                      href={`/schools/${school.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {school.name}
                    </Link>
                  ) : (
                    <span className="truncate font-medium">{school.name}</span>
                  )}
                  {school.id === currentSchoolId ? (
                    <Badge variant="secondary" className="shrink-0">
                      {t.common.current}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-muted-foreground text-xs" dir="ltr">
                  {school.code}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "level",
        header: t.school.level,
        cell: ({ row }) => (
          <Badge variant="outline">
            {t.school.levels[row.original.level as keyof typeof t.school.levels]}
          </Badge>
        ),
      },
      {
        accessorKey: "city",
        header: t.school.city,
        cell: ({ row }) => row.original.city ?? "—",
      },
      {
        accessorKey: "directorName",
        header: t.school.director,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => row.original.directorName ?? "—",
      },
      {
        accessorKey: "yearCount",
        header: t.school.years,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.yearCount}</span>
        ),
      },
      {
        accessorKey: "memberCount",
        header: t.school.members,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.memberCount}</span>
        ),
      },
      {
        accessorKey: "isActive",
        header: t.school.status,
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2Icon className="size-3" />
              {t.common.active}
            </Badge>
          ) : (
            <Badge variant="outline">{t.common.inactive}</Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const school = row.original;
          const canEdit = editable.has(school.id);
          const isCurrent = school.id === currentSchoolId;
          if (!canEdit && !permissions.canDelete && isCurrent) return null;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.common.openMenu}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isCurrent ? (
                    <DropdownMenuItem onSelect={() => makeCurrent(school)}>
                      <TargetIcon />
                      {t.context.switchSchool}
                    </DropdownMenuItem>
                  ) : null}

                  {canEdit ? (
                    <DropdownMenuItem asChild>
                      <Link href={`/schools/${school.id}`}>
                        <PencilIcon />
                        {t.common.edit}
                      </Link>
                    </DropdownMenuItem>
                  ) : null}

                  {permissions.canDelete ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(school)}
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
    [t, editable, permissions.canDelete, currentSchoolId],
  );

  const newButton = permissions.canCreate ? (
    <Button asChild>
      <Link href="/schools/new">
        <PlusIcon />
        {t.school.newSchool}
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <DataTable
        columns={columns}
        data={schools}
        searchPlaceholder={t.school.searchPlaceholder}
        emptyState={
          <EmptyState
            icon={<SchoolIcon className="size-5" />}
            title={t.school.noSchools}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.school.deleteTitle}
          description={interpolate(t.school.deleteBody, { name: deleting.name })}
          action={() => deleteSchoolAction(deleting.id)}
        />
      ) : null}
    </>
  );
}
