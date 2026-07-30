"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  EyeIcon,
  LockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";

import { deleteRoleAction } from "@/modules/access/actions";
import { DataTable } from "@/components/data-table/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { interpolate } from "@/lib/i18n/format";
import { ALL_PERMISSION_CODES } from "@/lib/permissions";

export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  isSystem: boolean;
  permissions: string[];
  assignedCount: number;
};

export function RolesManager({
  roles,
  permissions,
}: {
  roles: RoleRow[];
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = React.useState<RoleRow | null>(null);

  const columns = React.useMemo<ColumnDef<RoleRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t.role.name,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <ShieldCheckIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/roles/${row.original.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {row.original.name}
                </Link>
                {row.original.isSystem ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <LockIcon className="text-muted-foreground size-3.5 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>{t.role.systemRole}</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              {row.original.description ? (
                <p className="text-muted-foreground line-clamp-1 text-xs">
                  {row.original.description}
                </p>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "scope",
        header: t.role.scope,
        cell: ({ row }) => (
          <Badge variant={row.original.scope === "ORG" ? "default" : "outline"}>
            {t.role.scopes[row.original.scope as keyof typeof t.role.scopes]}
          </Badge>
        ),
      },
      {
        id: "permissionCount",
        accessorFn: (row) => row.permissions.length,
        header: t.role.permissions,
        cell: ({ row }) => {
          const count = row.original.permissions.length;
          const total = ALL_PERMISSION_CODES.length;
          return (
            <div className="flex items-center gap-2">
              <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.round((count / total) * 100)}%` }}
                />
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {count}/{total}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "assignedCount",
        header: t.role.usedBy,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.assignedCount}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const role = row.original;

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
                  <DropdownMenuItem asChild>
                    <Link href={`/roles/${role.id}`}>
                      {permissions.canUpdate ? <PencilIcon /> : <EyeIcon />}
                      {permissions.canUpdate
                        ? t.common.edit
                        : t.role.permissions}
                    </Link>
                  </DropdownMenuItem>

                  {/* System roles and roles still in use cannot be deleted; the
                      action re-checks both server-side. */}
                  {permissions.canDelete &&
                  !role.isSystem &&
                  role.assignedCount === 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(role)}
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
    [t, permissions.canUpdate, permissions.canDelete],
  );

  const newButton = permissions.canCreate ? (
    <Button asChild>
      <Link href="/roles/new">
        <PlusIcon />
        {t.role.newRole}
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <DataTable
        columns={columns}
        data={roles}
        emptyState={
          <EmptyState
            icon={<ShieldCheckIcon className="size-5" />}
            title={t.role.noRoles}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.role.deleteTitle}
          description={interpolate(t.role.deleteBody, { name: deleting.name })}
          action={() => deleteRoleAction(deleting.id)}
        />
      ) : null}
    </>
  );
}
