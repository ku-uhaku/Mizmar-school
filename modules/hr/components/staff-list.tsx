"use client";

import Link from "next/link";
import { PlusIcon, UsersIcon } from "lucide-react";
import * as React from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, interpolate } from "@/lib/i18n/format";
import { deleteStaffAction, saveStaffAction } from "@/modules/hr/actions";
import { Field } from "@/modules/hr/components/field";
import { JOB_ROLES, STAFF_STATUSES } from "@/modules/hr/enums";
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

  return (
    <div className="grid gap-3">
      {permissions.canManage ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" />
            {t.hr.newStaff}
          </Button>
        </div>
      ) : null}

      {staff.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<UsersIcon className="size-5" />}
              title={t.hr.noStaff}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.hr.employee}</TableHead>
                  <TableHead>{t.hr.jobRole}</TableHead>
                  <TableHead>{t.hr.staffStatus}</TableHead>
                  <TableHead>{t.hr.phone}</TableHead>
                  {permissions.canPayroll ? (
                    <TableHead className="text-end">{t.hr.baseSalary}</TableHead>
                  ) : null}
                  {permissions.canManage ? (
                    <TableHead className="text-end">{t.common.actions}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <Link
                        href={`/hr/staff/${person.id}`}
                        className="font-medium hover:underline"
                      >
                        {person.fullName}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        {person.code}
                        {person.userEmail ? ` · ${person.userEmail}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      {
                        t.hrOptions.jobRoles[
                          person.jobRole as keyof typeof t.hrOptions.jobRoles
                        ]
                      }
                      <span className="text-muted-foreground block text-xs">
                        {
                          t.hrOptions.departments[
                            person.department as keyof typeof t.hrOptions.departments
                          ]
                        }
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          person.status === "ACTIVE" ? "secondary" : "outline"
                        }
                      >
                        {
                          t.hrOptions.staffStatuses[
                            person.status as keyof typeof t.hrOptions.staffStatuses
                          ]
                        }
                      </Badge>
                    </TableCell>
                    <TableCell dir="ltr" className="text-start">
                      {person.phone ?? "—"}
                    </TableCell>
                    {permissions.canPayroll ? (
                      <TableCell className="text-end tabular-nums">
                        {person.baseSalaryCentimes === null ? (
                          <span className="text-destructive text-xs">
                            {t.hr.withoutContract}
                          </span>
                        ) : (
                          formatAmount(person.baseSalaryCentimes, locale)
                        )}
                      </TableCell>
                    ) : null}
                    {permissions.canManage ? (
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(person)}
                        >
                          {t.common.edit}
                        </Button>
                        {permissions.canDelete ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRemoving(person)}
                          >
                            {t.common.delete}
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
            <DialogTitle>
              {person ? t.hr.editStaff : t.hr.newStaff}
            </DialogTitle>
            <DialogDescription>{t.hr.codeHint}</DialogDescription>
          </DialogHeader>

          {person ? <input type="hidden" name="id" value={person.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.hr.firstName} name="firstName" error={errors.firstName}>
              <Input
                id="firstName"
                name="firstName"
                required
                defaultValue={person?.firstName ?? ""}
              />
            </Field>
            <Field label={t.hr.lastName} name="lastName" error={errors.lastName}>
              <Input
                id="lastName"
                name="lastName"
                required
                defaultValue={person?.lastName ?? ""}
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
              <Input id="code" name="code" defaultValue={person?.code ?? ""} />
            </Field>
            <Field label={t.hr.jobRole} name="jobRole">
              <Select name="jobRole" defaultValue={person?.jobRole ?? "TEACHER"}>
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
              <Select name="status" defaultValue={person?.status ?? "ACTIVE"}>
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
              defaultValue={person?.jobTitle ?? ""}
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
                defaultValue={person?.phone ?? ""}
              />
            </Field>
            <Field label={t.hr.email} name="email" error={errors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                defaultValue={person?.email ?? ""}
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
                <Select name="userId" defaultValue={person?.userId ?? "__none__"}>
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
              <p className="text-muted-foreground text-xs">{t.hr.accountHint}</p>
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
