"use client";

import {
  BusIcon,
  CalendarOffIcon,
  ClockIcon,
  FileTextIcon,
  GraduationCapIcon,
  PencilIcon,
  PlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import * as React from "react";

import { StatTile } from "@/components/charts/stat-tile";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { MoveToSchoolCard } from "@/components/shared/move-to-school-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { valueOf } from "@/lib/form-values";
import {
  formatAmount,
  formatDate,
  formatMonth,
  interpolate,
  toDateInputValue,
} from "@/lib/i18n/format";
import {
  endContractAction,
  saveContractAction,
  transferStaffAction,
} from "@/modules/hr/actions";
import { StaffDialog } from "@/modules/hr/components/staff-dialog";
import {
  CONTRACT_KINDS,
  CONTRACT_STATUSES,
  isChargeableAbsence,
} from "@/modules/hr/enums";
import type { ContractRow, StaffDetail } from "@/modules/hr/queries";
import { FormField } from "@/components/form/form-field";
import { useToastedTransition } from "@/components/form/use-toasted-transition";
import { SectionHeading } from "@/components/shell/section-heading";

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
  linkableUsers,
  schoolRoles,
  transferTargets,
  canCreateAccount,
  canPayroll,
  canManage,
}: {
  person: StaffDetail;
  /** Accounts this employee may be linked to. Empty without `canManage`. */
  linkableUsers: { id: string; label: string }[];
  /** School-scoped roles a newly created login may be granted. */
  schoolRoles: { id: string; name: string }[];
  /**
   * The other schools this file may be moved to — already filtered to the ones
   * the reader holds `hr.manage` in. Empty hides the card; see the page.
   */
  transferTargets: { id: string; name: string }[];
  /** USER_CREATE — whether this reader may mint a login at all. */
  canCreateAccount: boolean;
  canPayroll: boolean;
  canManage: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<ContractRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [editingPerson, setEditingPerson] = React.useState(false);
  const [endingContract, setEndingContract] =
    React.useState<ContractRow | null>(null);
  const { isPending, run } = useToastedTransition();
  const { currencyCode: currency } = useSettings();
  const [tab, setTab] = React.useState("dossier");

  /*
    The pupils this person teaches, counted once per class.

    An assignment is per subject, so a teacher taking a class for two subjects
    appeared on the tile twice and made a form of thirty read as sixty. The
    classes are the unit here, not the assignments.
  */
  const classCount = new Set(person.teaching.map((duty) => duty.schoolClassId))
    .size;
  const pupilCount = [
    ...new Map(
      person.teaching.map((duty) => [duty.schoolClassId, duty.enrolled]),
    ).values(),
  ].reduce((total, enrolled) => total + enrolled, 0);
  const routeCount = person.vehicles.reduce(
    (total, vehicle) => total + vehicle.routes.length,
    0,
  );
  const lastSalary = person.salaries[0] ?? null;

  return (
    <div className="grid gap-5">
      {/*
        The overview band: what somebody opening this file came to check, in the
        shape the RH dashboard already uses. Each tile is present only when it
        has an answer — a concierge has no weekly load and a teacher has no bus,
        and a row of zeroes for the half that does not apply would bury the half
        that does.
      */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {person.teaching.length > 0 ? (
          <>
            <StatTile
              compact
              label={t.hr.weeklyLoad}
              value={Math.round(person.teachingMinutes / 60)}
              suffix={t.hr.hoursShort}
              detail={
                person.maxWeeklyMinutes
                  ? interpolate(t.hr.weeklyLoadCeiling, {
                      hours: Math.round(person.maxWeeklyMinutes / 60),
                    })
                  : t.hr.weeklyLoadNoCeiling
              }
              icon={<ClockIcon className="size-4" />}
              locale={locale}
            />
            <StatTile
              compact
              label={t.hr.pupilsTaught}
              value={pupilCount}
              detail={interpolate(t.hr.classCount, { count: classCount })}
              icon={<GraduationCapIcon className="size-4" />}
              locale={locale}
            />
          </>
        ) : null}

        {person.vehicles.length > 0 ? (
          <StatTile
            compact
            label={t.hr.busesDriven}
            value={person.vehicles.length}
            detail={interpolate(t.hr.lineCount, { count: routeCount })}
            icon={<BusIcon className="size-4" />}
            locale={locale}
          />
        ) : null}

        {/* The figure is passed in dirhams, not centimes — see the note on the
            wage-bill tile in the RH dashboard. */}
        {canPayroll && lastSalary ? (
          <StatTile
            compact
            label={t.hr.lastNet}
            value={Math.round(lastSalary.netCentimes / 100)}
            suffix={` ${currency}`}
            detail={
              person.advanceOutstandingCentimes > 0
                ? `${t.hr.advanceOutstanding}: ${formatAmount(
                    person.advanceOutstandingCentimes,
                    locale,
                  )}`
                : formatMonth(
                    lastSalary.periodYear,
                    lastSalary.periodMonth,
                    locale,
                  )
            }
            icon={<WalletIcon className="size-4" />}
            locale={locale}
          />
        ) : null}

        <StatTile
          compact
          label={t.hr.unjustifiedAbsences}
          value={person.unjustifiedAbsences}
          detail={interpolate(t.hr.leaveDaysTaken, {
            count: person.leaveDaysThisYear,
          })}
          icon={<CalendarOffIcon className="size-4" />}
          locale={locale}
        />
      </div>

      {canManage ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditingPerson(true)}
          >
            <PencilIcon className="size-4" />
            {t.hr.editStaff}
          </Button>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="dossier">{t.hr.tabDossier}</TabsTrigger>
          <TabsTrigger value="service">
            {t.hr.tabService}
            {person.teaching.length + person.vehicles.length > 0 ? (
              <Badge variant="secondary" className="ms-1.5 tabular-nums">
                {person.teaching.length + person.vehicles.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          {/* Absent rather than disabled without the code: a greyed-out "Pay"
              tab still tells a colleague there is a figure to go and ask
              about, which is what the permission exists to prevent. */}
          {canPayroll ? (
            <TabsTrigger value="pay">{t.hr.tabPay}</TabsTrigger>
          ) : null}
          <TabsTrigger value="attendance">{t.hr.attendance}</TabsTrigger>
          <TabsTrigger value="leave">{t.hr.leave}</TabsTrigger>
        </TabsList>

        {/* ── The file ─────────────────────────────────────────────────── */}
        <TabsContent value="dossier" className="grid gap-5">
          <Card>
            <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <Fact label={t.hr.phone} value={person.phone ?? "—"} ltr />
              <Fact label={t.hr.email} value={person.email ?? "—"} ltr />
              <Fact
                label={t.hr.nationalId}
                value={person.nationalId ?? "—"}
                ltr
              />
              <Fact
                label={t.hr.cnssNumber}
                value={person.cnssNumber ?? "—"}
                ltr
              />
              <Fact
                label={t.hr.hiredOn}
                value={
                  person.hiredOn ? formatDate(person.hiredOn, locale) : "—"
                }
              />
              <Fact
                label={t.hr.leftOn}
                value={person.leftOn ? formatDate(person.leftOn, locale) : "—"}
              />
              <Fact
                label={t.hr.account}
                value={person.userUsername ?? t.hr.noAccount}
                ltr
              />
              {canPayroll ? (
                <Fact label={t.hr.bankRib} value={person.bankRib ?? "—"} ltr />
              ) : null}
            </CardContent>
          </Card>

          {/* Last on the dossier tab: the answer to "I hired them into the
            wrong school", which is realised while reading the file rather than
            being what somebody came here for. */}
          {canManage ? (
            <MoveToSchoolCard
              title={t.hr.transfer}
              description={t.hr.transferHint}
              label={t.hr.transferSchool}
              confirmLabel={t.hr.transferConfirm}
              schools={transferTargets}
              action={(schoolId) => transferStaffAction(person.id, schoolId)}
            />
          ) : null}
        </TabsContent>

        {/* ── Duties ───────────────────────────────────────────────────── */}
        <TabsContent value="service" className="grid gap-5">
          <ServiceTab person={person} />
        </TabsContent>

        {/* ── Pay ──────────────────────────────────────────────────────── */}
        {canPayroll ? (
          <TabsContent value="pay" className="grid gap-5">
            <section className="grid gap-3">
              <SectionHeading
                label={t.hr.contracts}
                action={
                  canManage ? (
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <PlusIcon className="size-4" />
                      {t.hr.newContract}
                    </Button>
                  ) : null
                }
              />
              <p className="text-muted-foreground text-xs">
                {t.hr.supersededNote}
              </p>

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
                                {formatAmount(
                                  contract.baseSalaryCentimes,
                                  locale,
                                )}
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
                                        setEndingContract(contract)
                                      }
                                    >
                                      {t.hr.endContract}
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

            <section className="grid gap-3">
              <SectionHeading label={t.hr.payroll} />
              {person.salaries.length === 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <EmptyState
                      icon={<WalletIcon className="size-5" />}
                      title={t.hr.noPayslipYet}
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
                            <TableHead>{t.hr.period}</TableHead>
                            <TableHead className="text-end">
                              {t.hr.gross}
                            </TableHead>
                            <TableHead className="text-end">
                              {t.hr.net}
                            </TableHead>
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
                                    salary.status === "PAID"
                                      ? "secondary"
                                      : "outline"
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
              )}
            </section>
          </TabsContent>
        ) : null}

        {/* ── The register ─────────────────────────────────────────────── */}
        <TabsContent value="attendance" className="grid gap-5">
          <section className="grid gap-3">
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
                            <TableCell>
                              {formatDate(mark.date, locale)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  isChargeableAbsence(
                                    mark.status,
                                    mark.isJustified,
                                  )
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
                              {mark.status === "LATE" &&
                              mark.minutesLate > 0 ? (
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
        </TabsContent>

        {/* ── Leave ────────────────────────────────────────────────────── */}
        <TabsContent value="leave" className="grid gap-5">
          <section className="grid gap-3">
            {person.leave.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <EmptyState title={t.hr.noLeave} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.hr.leaveKind}</TableHead>
                          <TableHead>{t.hr.startsOn}</TableHead>
                          <TableHead>{t.hr.endsOn}</TableHead>
                          <TableHead className="text-end">
                            {t.hr.dayCount}
                          </TableHead>
                          <TableHead>{t.hr.leaveStatus}</TableHead>
                          <TableHead>{t.hr.decidedOn}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {person.leave.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              {
                                t.hrOptions.leaveKinds[
                                  request.kind as keyof typeof t.hrOptions.leaveKinds
                                ]
                              }
                            </TableCell>
                            <TableCell>
                              {formatDate(request.startsOn, locale)}
                            </TableCell>
                            <TableCell>
                              {formatDate(request.endsOn, locale)}
                            </TableCell>
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
                            <TableCell className="text-muted-foreground text-xs">
                              {request.decidedAt
                                ? formatDate(request.decidedAt, locale)
                                : "—"}
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
        </TabsContent>
      </Tabs>

      {editingPerson ? (
        <StaffDialog
          person={person}
          linkableUsers={linkableUsers}
          schoolRoles={schoolRoles}
          canCreateAccount={canCreateAccount}
          canPayroll={canPayroll}
          onClose={() => setEditingPerson(false)}
        />
      ) : null}

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

      {/* Ending a contract leaves somebody employed with nothing signed, which
          is the state the overview counts as a gap. Worth a question first. */}
      <AlertDialog
        open={endingContract !== null}
        onOpenChange={(open) => (!open ? setEndingContract(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.hr.endContractTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(t.hr.endContractBody, { name: person.fullName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                const contract = endingContract;
                if (!contract) return;
                run(() => endContractAction(contract.id));
                setEndingContract(null);
              }}
            >
              {t.hr.endContract}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * What this person is actually assigned to do: the classes they teach and the
 * buses they run.
 *
 * One tab rather than two, and no permission of its own — a teacher's timetable
 * and a driver's line are not confidential the way a salary is, and anybody who
 * may open the employee file may see them. Each half is simply absent when it
 * is empty, so a concierge's file does not carry two empty tables; when both
 * are empty the tab says so once.
 */
function ServiceTab({ person }: { person: StaffDetail }) {
  const t = useT();
  const locale = useLocale();

  if (person.teaching.length === 0 && person.vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<UsersIcon className="size-5" />}
            title={t.hr.noService}
            /* The distinction matters to whoever has to fix it: a teacher with
               no login has assignments the app simply cannot see. */
            description={
              person.jobRole === "TEACHER" && !person.userId
                ? t.hr.noServiceNoAccount
                : t.hr.noServiceHint
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {person.teaching.length > 0 ? (
        <section className="grid gap-3">
          <SectionHeading label={t.hr.teachingService} />
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.hr.classLabel}</TableHead>
                      <TableHead>{t.hr.subject}</TableHead>
                      <TableHead>{t.hr.group}</TableHead>
                      <TableHead className="text-end">{t.hr.pupils}</TableHead>
                      <TableHead className="text-end">
                        {t.hr.hoursPerWeek}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {person.teaching.map((duty) => (
                      <TableRow key={duty.id}>
                        <TableCell className="font-medium">
                          {duty.classCode}
                          <span className="text-muted-foreground ms-2 text-xs">
                            {duty.levelLabel}
                          </span>
                        </TableCell>
                        <TableCell>
                          {duty.subjectName}
                          {/* Co-taught: the mark still belongs to the primary,
                              so the file says which one this person is. */}
                          {duty.isPrimary ? null : (
                            <Badge variant="outline" className="ms-2">
                              {t.hr.coTeacher}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {duty.groupLabel ?? t.hr.wholeClass}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {duty.enrolled}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {duty.weeklyMinutes
                            ? `${Math.round((duty.weeklyMinutes / 60) * 10) / 10}${t.hr.hoursShort}`
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

      {person.vehicles.length > 0 ? (
        <section className="grid gap-3">
          <SectionHeading label={t.hr.transportService} />
          <div className="grid gap-4 lg:grid-cols-2">
            {person.vehicles.map((vehicle) => (
              <Card key={vehicle.id}>
                <CardContent className="grid gap-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium" dir="ltr">
                        {vehicle.registration}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[
                          vehicle.label,
                          interpolate(t.hr.seatCount, {
                            count: vehicle.seatCount,
                          }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {vehicle.duty === "DRIVER"
                        ? t.hr.dutyDriver
                        : t.hr.dutyAttendant}
                    </Badge>
                  </div>

                  {vehicle.routes.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      {t.hr.noLine}
                    </p>
                  ) : (
                    <ul className="grid gap-1.5">
                      {vehicle.routes.map((route) => (
                        <li
                          key={route.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-medium">{route.code}</span>
                            <span className="text-muted-foreground ms-2">
                              {route.name}
                            </span>
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {interpolate(t.hr.lineLoad, {
                              riders: route.taken,
                              stops: route.stopCount,
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* A lapsed insurance or visite technique is the driver's
                      problem before it is the fleet's, so it is on their file
                      and not only on the vehicle's. */}
                  {vehicle.insuranceExpiresOn || vehicle.inspectionExpiresOn ? (
                    <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                      <span>
                        {t.hr.insuranceExpires}:{" "}
                        {vehicle.insuranceExpiresOn
                          ? formatDate(vehicle.insuranceExpiresOn, locale)
                          : "—"}
                      </span>
                      <span>
                        {t.hr.inspectionExpires}:{" "}
                        {vehicle.inspectionExpiresOn
                          ? formatDate(vehicle.inspectionExpiresOn, locale)
                          : "—"}
                      </span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </>
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
            <FormField label={t.hr.contractKind} name="kind">
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
            </FormField>
            <FormField label={t.hr.contractStatus} name="status">
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
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
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
                defaultValue={toDateInputValue(contract?.startsOn)}
              />
            </FormField>
            <FormField
              label={t.hr.endsOn}
              name="endsOn"
              hint={t.hr.endsOnHint}
              error={errors.endsOn}
            >
              <Input
                id="endsOn"
                name="endsOn"
                type="date"
                dir="ltr"
                defaultValue={toDateInputValue(contract?.endsOn)}
              />
            </FormField>
            <FormField label={t.hr.trialEndsOn} name="trialEndsOn">
              <Input
                id="trialEndsOn"
                name="trialEndsOn"
                type="date"
                dir="ltr"
                defaultValue={toDateInputValue(contract?.trialEndsOn)}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
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
            </FormField>
            <FormField label={t.hr.weeklyHours} name="weeklyHours">
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
            </FormField>
          </div>
          <p className="text-muted-foreground text-xs">{t.hr.baseSalaryHint}</p>

          <FormField label={t.hr.notes} name="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={valueOf(state, "notes", contract?.notes)}
            />
          </FormField>

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
