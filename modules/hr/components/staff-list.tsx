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
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { valueOf } from "@/lib/form-values";
import { formatAmount, interpolate } from "@/lib/i18n/format";
import { deleteStaffAction, saveStaffAction } from "@/modules/hr/actions";
import { Field } from "@/modules/hr/components/field";
import { DEPARTMENTS, JOB_ROLES, STAFF_STATUSES } from "@/modules/hr/enums";
import type { StaffRow } from "@/modules/hr/queries";
import { GENDERS } from "@/modules/students/enums";

export function StaffList({
  staff,
  linkableUsers,
  permissions,
}: {
  staff: StaffRow[];
  linkableUsers: { id: string; label: string }[];
  permissions: {
    canManage: boolean;
    canPayroll: boolean;
    canDelete: boolean;
  };
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<StaffRow | null>(null);
  const [creating, setCreating] = React.useState(false);
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
          row.original.baseSalaryCentimes === null ? (
            <span className="text-destructive text-xs">
              {t.hr.withoutContract}
            </span>
          ) : (
            <span className="tabular-nums">
              {formatAmount(row.original.baseSalaryCentimes, locale)}
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
                <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                  <PencilIcon />
                  {t.common.edit}
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

  const newButton = permissions.canManage ? (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon />
      {t.hr.newStaff}
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

      {creating || editing ? (
        <StaffDialog
          person={editing}
          linkableUsers={linkableUsers}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

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

function StaffDialog({
  person,
  linkableUsers,
  onClose,
}: {
  person: StaffRow | null;
  linkableUsers: { id: string; label: string }[];
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveStaffAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  const dateValue = (value: string | null) => (value ? value.slice(0, 10) : "");

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{person ? t.hr.editStaff : t.hr.newStaff}</DialogTitle>
            <DialogDescription>{t.hr.codeHint}</DialogDescription>
          </DialogHeader>

          {person ? <input type="hidden" name="id" value={person.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t.hr.firstName}
              name="firstName"
              error={errors.firstName}
            >
              <Input
                id="firstName"
                name="firstName"
                required
                defaultValue={valueOf(state, "firstName", person?.firstName)}
              />
            </Field>
            <Field
              label={t.hr.lastName}
              name="lastName"
              error={errors.lastName}
            >
              <Input
                id="lastName"
                name="lastName"
                required
                defaultValue={valueOf(state, "lastName", person?.lastName)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.hr.firstNameAr} name="firstNameAr">
              <Input id="firstNameAr" name="firstNameAr" dir="rtl" />
            </Field>
            <Field label={t.hr.lastNameAr} name="lastNameAr">
              <Input id="lastNameAr" name="lastNameAr" dir="rtl" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.hr.code} name="code" error={errors.code}>
              <Input
                id="code"
                name="code"
                defaultValue={valueOf(state, "code", person?.code)}
              />
            </Field>
            <Field label={t.hr.jobRole} name="jobRole">
              <Select
                name="jobRole"
                defaultValue={
                  valueOf(state, "jobRole", person?.jobRole) || "TEACHER"
                }
              >
                <SelectTrigger id="jobRole" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t.hrOptions.jobRoles[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.hr.staffStatus} name="status">
              <Select
                name="status"
                defaultValue={
                  valueOf(state, "status", person?.status) || "ACTIVE"
                }
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t.hrOptions.staffStatuses[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={t.hr.jobTitle} name="jobTitle">
            <Input
              id="jobTitle"
              name="jobTitle"
              defaultValue={valueOf(state, "jobTitle", person?.jobTitle)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.hr.gender} name="gender">
              <Select name="gender" defaultValue="">
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue placeholder={t.common.notSet} />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((gender) => (
                    <SelectItem key={gender} value={gender}>
                      {t.studentOptions.genders[gender]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.hr.hiredOn} name="hiredOn">
              <Input
                id="hiredOn"
                name="hiredOn"
                type="date"
                dir="ltr"
                defaultValue={dateValue(person?.hiredOn ?? null)}
              />
            </Field>
            <Field label={t.hr.leftOn} name="leftOn">
              <Input
                id="leftOn"
                name="leftOn"
                type="date"
                dir="ltr"
                defaultValue={dateValue(person?.leftOn ?? null)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.hr.phone} name="phone">
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={valueOf(state, "phone", person?.phone)}
              />
            </Field>
            <Field label={t.hr.email} name="email" error={errors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                defaultValue={valueOf(state, "email", person?.email)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.hr.nationalId} name="nationalId">
              <Input id="nationalId" name="nationalId" dir="ltr" />
            </Field>
            <Field label={t.hr.cnssNumber} name="cnssNumber">
              <Input id="cnssNumber" name="cnssNumber" dir="ltr" />
            </Field>
            <Field label={t.hr.bankRib} name="bankRib">
              <Input id="bankRib" name="bankRib" dir="ltr" />
            </Field>
          </div>

          {/* Only for the minority who sign in — see the note on Staff.userId. */}
          {linkableUsers.length > 0 ? (
            <div className="grid gap-1.5">
              <Field label={t.hr.account} name="userId">
                <Select
                  name="userId"
                  defaultValue={
                    valueOf(state, "userId", person?.userId) || "__none__"
                  }
                >
                  <SelectTrigger id="userId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.hr.noAccount}</SelectItem>
                    {linkableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <p className="text-muted-foreground text-xs">
                {t.hr.accountHint}
              </p>
            </div>
          ) : null}

          <Field label={t.hr.notes} name="notes">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
