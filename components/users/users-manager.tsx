"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
  UserCheckIcon,
  UserXIcon,
  UsersIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { deleteUserAction, toggleUserActiveAction } from "@/app/actions/users";
import { DataTable } from "@/components/data-table/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { formatDateTime, formatNumber, interpolate } from "@/lib/i18n/format";
import { ageFrom } from "@/lib/utils";

export type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  /** `YYYY-MM-DD`, or "" when unset — age is derived from it, never stored. */
  birthDate: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  orgRoleId: string | null;
  orgRoleName: string | null;
  memberships: {
    schoolId: string;
    schoolName: string;
    roleId: string;
    roleName: string;
  }[];
  lastLoginAt: string | null;
  isSelf: boolean;
};

export function UsersManager({
  users,
  permissions,
}: {
  users: UserRow[];
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  const { t, locale } = useI18n();
  const [deleting, setDeleting] = React.useState<UserRow | null>(null);
  const [, startTransition] = React.useTransition();

  function toggleActive(user: UserRow) {
    startTransition(async () => {
      const result = await toggleUserActiveAction(user.id, !user.isActive);
      if (result.status === "success") {
        toast.success(result.message ?? t.user.updated);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  const columns = React.useMemo<ColumnDef<UserRow, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.firstName} ${row.lastName} ${row.email}`,
        header: t.user.nameColumn,
        cell: ({ row }) => {
          const user = row.original;
          const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`
            .toUpperCase()
            .trim();

          return (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9 shrink-0">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-xs">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {permissions.canUpdate ? (
                    <Link
                      href={`/users/${user.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {user.firstName} {user.lastName}
                    </Link>
                  ) : (
                    <span className="truncate font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                  )}
                  {user.isSelf ? (
                    <Badge variant="outline" className="shrink-0">
                      {t.user.you}
                    </Badge>
                  ) : null}
                  {user.isSuperAdmin ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ShieldIcon className="text-primary size-3.5 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>{t.user.superAdmin}</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <p className="text-muted-foreground truncate text-xs" dir="ltr">
                  {user.email}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "jobTitle",
        header: t.user.jobTitle,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => row.original.jobTitle ?? "—",
      },
      {
        id: "age",
        accessorFn: (row) => ageFrom(row.birthDate) ?? -1,
        header: t.user.age,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) => {
          const age = ageFrom(row.original.birthDate);
          return age === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">{formatNumber(age, locale)}</span>
          );
        },
      },
      {
        accessorKey: "orgRoleName",
        header: t.user.orgRole,
        cell: ({ row }) =>
          row.original.orgRoleName ? (
            <Badge>{row.original.orgRoleName}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "schoolAccess",
        accessorFn: (row) =>
          row.memberships.map((m) => `${m.schoolName} ${m.roleName}`).join(" "),
        header: t.user.schoolAccess,
        enableSorting: false,
        cell: ({ row }) => {
          const memberships = row.original.memberships;
          if (memberships.length === 0) {
            return <span className="text-muted-foreground">{t.user.noAccess}</span>;
          }

          // Two inline, the rest behind a count — the list can get long.
          return (
            <div className="flex flex-wrap items-center gap-1">
              {memberships.slice(0, 2).map((membership) => (
                <Badge key={membership.schoolId} variant="secondary">
                  {membership.schoolName} · {membership.roleName}
                </Badge>
              ))}
              {memberships.length > 2 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline">+{memberships.length - 2}</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul>
                      {memberships.slice(2).map((membership) => (
                        <li key={membership.schoolId}>
                          {membership.schoolName} · {membership.roleName}
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "lastLoginAt",
        header: t.user.lastLogin,
        meta: { className: "hidden @6xl/table:table-cell" },
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            formatDateTime(row.original.lastLoginAt, locale)
          ) : (
            <span className="text-muted-foreground">{t.user.never}</span>
          ),
      },
      {
        accessorKey: "isActive",
        header: t.school.status,
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="secondary">{t.common.active}</Badge>
          ) : (
            <Badge variant="outline">{t.common.inactive}</Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          if (!permissions.canUpdate && !permissions.canDelete) return null;

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
                  {permissions.canUpdate ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href={`/users/${user.id}`}>
                          <PencilIcon />
                          {t.common.edit}
                        </Link>
                      </DropdownMenuItem>

                      {/* Deactivating yourself would end your own session. */}
                      {!user.isSelf ? (
                        <DropdownMenuItem onSelect={() => toggleActive(user)}>
                          {user.isActive ? <UserXIcon /> : <UserCheckIcon />}
                          {user.isActive ? t.common.inactive : t.common.active}
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  ) : null}

                  {permissions.canDelete && !user.isSelf ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(user)}
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
    [t, locale, permissions.canUpdate, permissions.canDelete],
  );

  const newButton = permissions.canCreate ? (
    <Button asChild>
      <Link href="/users/new">
        <PlusIcon />
        {t.user.newUser}
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder={t.user.searchPlaceholder}
        emptyState={
          <EmptyState
            icon={<UsersIcon className="size-5" />}
            title={t.user.noUsers}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.user.deleteTitle}
          description={interpolate(t.user.deleteBody, {
            name: `${deleting.firstName} ${deleting.lastName}`,
          })}
          action={() => deleteUserAction(deleting.id)}
        />
      ) : null}
    </>
  );
}
