"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  CheckIcon,
  MoreHorizontalIcon,
  PalmtreeIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { Combobox } from "@/components/form/combobox";
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
import { formatDate, interpolate } from "@/lib/i18n/format";
import {
  decideLeaveAction,
  deleteLeaveAction,
  saveLeaveAction,
} from "@/modules/hr/actions";
import { LEAVE_KINDS, LEAVE_STATUSES, spanInDays } from "@/modules/hr/enums";
import type { LeaveRow, StaffOption } from "@/modules/hr/queries";
import { Field, useToastedTransition } from "@/modules/hr/components/field";

/**
 * Les congés: what was asked for, and what was decided.
 *
 * Requesting and deciding are separate acts with separate permissions — a
 * secretary logs the request, a head grants it — which is why the decision is
 * two buttons on the row rather than a status field on the form.
 */
export function LeaveList({
  requests,
  staffOptions,
  canRequest,
  canDecide,
}: {
  requests: LeaveRow[];
  staffOptions: StaffOption[];
  canRequest: boolean;
  canDecide: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<LeaveRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<LeaveRow | null>(null);
  const { isPending, run } = useToastedTransition();

  const columns = React.useMemo<ColumnDef<LeaveRow, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.staffName} ${row.staffCode}`,
        header: t.hr.employee,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.staffName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.staffCode}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "kind",
        header: t.hr.leaveKind,
        cell: ({ row }) => (
          <span className="text-sm">
            {
              t.hrOptions.leaveKinds[
                row.original.kind as keyof typeof t.hrOptions.leaveKinds
              ]
            }
          </span>
        ),
      },
      {
        accessorKey: "startsOn",
        header: t.hr.startsOn,
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDate(row.original.startsOn, locale)}
          </span>
        ),
      },
      {
        accessorKey: "endsOn",
        header: t.hr.endsOn,
        meta: { className: "hidden @2xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDate(row.original.endsOn, locale)}
          </span>
        ),
      },
      {
        accessorKey: "dayCount",
        header: t.hr.dayCount,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.dayCount}</span>
        ),
      },
      {
        accessorKey: "status",
        header: t.hr.leaveStatus,
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "APPROVED"
                ? "secondary"
                : row.original.status === "REJECTED"
                  ? "destructive"
                  : "outline"
            }
          >
            {
              t.hrOptions.leaveStatuses[
                row.original.status as keyof typeof t.hrOptions.leaveStatuses
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
          const request = row.original;
          const decidable = canDecide && request.status === "PENDING";
          if (!decidable && !canRequest && !canDecide) return null;

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
                  {/* Granting and refusing are the decision — kept above the
                      separator, apart from editing what was asked for. */}
                  {decidable ? (
                    <>
                      <DropdownMenuItem
                        disabled={isPending}
                        onSelect={() =>
                          run(() => decideLeaveAction(request.id, "APPROVED"))
                        }
                      >
                        <CheckIcon />
                        {t.hr.approve}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={isPending}
                        onSelect={() =>
                          run(() => decideLeaveAction(request.id, "REJECTED"))
                        }
                      >
                        <XIcon />
                        {t.hr.reject}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  {canRequest ? (
                    <DropdownMenuItem onSelect={() => setEditing(request)}>
                      <PencilIcon />
                      {t.common.edit}
                    </DropdownMenuItem>
                  ) : null}
                  {canDecide ? (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setRemoving(request)}
                    >
                      <Trash2Icon />
                      {t.common.delete}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, locale, canDecide, canRequest, isPending, run],
  );

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "status",
        label: t.hr.leaveStatus,
        options: LEAVE_STATUSES.map((status) => ({
          value: status,
          label: t.hrOptions.leaveStatuses[status],
        })),
      },
      {
        columnId: "kind",
        label: t.hr.leaveKind,
        options: LEAVE_KINDS.map((kind) => ({
          value: kind,
          label: t.hrOptions.leaveKinds[kind],
        })),
      },
    ],
    [t],
  );

  const newButton = canRequest ? (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon />
      {t.hr.newLeave}
    </Button>
  ) : undefined;

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-xs">{t.hr.leaveStatusNote}</p>

      <DataTable
        columns={columns}
        data={requests}
        facets={facets}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={<PalmtreeIcon className="size-5" />}
            title={t.hr.noLeave}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      {creating || editing ? (
        <LeaveDialog
          request={editing}
          staffOptions={staffOptions}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDelete
        open={removing !== null}
        onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}
        title={t.hr.deleteLeaveTitle}
        description={interpolate(t.hr.deleteLeaveBody, {
          name: removing?.staffName ?? "",
        })}
        action={() =>
          removing
            ? deleteLeaveAction(removing.id)
            : Promise.resolve({ status: "idle" as const })
        }
        onDeleted={() => setRemoving(null)}
      />
    </div>
  );
}

function LeaveDialog({
  request,
  staffOptions,
  onClose,
}: {
  request: LeaveRow | null;
  staffOptions: StaffOption[];
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveLeaveAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  const dateValue = (value: string | null) => (value ? value.slice(0, 10) : "");

  const [startsOn, setStartsOn] = React.useState(
    dateValue(request?.startsOn ?? null),
  );
  const [endsOn, setEndsOn] = React.useState(
    dateValue(request?.endsOn ?? null),
  );
  const [dayCount, setDayCount] = React.useState(
    String(request?.dayCount ?? 1),
  );

  /**
   * The calendar span, offered as a starting figure the moment both dates are
   * known. Never imposed — which days are worked is the approver's to say, for
   * the reason on `LeaveRequest.dayCount`.
   */
  function suggestDays(start: string, end: string) {
    if (!start || !end) return;
    const days = spanInDays(new Date(start), new Date(end));
    if (days > 0) setDayCount(String(days));
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {request ? t.hr.editLeave : t.hr.newLeave}
            </DialogTitle>
            <DialogDescription>{t.hr.dayCountHint}</DialogDescription>
          </DialogHeader>

          {request ? (
            <input type="hidden" name="id" value={request.id} />
          ) : null}

          <Field label={t.hr.employee} name="staffId" error={errors.staffId}>
            <Combobox
              id="staffId"
              name="staffId"
              defaultValue={valueOf(state, "staffId", request?.staffId)}
              placeholder={t.hr.employee}
              options={staffOptions.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
            />
          </Field>

          <Field label={t.hr.leaveKind} name="kind">
            <Select
              name="kind"
              defaultValue={valueOf(state, "kind", request?.kind) || "ANNUAL"}
            >
              <SelectTrigger id="kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t.hrOptions.leaveKinds[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label={t.hr.startsOn}
              name="startsOn"
              error={errors.startsOn}
            >
              <Input
                id="startsOn"
                name="startsOn"
                type="date"
                dir="ltr"
                required
                value={startsOn}
                onChange={(event) => {
                  setStartsOn(event.target.value);
                  suggestDays(event.target.value, endsOn);
                }}
              />
            </Field>
            <Field label={t.hr.endsOn} name="endsOn" error={errors.endsOn}>
              <Input
                id="endsOn"
                name="endsOn"
                type="date"
                dir="ltr"
                required
                value={endsOn}
                onChange={(event) => {
                  setEndsOn(event.target.value);
                  suggestDays(startsOn, event.target.value);
                }}
              />
            </Field>
            <Field
              label={t.hr.dayCount}
              name="dayCount"
              error={errors.dayCount}
            >
              <Input
                id="dayCount"
                name="dayCount"
                type="number"
                min="0"
                dir="ltr"
                value={dayCount}
                onChange={(event) => setDayCount(event.target.value)}
              />
            </Field>
          </div>

          <Field label={t.hr.reason} name="reason">
            <Textarea
              id="reason"
              name="reason"
              rows={2}
              defaultValue={valueOf(state, "reason", request?.reason)}
            />
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
