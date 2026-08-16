"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";

import { Combobox } from "@/components/form/combobox";
import { FormField } from "@/components/form/form-field";
import { FormNav, type FormNavItem } from "@/components/form/form-nav";
import {
  FormActions,
  FormGrid,
  FormLayout,
  FormSection,
} from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import type { Dictionary } from "@/lib/i18n/types";
import { hireStaffAction } from "@/modules/hr/actions";
import {
  CONTRACT_KINDS,
  JOB_ROLES,
  STAFF_STATUSES,
  departmentOf,
} from "@/modules/hr/enums";
import { GENDERS } from "@/modules/students/enums";
import { suggestUsername } from "@/modules/users/enums";

/**
 * Hiring somebody — one page, one submit.
 *
 * ── Why this replaced a dialog ──────────────────────────────────────────────
 * Taking somebody on is not one row. It is an employment record, the login they
 * sign in with, the contract they are engaged on, the subjects a teacher may be
 * given and the bus a driver takes — five things, across four modules, that a
 * school settles in one conversation with the person in front of them. The
 * modal it replaces held the first and a corner of the second, and left a
 * director to find three more screens afterwards: the contract dialog on the
 * fiche, "Qui enseigne quoi" under Configuration, and the fleet. In practice
 * the last two were never found, which is why the timetable generator kept
 * drawing grids with the teacher column empty.
 *
 * ── What the job role decides ───────────────────────────────────────────────
 * A professeur, a chauffeur and a directeur are not asked the same questions,
 * and asking everybody everything is how a form becomes something to be got
 * through rather than filled in. So `jobRole` chooses the sections: the
 * subjects appear for a teacher, the buses for a driver, and the table of
 * contents in the aside changes with them so the length of the form is honest.
 *
 * Everything but the four identity fields is optional. The length is not a
 * demand — it is what is available to answer while the person is sitting there.
 */

type Choice = { id: string; label: string };

/**
 * The table of contents, in render order. Built from the job role rather than
 * held as a constant, because two of the sections are not always drawn and a
 * jump link to a section that is not on the page scrolls nowhere.
 */
function sectionsFor(t: Dictionary, jobRole: string): FormNavItem[] {
  const items: FormNavItem[] = [
    { id: "section-identity", label: t.hr.identity },
    { id: "section-posting", label: t.hr.posting },
    { id: "section-contact", label: t.hr.contact },
    { id: "section-contract", label: t.hr.contract },
    { id: "section-access", label: t.hr.access },
  ];

  if (departmentOf(jobRole) === "TEACHING") {
    items.push({ id: "section-teaching", label: t.hr.teaching });
  }
  if (jobRole === "DRIVER") {
    items.push({ id: "section-transport", label: t.hr.busSection });
  }

  items.push({ id: "section-notes", label: t.hr.notes });
  return items;
}

