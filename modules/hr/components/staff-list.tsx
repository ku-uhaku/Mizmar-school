"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAmount, interpolate } from "@/lib/i18n/format";
import { deleteStaffAction } from "@/modules/hr/actions";
import { DEPARTMENTS, JOB_ROLES, STAFF_STATUSES } from "@/modules/hr/enums";
import type { StaffRow } from "@/modules/hr/queries";

export function StaffList({
  staff,
  permissions,
}: {
  staff: StaffRow[];
  permissions: {
    canManage: boolean;
    canPayroll: boolean;
    canDelete: boolean;
  };
}) {
  const t = useT();
  const locale = useLocale();
  const [removing, setRemoving] = React.useState<StaffRow | null>(null);

  const columns = React.useMemo<ColumnDef<StaffRow, unknown>[]>(() => {
    const list: ColumnDef<StaffRow, unknown>[] = [
      {
        id: "employee",
        // The matricule and the account e-mail are searchable but not sorted
        // on: somebody hunting for "P-2025-0007" has the code, not the name.
        accessorFn: (row) =>
          `${row.fullName} ${row.code} ${row.userEmail ?? ""}`,
        header: t.hr.employee,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/hr/staff/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.fullName}
            </Link>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {row.original.code}
              {row.original.userEmail ? ` · ${row.original.userEmail}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "jobRole",
        header: t.hr.jobRole,
        cell: ({ row }) => (
          <span className="text-sm">
            {
              t.hrOptions.jobRoles[
                row.original.jobRole as keyof typeof t.hrOptions.jobRoles
              ]
            }
          </span>
        ),
      },
      {
        // Derived from the job role, never stored — see departmentOf in
        // enums.ts. Its own column so it can carry its own facet.
        accessorKey: "department",
        header: t.hr.department,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => (
          <Badge variant="secondary">
            {
              t.hrOptions.departments[
                row.original.department as keyof typeof t.hrOptions.departments
              ]
            }
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t.hr.staffStatus,
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "ACTIVE" ? "secondary" : "outline"}
          >
            {
              t.hrOptions.staffStatuses[
                row.original.status as keyof typeof t.hrOptions.staffStatuses
              ]
            }
          </Badge>
        ),
      },
      {
        accessorKey: "phone",
        header: t.hr.phone,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-sm" dir="ltr">
            {row.original.phone ?? "—"}
          </span>
        ),
      },
    ];

    if (permissions.canPayroll) {
      list.push({
        id: "baseSalary",
        // -1 rather than null so a person without a live contract sorts to one
        // end instead of scattering through the list.
        accessorFn: (row) => row.baseSalaryCentimes ?? -1,
        header: t.hr.baseSalary,
        meta: { className: "text-end" },
        cell: ({ row }) =>
          !row.original.hasLiveContract ? (
            <span className="text-destructive text-xs">
              {t.hr.withoutContract}
            </span>
          ) : (
            <span className="tabular-nums">
              {formatAmount(row.original.baseSalaryCentimes ?? 0, locale)}
            </span>
          ),
      });
    }

    if (permissions.canManage) {
      list.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
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
                {/* Editing happens on the employee's own screen: the form
                    writes every column, and only that screen has read every
                    column to fill it with. See `StaffDialog`. */}
                <DropdownMenuItem asChild>
                  <Link href={`/hr/staff/${row.original.id}`}>
                    <PencilIcon />
                    {t.common.edit}
                  </Link>
                </DropdownMenuItem>
                {permissions.canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setRemoving(row.original)}
                    >
                      <Trash2Icon />
                      {t.common.delete}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      });
    }

    return list;
  }, [
    t,
    locale,
    permissions.canPayroll,
    permissions.canManage,
    permissions.canDelete,
  ]);

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "status",
        label: t.hr.staffStatus,
        options: STAFF_STATUSES.map((status) => ({
          value: status,
          label: t.hrOptions.staffStatuses[status],
        })),
      },
      {
        columnId: "jobRole",
        label: t.hr.jobRole,
        options: JOB_ROLES.map((role) => ({
          value: role,
          label: t.hrOptions.jobRoles[role],
        })),
      },
      {
        columnId: "department",
        label: t.hr.department,
        options: DEPARTMENTS.map((department) => ({
          value: department,
          label: t.hrOptions.departments[department],
        })),
      },
    ],
    [t],
  );

  /*
    Hiring is its own page, not a dialog on this one.

    Taking somebody on writes an employment record, a login, a contract, the
    subjects a teacher may be given and the bus a driver takes — five things
    that outgrew a modal, and three of which used to be found on three other
    screens or not at all. See `HireForm`.
  */
  const newButton = permissions.canManage ? (
    <Button asChild>
      <Link href="/hr/staff/new">
        <PlusIcon />
        {t.hr.newStaff}
      </Link>
    </Button>
  ) : undefined;

  return (
    <div className="grid gap-3">
      <DataTable
        columns={columns}
        data={staff}
        facets={facets}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={<UsersIcon className="size-5" />}
            title={t.hr.noStaff}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      <ConfirmDelete
        open={removing !== null}
        onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}
        title={t.hr.deleteStaffTitle}
        description={interpolate(t.hr.deleteStaffBody, {
          name: removing?.fullName ?? "",
        })}
        action={() =>
          removing
            ? deleteStaffAction(removing.id)
            : Promise.resolve({ status: "idle" as const })
        }
        onDeleted={() => setRemoving(null)}
      />
    </div>
  );
}
