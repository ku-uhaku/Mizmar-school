"use client";

import { FileTextIcon, PlusIcon } from "lucide-react";
import * as React from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
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
import { valueOf } from "@/lib/form-values";
import {
  formatAmount,
  formatDate,
  formatMonth,
  interpolate,
} from "@/lib/i18n/format";
import { endContractAction, saveContractAction } from "@/modules/hr/actions";
import {
  CONTRACT_KINDS,
  CONTRACT_STATUSES,
  isChargeableAbsence,
} from "@/modules/hr/enums";
import type { ContractRow, StaffDetail } from "@/modules/hr/queries";
import { Field, useToastedTransition } from "@/modules/hr/components/field";

/**
 * One employee's file: the contracts signed, the bulletins issued, the register
 * and the leave taken.
 *
 * The payroll half is simply absent without `canPayroll` rather than blanked —
 * a card labelled "salary: hidden" tells a colleague there is a figure to go and
 * ask about, which is the thing the permission exists to prevent.
 */
export function StaffPanel({
  person,
  canPayroll,
  canManage,
}: {
  person: StaffDetail;
  canPayroll: boolean;
  canManage: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<ContractRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const { isPending, run } = useToastedTransition();

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label={t.hr.code} value={person.code} />
        <Fact
          label={t.hr.jobRole}
          value={
            t.hrOptions.jobRoles[
              person.jobRole as keyof typeof t.hrOptions.jobRoles
            ]
          }
          hint={person.jobTitle ?? undefined}
        />
        <Fact
          label={t.hr.unjustifiedAbsences}
          value={String(person.unjustifiedAbsences)}
        />
        <Fact
          label={t.hr.leaveThisYear}
          value={String(person.leaveDaysThisYear)}
        />
      </div>

      <Card>
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label={t.hr.phone} value={person.phone ?? "—"} ltr />
          <Fact label={t.hr.email} value={person.email ?? "—"} ltr />
          <Fact label={t.hr.nationalId} value={person.nationalId ?? "—"} ltr />
          <Fact label={t.hr.cnssNumber} value={person.cnssNumber ?? "—"} ltr />
          <Fact
            label={t.hr.hiredOn}
            value={person.hiredOn ? formatDate(person.hiredOn, locale) : "—"}
          />
          <Fact
            label={t.hr.leftOn}
            value={person.leftOn ? formatDate(person.leftOn, locale) : "—"}
          />
          <Fact
            label={t.hr.account}
            value={person.userEmail ?? t.hr.noAccount}
            ltr
          />
          {canPayroll ? (
            <Fact label={t.hr.bankRib} value={person.bankRib ?? "—"} ltr />
          ) : null}
        </CardContent>
      </Card>

      {/* ── Contracts ────────────────────────────────────────────────────── */}
      {canPayroll ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">{t.hr.contracts}</h2>
            {canManage ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <PlusIcon className="size-4" />
                {t.hr.newContract}
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">{t.hr.supersededNote}</p>

          {person.contracts.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<FileTextIcon className="size-5" />}
                  title={t.hr.noContracts}
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
                        <TableHead>{t.hr.contractKind}</TableHead>
                        <TableHead>{t.hr.startsOn}</TableHead>
                        <TableHead>{t.hr.endsOn}</TableHead>
                        <TableHead className="text-end">
                          {t.hr.baseSalary}
                        </TableHead>
                        <TableHead>{t.hr.contractStatus}</TableHead>
                        {canManage ? (
                          <TableHead className="text-end">
                            {t.common.actions}
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {person.contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell>
                            {
                              t.hrOptions.contractKinds[
                                contract.kind as keyof typeof t.hrOptions.contractKinds
                              ]
                            }
                          </TableCell>
                          <TableCell>
                            {formatDate(contract.startsOn, locale)}
                          </TableCell>
                          <TableCell>
                            {contract.endsOn
                              ? formatDate(contract.endsOn, locale)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {formatAmount(contract.baseSalaryCentimes, locale)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                contract.status === "ACTIVE"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {
                                t.hrOptions.contractStatuses[
                                  contract.status as keyof typeof t.hrOptions.contractStatuses
                                ]
                              }
                            </Badge>
                          </TableCell>
                          {canManage ? (
                            <TableCell className="text-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(contract)}
                              >
                                {t.common.edit}
                              </Button>
                              {contract.status === "ACTIVE" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  disabled={isPending}
                                  onClick={() =>
                                    run(() => endContractAction(contract.id))
                                  }
                                >
                                  {t.hr.contractEnded}
                                </Button>
                              ) : null}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      ) : null}

      {/* ── Payslips ─────────────────────────────────────────────────────── */}
      {canPayroll && person.salaries.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-medium">{t.hr.payroll}</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.hr.period}</TableHead>
                      <TableHead className="text-end">{t.hr.gross}</TableHead>
                      <TableHead className="text-end">{t.hr.net}</TableHead>
                      <TableHead>{t.hr.payslipStatus}</TableHead>
                      <TableHead>{t.hr.paidOn}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {person.salaries.map((salary) => (
                      <TableRow key={salary.id}>
                        <TableCell>
                          {formatMonth(
                            salary.periodYear,
                            salary.periodMonth,
                            locale,
                          )}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatAmount(salary.grossCentimes, locale)}
                        </TableCell>
                        <TableCell className="text-end font-medium tabular-nums">
                          {formatAmount(salary.netCentimes, locale)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              salary.status === "PAID" ? "secondary" : "outline"
                            }
                          >
                            {
                              t.hrOptions.salaryStatuses[
                                salary.status as keyof typeof t.hrOptions.salaryStatuses
                              ]
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {salary.paidOn
                            ? formatDate(salary.paidOn, locale)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* ── The register ─────────────────────────────────────────────────── */}
      <section className="grid gap-3">
        <h2 className="text-sm font-medium">{t.hr.attendance}</h2>
        {person.attendance.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState title={t.hr.unmarked} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.hr.day}</TableHead>
                      <TableHead>{t.hr.attendanceStatus}</TableHead>
                      <TableHead>{t.hr.justified}</TableHead>
                      <TableHead>{t.hr.recordedBy}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {person.attendance.map((mark) => (
                      <TableRow key={mark.id}>
                        <TableCell>{formatDate(mark.date, locale)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              isChargeableAbsence(mark.status, mark.isJustified)
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {
                              t.hrOptions.attendanceStatuses[
                                mark.status as keyof typeof t.hrOptions.attendanceStatuses
                              ]
                            }
                          </Badge>
                          {mark.status === "LATE" && mark.minutesLate > 0 ? (
                            <span className="text-muted-foreground ms-2 text-xs tabular-nums">
                              {mark.minutesLate}′
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {mark.isJustified ? t.common.yes : t.common.no}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {mark.recordedByName}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {creating || editing ? (
        <ContractDialog
          staffId={person.id}
          staffName={person.fullName}
          contract={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  hint,
  ltr,
}: {
  label: string;
  value: string;
  hint?: string;
  ltr?: boolean;
}) {
  return (
    <div className="grid gap-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium" dir={ltr ? "ltr" : undefined}>
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function ContractDialog({
  staffId,
  staffName,
  contract,
  onClose,
}: {
  staffId: string;
  staffName: string;
  contract: ContractRow | null;
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveContractAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  const dateValue = (value: string | null) => (value ? value.slice(0, 10) : "");

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {contract ? t.hr.editContract : t.hr.newContract}
            </DialogTitle>
            <DialogDescription>
              {interpolate("{name} · {note}", {
                name: staffName,
                note: t.hr.supersededNote,
              })}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="staffId" value={staffId} />
          {contract ? (
            <input type="hidden" name="id" value={contract.id} />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.hr.contractKind} name="kind">
              <Select
                name="kind"
                defaultValue={valueOf(state, "kind", contract?.kind) || "CDI"}
              >
                <SelectTrigger id="kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t.hrOptions.contractKinds[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.hr.contractStatus} name="status">
              <Select
                name="status"
                defaultValue={
                  valueOf(state, "status", contract?.status) || "ACTIVE"
                }
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t.hrOptions.contractStatuses[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

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
                defaultValue={dateValue(contract?.startsOn ?? null)}
              />
            </Field>
            <Field label={t.hr.endsOn} name="endsOn" error={errors.endsOn}>
              <Input
                id="endsOn"
                name="endsOn"
                type="date"
                dir="ltr"
                defaultValue={dateValue(contract?.endsOn ?? null)}
              />
            </Field>
            <Field label={t.hr.trialEndsOn} name="trialEndsOn">
              <Input
                id="trialEndsOn"
                name="trialEndsOn"
                type="date"
                dir="ltr"
                defaultValue={dateValue(contract?.trialEndsOn ?? null)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t.hr.baseSalary}
              name="baseSalary"
              error={errors.baseSalary}
            >
              <Input
                id="baseSalary"
                name="baseSalary"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                required
                defaultValue={
                  contract ? (contract.baseSalaryCentimes / 100).toFixed(2) : ""
                }
              />
            </Field>
            <Field label={t.hr.weeklyHours} name="weeklyHours">
              <Input
                id="weeklyHours"
                name="weeklyHours"
                type="number"
                min="0"
                dir="ltr"
                defaultValue={valueOf(
                  state,
                  "weeklyHours",
                  contract?.weeklyHours === null ||
                    contract?.weeklyHours === undefined
                    ? ""
                    : String(contract.weeklyHours),
                )}
              />
            </Field>
          </div>
          <p className="text-muted-foreground text-xs">{t.hr.baseSalaryHint}</p>

          <Field label={t.hr.notes} name="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={valueOf(state, "notes", contract?.notes)}
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