export function HireForm({
  schoolRoles,
  jobFunctions,
  subjects,
  cycles,
  vehicles,
  canPayroll,
  canCreateAccount,
  canTeaching,
  canTransport,
  yearLabel,
}: {
  /** School-scoped roles the new login may be granted. */
  schoolRoles: { id: string; name: string }[];
  /** The school's own fonction list — see StaffFunction. */
  jobFunctions: { id: string; name: string }[];
  subjects: Choice[];
  /** The cycles the school runs, for the qualification's level scope. */
  cycles: Choice[];
  vehicles: Choice[];
  /** HR_PAYROLL — whether the bank details are asked for at all. */
  canPayroll: boolean;
  /** USER_CREATE. Minting a login is not the same authority as hiring. */
  canCreateAccount: boolean;
  /** TIMETABLE_MANAGE — whether this reader may declare what a teacher takes. */
  canTeaching: boolean;
  /** TRANSPORT_MANAGE — whether they may put somebody on a bus. */
  canTransport: boolean;
  /**
   * The year the qualifications are declared for. Null when none is in
   * context, which is what the subjects section says instead of writing rows
   * against a year nobody chose — see the note on TeacherSubject.
   */
  yearLabel: string | null;
}) {
  const t = useT();
  const [state, formAction] = useActionState(hireStaffAction, IDLE);
  // Success redirects to the new fiche from the action itself; this is only
  // here to raise the failures as toasts.
  useActionFeedback(state);

  const errors = state.fieldErrors ?? {};

  const [firstName, setFirstName] = React.useState(
    valueOf(state, "firstName", ""),
  );
  const [lastName, setLastName] = React.useState(valueOf(state, "lastName", ""));
  const [jobRole, setJobRole] = React.useState(
    valueOf(state, "jobRole", "") || "TEACHER",
  );

  const [createAccount, setCreateAccount] = React.useState(
    checkedOf(state, "createAccount", true),
  );
  const [withContract, setWithContract] = React.useState(
    checkedOf(state, "withContract", true),
  );

  /*
    The username follows the name until somebody overrides it — the same rule
    the user form uses, and the same reason: it is a suggestion, not a decision.
  */
  const [username, setUsername] = React.useState(
    valueOf(state, "accountUsername", ""),
  );
  const [touchedUsername, setTouchedUsername] = React.useState(false);
  const shownUsername = touchedUsername
    ? username
    : suggestUsername(firstName, lastName);

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "—";

  // A qualification hangs off the account, and is written against the year in
  // context — so the section has two things it needs before it can offer
  // anything, and says which is missing rather than silently doing nothing.
  const teaches = departmentOf(jobRole) === "TEACHING";
  const canDeclareSubjects = canTeaching && createAccount && yearLabel !== null;

  return (
    <form action={formAction}>
      <FormLayout
        aside={
          <>
            {/* Who is being taken on, as typed so far. On a blank form it is
                the only thing on screen that says what is being created. */}
            <Card className="gap-0 py-4">
              <CardContent className="flex items-center gap-3 px-4">
                <Avatar className="size-11 border">
                  <AvatarFallback className="text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {fullName || (
                      <span className="text-muted-foreground font-normal">
                        {t.hr.newStaff}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {
                      t.hrOptions.jobRoles[
                        jobRole as keyof typeof t.hrOptions.jobRoles
                      ]
                    }
                    {createAccount && shownUsername ? ` · ${shownUsername}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <FormNav label={t.hr.sections} items={sectionsFor(t, jobRole)} />
          </>
        }
      >
        {/* ── Identité ──────────────────────────────────────────────────── */}
        <FormSection
          id="section-identity"
          title={t.hr.identity}
          description={t.hr.identityHint}
        >
          <FormGrid>
            <FormField
              label={t.hr.firstName}
              name="firstName"
              error={errors.firstName}
              required
            >
              <Input
                id="firstName"
                name="firstName"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </FormField>
            <FormField
              label={t.hr.lastName}
              name="lastName"
              error={errors.lastName}
              required
            >
              <Input
                id="lastName"
                name="lastName"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </FormField>
          </FormGrid>

          {/* Both names, because the contract, the attestation de travail and
              the CNSS declaration are issued in Arabic as well as French. */}
          <FormGrid>
            <FormField label={t.hr.firstNameAr} name="firstNameAr">
              <Input
                id="firstNameAr"
                name="firstNameAr"
                dir="rtl"
                defaultValue={valueOf(state, "firstNameAr", "")}
              />
            </FormField>
            <FormField label={t.hr.lastNameAr} name="lastNameAr">
              <Input
                id="lastNameAr"
                name="lastNameAr"
                dir="rtl"
                defaultValue={valueOf(state, "lastNameAr", "")}
              />
            </FormField>
          </FormGrid>

          <FormGrid cols={3}>
            <FormField label={t.hr.gender} name="gender">
              <Select name="gender" defaultValue={valueOf(state, "gender", "")}>
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
            </FormField>
            <FormField
              label={t.hr.birthDate}
              name="birthDate"
              error={errors.birthDate}
            >
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                dir="ltr"
                defaultValue={valueOf(state, "birthDate", "")}
              />
            </FormField>
            <FormField label={t.hr.birthPlace} name="birthPlace">
              <Input
                id="birthPlace"
                name="birthPlace"
                defaultValue={valueOf(state, "birthPlace", "")}
              />
            </FormField>
          </FormGrid>

          <FormField label={t.hr.nationalId} name="nationalId">
            <Input
              id="nationalId"
              name="nationalId"
              dir="ltr"
              defaultValue={valueOf(state, "nationalId", "")}
            />
          </FormField>
        </FormSection>

        {/* ── Le poste ──────────────────────────────────────────────────── */}
        <FormSection
          id="section-posting"
          title={t.hr.posting}
          description={t.hr.postingHint}
        >
          <FormGrid cols={3}>
            <FormField label={t.hr.jobRole} name="jobRole">
              <Select name="jobRole" value={jobRole} onValueChange={setJobRole}>
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
            </FormField>
            <FormField
              label={t.hr.code}
              name="code"
              hint={t.hr.codeHint}
              error={errors.code}
            >
              <Input
                id="code"
                name="code"
                dir="ltr"
                defaultValue={valueOf(state, "code", "")}
              />
            </FormField>
            <FormField label={t.hr.staffStatus} name="status">
              <Select
                name="status"
                defaultValue={valueOf(state, "status", "") || "ACTIVE"}
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
            </FormField>
          </FormGrid>

          <FormGrid>
            <FormField
              label={t.hr.jobTitle}
              name="jobTitle"
              hint={t.hr.jobTitleHint}
            >
              <Input
                id="jobTitle"
                name="jobTitle"
                defaultValue={valueOf(state, "jobTitle", "")}
              />
            </FormField>
            {/* La fonction lands on the login's profile, not on the staff row —
                it is what an organigramme prints, and it only exists for
                somebody who has an account to hang it on. */}
            <FormField
              label={t.user.jobFunction}
              name="jobFunctionId"
              hint={createAccount ? undefined : t.hr.jobFunctionNeedsAccount}
            >
              <Combobox
                id="jobFunctionId"
                name="jobFunctionId"
                disabled={!createAccount || jobFunctions.length === 0}
                defaultValue={
                  valueOf(state, "jobFunctionId", "") || "__none__"
                }
                emptyOption={{ value: "__none__", label: t.common.notSet }}
                options={jobFunctions.map((jobFunction) => ({
                  value: jobFunction.id,
                  label: jobFunction.name,
                }))}
              />
            </FormField>
          </FormGrid>

          <FormGrid>
            <FormField label={t.hr.hiredOn} name="hiredOn">
              <Input
                id="hiredOn"
                name="hiredOn"
                type="date"
                dir="ltr"
                defaultValue={valueOf(state, "hiredOn", "")}
              />
            </FormField>
            {/* Only meaningful for somebody who is given lessons — the
                timetable generator is the one thing that reads it. */}
            {teaches ? (
              <FormField
                label={t.hr.maxWeeklyMinutes}
                name="maxWeeklyMinutes"
                hint={t.hr.maxWeeklyMinutesHint}
                error={errors.maxWeeklyMinutes}
              >
                <Input
                  id="maxWeeklyMinutes"
                  name="maxWeeklyMinutes"
                  type="number"
                  min={0}
                  step={30}
                  dir="ltr"
                  defaultValue={valueOf(state, "maxWeeklyMinutes", "")}
                />
              </FormField>
            ) : null}
          </FormGrid>
        </FormSection>

        {/* ── Contact ───────────────────────────────────────────────────── */}
        <FormSection
          id="section-contact"
          title={t.hr.contact}
          description={t.hr.contactHint}
        >
          <FormGrid>
            <FormField label={t.hr.phone} name="phone">
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={valueOf(state, "phone", "")}
              />
            </FormField>
            <FormField
              label={t.hr.email}
              name="email"
              hint={createAccount ? t.hr.emailIsLogin : undefined}
              error={errors.email}
              required={createAccount}
            >
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                required={createAccount}
                defaultValue={valueOf(state, "email", "")}
              />
            </FormField>
          </FormGrid>

          <FormField label={t.hr.address} name="address">
            <Input
              id="address"
              name="address"
              defaultValue={valueOf(state, "address", "")}
            />
          </FormField>
        </FormSection>

        {/* ── Le contrat ────────────────────────────────────────────────── */}
        <FormSection
          id="section-contract"
          title={t.hr.contract}
          description={t.hr.contractSectionHint}
        >
          <SectionSwitch
            name="withContract"
            label={t.hr.withContract}
            hint={t.hr.withContractHint}
            checked={withContract}
            onCheckedChange={setWithContract}
          />

          {withContract ? (
            <>
              <FormGrid cols={3}>
                <FormField label={t.hr.contractKind} name="contractKind">
                  <Select
                    name="contractKind"
                    defaultValue={
                      valueOf(state, "contractKind", "") || "CDI"
                    }
                  >
                    <SelectTrigger id="contractKind" className="w-full">
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
                <FormField
                  label={t.hr.startsOn}
                  name="contractStartsOn"
                  error={errors.contractStartsOn}
                  required
                >
                  <Input
                    id="contractStartsOn"
                    name="contractStartsOn"
                    type="date"
                    dir="ltr"
                    defaultValue={valueOf(state, "contractStartsOn", "")}
                  />
                </FormField>
                <FormField
                  label={t.hr.endsOn}
                  name="contractEndsOn"
                  hint={t.hr.endsOnHint}
                  error={errors.contractEndsOn}
                >
                  <Input
                    id="contractEndsOn"
                    name="contractEndsOn"
                    type="date"
                    dir="ltr"
                    defaultValue={valueOf(state, "contractEndsOn", "")}
                  />
                </FormField>
              </FormGrid>

              <FormGrid cols={3}>
                <FormField label={t.hr.trialEndsOn} name="contractTrialEndsOn">
                  <Input
                    id="contractTrialEndsOn"
                    name="contractTrialEndsOn"
                    type="date"
                    dir="ltr"
                    defaultValue={valueOf(state, "contractTrialEndsOn", "")}
                  />
                </FormField>
                {/* Behind HR_PAYROLL, like every other figure: whoever keeps
                    the staff file is not always who may see what it pays. */}
                {canPayroll ? (
                  <FormField
                    label={t.hr.baseSalary}
                    name="contractBaseSalary"
                    hint={t.hr.baseSalaryHint}
                    error={errors.contractBaseSalary}
                  >
                    <Input
                      id="contractBaseSalary"
                      name="contractBaseSalary"
                      type="number"
                      min={0}
                      step="0.01"
                      dir="ltr"
                      defaultValue={valueOf(state, "contractBaseSalary", "")}
                    />
                  </FormField>
                ) : null}
                <FormField
                  label={t.hr.weeklyHours}
                  name="contractWeeklyHours"
                  error={errors.contractWeeklyHours}
                >
                  <Input
                    id="contractWeeklyHours"
                    name="contractWeeklyHours"
                    type="number"
                    min={0}
                    dir="ltr"
                    defaultValue={valueOf(state, "contractWeeklyHours", "")}
                  />
                </FormField>
              </FormGrid>
            </>
          ) : null}

          {/* The two declarations a Moroccan payroll cannot be run without.
              They sit with the contract rather than with the identity because
              that is the paperwork they arrive on. */}
          <FormGrid>
            <FormField
              label={t.hr.cnssNumber}
              name="cnssNumber"
              hint={t.hr.cnssHint}
            >
              <Input
                id="cnssNumber"
                name="cnssNumber"
                dir="ltr"
                defaultValue={valueOf(state, "cnssNumber", "")}
              />
            </FormField>
            {canPayroll ? (
              <FormField label={t.hr.bankRib} name="bankRib">
                <Input
                  id="bankRib"
                  name="bankRib"
                  dir="ltr"
                  defaultValue={valueOf(state, "bankRib", "")}
                />
              </FormField>
            ) : null}
          </FormGrid>
        </FormSection>

        {/* ── L'accès ───────────────────────────────────────────────────── */}
        <FormSection
          id="section-access"
          title={t.hr.access}
          description={t.hr.accessHint}
        >
          {canCreateAccount ? (
            <>
              <SectionSwitch
                name="createAccount"
                label={t.hr.createAccount}
                hint={t.hr.createAccountHint}
                checked={createAccount}
                onCheckedChange={setCreateAccount}
              />

              {createAccount ? (
                <>
                  <FormGrid>
                    <FormField
                      label={t.user.username}
                      name="accountUsername"
                      hint={t.user.usernameHint}
                      error={errors.accountUsername}
                    >
                      <Input
                        id="accountUsername"
                        name="accountUsername"
                        dir="ltr"
                        spellCheck={false}
                        autoComplete="off"
                        value={shownUsername}
                        onChange={(event) => {
                          setTouchedUsername(true);
                          setUsername(event.target.value);
                        }}
                      />
                    </FormField>
                    <FormField
                      label={t.hr.accountPassword}
                      name="accountPassword"
                      hint={t.hr.accountPasswordHint}
                      error={errors.accountPassword}
                    >
                      <Input
                        id="accountPassword"
                        name="accountPassword"
                        type="password"
                        autoComplete="new-password"
                      />
                    </FormField>
                  </FormGrid>

                  <FormField
                    label={t.hr.accountRole}
                    name="accountRoleId"
                    hint={t.hr.accountRoleHint}
                    error={errors.accountRoleId}
                  >
                    <Combobox
                      id="accountRoleId"
                      name="accountRoleId"
                      defaultValue={
                        valueOf(state, "accountRoleId", "") || "__none__"
                      }
                      emptyOption={{
                        value: "__none__",
                        label: t.hr.noPermissions,
                      }}
                      options={schoolRoles.map((role) => ({
                        value: role.id,
                        label: role.name,
                      }))}
                    />
                  </FormField>
                </>
              ) : null}
            </>
          ) : (
            <Notice>{t.hr.accountNotPermitted}</Notice>
          )}
        </FormSection>

        {/* ── Les matières ──────────────────────────────────────────────── */}
        {teaches ? (
          <FormSection
            id="section-teaching"
            title={t.hr.teaching}
            description={t.hr.teachingHint}
          >
            {!canTeaching ? (
              <Notice>{t.hr.subjectsNotPermitted}</Notice>
            ) : !createAccount ? (
              <Notice>{t.hr.subjectsNeedAccount}</Notice>
            ) : yearLabel === null ? (
              <Notice>{t.errors.noSchoolYearContext}</Notice>
            ) : subjects.length === 0 ? (
              <Notice>{t.hr.noSubjects}</Notice>
            ) : null}

            {canDeclareSubjects && subjects.length > 0 ? (
              <>
                <FormField
                  label={t.hr.subjects}
                  name="subjectIds"
                  hint={t.hr.subjectsHint}
                  error={errors.subjectIds}
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {subjects.map((subject) => (
                      <Label
                        key={subject.id}
                        htmlFor={`subject-${subject.id}`}
                        className="hover:bg-accent/50 flex items-start gap-2.5 rounded-lg border p-3 text-sm font-normal"
                      >
                        <Checkbox
                          id={`subject-${subject.id}`}
                          name="subjectIds"
                          value={subject.id}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">{subject.label}</span>
                      </Label>
                    ))}
                  </div>
                </FormField>

                <FormGrid>
                  <FormField
                    label={t.hr.qualificationCycle}
                    name="qualificationCycleId"
                    hint={t.hr.qualificationCycleHint}
                  >
                    <Combobox
                      id="qualificationCycleId"
                      name="qualificationCycleId"
                      defaultValue="__none__"
                      emptyOption={{
                        value: "__none__",
                        label: t.hr.everyCycle,
                      }}
                      options={cycles.map((cycle) => ({
                        value: cycle.id,
                        label: cycle.label,
                      }))}
                    />
                  </FormField>
                  <div className="flex items-end pb-2">
                    <Badge variant="secondary">{yearLabel}</Badge>
                  </div>
                </FormGrid>
              </>
            ) : null}
          </FormSection>
        ) : null}

        {/* ── Le bus ────────────────────────────────────────────────────── */}
        {jobRole === "DRIVER" ? (
          <FormSection
            id="section-transport"
            title={t.hr.busSection}
            description={t.hr.busHint}
          >
            {!canTransport ? (
              <Notice>{t.hr.busesNotPermitted}</Notice>
            ) : vehicles.length === 0 ? (
              <Notice>{t.hr.noVehicles}</Notice>
            ) : (
              <FormField
                label={t.hr.buses}
                name="vehicleIds"
                hint={t.hr.busesHint}
                error={errors.vehicleIds}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {vehicles.map((vehicle) => (
                    <Label
                      key={vehicle.id}
                      htmlFor={`vehicle-${vehicle.id}`}
                      className="hover:bg-accent/50 flex items-start gap-2.5 rounded-lg border p-3 text-sm font-normal"
                    >
                      <Checkbox
                        id={`vehicle-${vehicle.id}`}
                        name="vehicleIds"
                        value={vehicle.id}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1" dir="ltr">
                        {vehicle.label}
                      </span>
                    </Label>
                  ))}
                </div>
              </FormField>
            )}
          </FormSection>
        ) : null}

        <FormSection id="section-notes" title={t.hr.notes}>
          <FormField label={t.hr.notes} name="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={valueOf(state, "notes", "")}
            />
          </FormField>
        </FormSection>
      </FormLayout>

      <FormActions hint={t.hr.hireHint}>
        <Button type="button" variant="outline" asChild>
          <Link href="/hr/staff">{t.common.cancel}</Link>
        </Button>
        <SubmitButton>{t.hr.hire}</SubmitButton>
      </FormActions>
    </form>
  );
}

/**
 * The header of an opt-in section: a switch that decides whether the fields
 * under it are asked for at all.
 *
 * Its own component because the contract and the login share the shape exactly,
 * and because the switch has to keep posting its name — the action reads it to
 * know whether the blank boxes underneath mean "not filled in" or "not asked".
 */
function SectionSwitch({
  name,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="bg-muted/40 flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <Label htmlFor={name} className="font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      </div>
      <Switch
        id={name}
        name={name}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

/** Why a section has nothing to offer — a permission, a year, an empty list. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground bg-muted/40 rounded-lg border border-dashed p-3 text-sm">
      {children}
    </p>
  );
}
