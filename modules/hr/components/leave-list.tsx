"use client";

import { PalmtreeIcon, PlusIcon } from "lucide-react";
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
import { formatDate, interpolate } from "@/lib/i18n/format";
import {
  decideLeaveAction,
  deleteLeaveAction,
  saveLeaveAction,
} from "@/modules/hr/actions";
import { LEAVE_KINDS, spanInDays } from "@/modules/hr/enums";
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

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{t.hr.leaveStatusNote}</p>
        {canRequest ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" />
            {t.hr.newLeave}
          </Button>
        ) : null}
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<PalmtreeIcon className="size-5" />}
              title={t.hr.noLeave}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.hr.employee}</TableHead>
                    <TableHead>{t.hr.leaveKind}</TableHead>
                    <TableHead>{t.hr.startsOn}</TableHead>
                    <TableHead>{t.hr.endsOn}</TableHead>
                    <TableHead className="text-end">{t.hr.dayCount}</TableHead>
                    <TableHead>{t.hr.leaveStatus}</TableHead>
                    <TableHead className="text-end">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <span className="font-medium">{request.staffName}</span>
                        <span className="text-muted-foreground block text-xs">
                          {request.staffCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        {
                          t.hrOptions.leaveKinds[
                            request.kind as keyof typeof t.hrOptions.leaveKinds
                          ]
                        }
                      </TableCell>
                      <TableCell>{formatDate(request.startsOn, locale)}</TableCell>
                      <TableCell>{formatDate(request.endsOn, locale)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {request.dayCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            request.status === "APPROVED"
                              ? "secondary"
                              : request.status === "REJECTED"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {
                            t.hrOptions.leaveStatuses[
                              request.status as keyof typeof t.hrOptions.leaveStatuses
                            ]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        {canDecide && request.status === "PENDING" ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() =>
                                run(() =>
                                  decideLeaveAction(request.id, "APPROVED"),
                                )
                              }
                            >
                              {t.hr.approve}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={isPending}
                              onClick={() =>
                                run(() =>
                                  decideLeaveAction(request.id, "REJECTED"),
                                )
                              }
                            >
                              {t.hr.reject}
                            </Button>
                          </>
                        ) : null}
                        {canRequest ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(request)}
                          >
                            {t.common.edit}
                          </Button>
                        ) : null}
                        {canDecide ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRemoving(request)}
                          >
                            {t.common.delete}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
  const [endsOn, setEndsOn] = React.useState(dateValue(request?.endsOn ?? null));
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

          {request ? <input type="hidden" name="id" value={request.id} /> : null}

          <Field label={t.hr.employee} name="staffId" error={errors.staffId}>
            <Select name="staffId" defaultValue={request?.staffId ?? ""}>
              <SelectTrigger id="staffId" className="w-full">
                <SelectValue placeholder={t.hr.employee} />
              </SelectTrigger>
              <SelectContent>
                {staffOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t.hr.leaveKind} name="kind">
            <Select name="kind" defaultValue={request?.kind ?? "ANNUAL"}>
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
            <Field label={t.hr.startsOn} name="startsOn" error={errors.startsOn}>
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
            <Field label={t.hr.dayCount} name="dayCount" error={errors.dayCount}>
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
              defaultValue={request?.reason ?? ""}
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
