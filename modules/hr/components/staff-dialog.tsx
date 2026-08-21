"use client";

import * as React from "react";

import { Combobox } from "@/components/form/combobox";
import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionStateWith } from "@/lib/action-state";
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import { toDateInputValue } from "@/lib/i18n/format";
import { saveStaffAction } from "@/modules/hr/actions";
import type { IssuedStaffCredentials } from "@/modules/hr/actions";
import { StaffAccountDialog } from "@/modules/hr/components/staff-account-dialog";
import { JOB_ROLES, STAFF_STATUSES } from "@/modules/hr/enums";
import type { StaffDetail } from "@/modules/hr/queries";
import { GENDERS } from "@/modules/students/enums";
import { suggestUsername } from "@/modules/users/enums";

/**
 * The employee form, for creating one and for editing one.
 *
 * ── Why editing is fed a `StaffDetail` and not a list row ───────────────────
 * `saveStaffAction` writes every column the form declares, so a field the form
 * does not render posts blank and is nulled. This dialog used to live on the
 * list screen and be handed a `StaffRow`, which carries none of the identity
 * columns — so opening somebody, changing a phone number and saving wiped their
 * Arabic name, CIN, CNSS number, RIB, address, birth date and notes. Three of
 * those are what a contract and a CNSS declaration are issued from.
 *
 * The fix is structural rather than a longer list of `defaultValue`s: editing
 * is only offered from the employee's own screen, where the whole record has
 * already been read, and the list creates. A row that cannot fill the form is
 * therefore never given the chance to.
 *
 * `bankRib` is rendered — and posted — only for a reader holding HR_PAYROLL.
 * The action mirrors that: without the code the column is left untouched rather
 * than written blank, so a manager editing a phone number cannot quietly drop
 * the bank details they were never shown.
 */
export function StaffDialog({
  person,
  linkableUsers,
  schoolRoles,
  canPayroll,
  canCreateAccount,
  onClose,
}: {
  /** Null to create. */
  person: StaffDetail | null;
  linkableUsers: { id: string; label: string }[];
  /** School-scoped roles a new login may be granted. */
  schoolRoles: { id: string; name: string }[];
  canPayroll: boolean;
  /** USER_CREATE. Minting a login is not the same authority as hiring. */
  canCreateAccount: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [credentials, setCredentials] =
    React.useState<IssuedStaffCredentials | null>(null);
  const [state, formAction] = React.useActionState<
    ActionStateWith<IssuedStaffCredentials>,
    FormData
  >(saveStaffAction, IDLE);
  useActionFeedback(state, {
    onSuccess: () => {
      // The generated password is readable for this one moment: the dialog
      // stays until it has been handed over, and closes the fiche after.
      if (state.data) {
        setCredentials(state.data);
        return;
      }
      onClose();
    },
  });
  const errors = state.fieldErrors ?? {};

  /*
    The username follows the name until somebody overrides it — the same rule
    the user form uses, and the same reason: it is a suggestion, not a decision.
  */
  const [firstName, setFirstName] = React.useState(
    valueOf(state, "firstName", person?.firstName),
  );
  const [lastName, setLastName] = React.useState(
    valueOf(state, "lastName", person?.lastName),
  );
  const [createAccount, setCreateAccount] = React.useState(
    checkedOf(state, "createAccount", false),
  );
  const [username, setUsername] = React.useState(
    valueOf(state, "accountUsername", ""),
  );
  const [touchedUsername, setTouchedUsername] = React.useState(false);

  const shownUsername = touchedUsername
    ? username
    : suggestUsername(firstName, lastName);

  // Only when hiring. An employee who already signs in has an account, and the
  // switch would offer to mint them a second one.
  const offerAccount = canCreateAccount && !person?.userId;

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
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t.hr.firstNameAr} name="firstNameAr">
              <Input
                id="firstNameAr"
                name="firstNameAr"
                dir="rtl"
                defaultValue={valueOf(state, "firstNameAr", person?.firstNameAr)}
              />
            </FormField>
            <FormField label={t.hr.lastNameAr} name="lastNameAr">
              <Input
                id="lastNameAr"
                name="lastNameAr"
                dir="rtl"
                defaultValue={valueOf(state, "lastNameAr", person?.lastNameAr)}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
              label={t.hr.code}
              name="code"
              hint={person ? undefined : t.hr.codeHint}
              error={errors.code}
            >
              <Input
                id="code"
                name="code"
                defaultValue={valueOf(state, "code", person?.code)}
              />
            </FormField>
            <FormField label={t.hr.jobRole} name="jobRole">
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
            </FormField>
            <FormField label={t.hr.staffStatus} name="status">
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
            </FormField>
          </div>

          <FormField
            label={t.hr.jobTitle}
            name="jobTitle"
            hint={t.hr.jobTitleHint}
          >
            <Input
              id="jobTitle"
              name="jobTitle"
              defaultValue={valueOf(state, "jobTitle", person?.jobTitle)}
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label={t.hr.gender} name="gender">
              <Select
                name="gender"
                defaultValue={valueOf(state, "gender", person?.gender)}
              >
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
                defaultValue={person?.birthDate ?? ""}
              />
            </FormField>
            <FormField label={t.hr.birthPlace} name="birthPlace">
              <Input
                id="birthPlace"
                name="birthPlace"
                defaultValue={valueOf(state, "birthPlace", person?.birthPlace)}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label={t.hr.hiredOn} name="hiredOn">
              <Input
                id="hiredOn"
                name="hiredOn"
                type="date"
                dir="ltr"
                defaultValue={toDateInputValue(person?.hiredOn)}
              />
            </FormField>
            <FormField label={t.hr.leftOn} name="leftOn">
              <Input
                id="leftOn"
                name="leftOn"
                type="date"
                dir="ltr"
                defaultValue={toDateInputValue(person?.leftOn)}
              />
            </FormField>
            <FormField label={t.hr.phone} name="phone">
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={valueOf(state, "phone", person?.phone)}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t.hr.email} name="email" error={errors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                defaultValue={valueOf(state, "email", person?.email)}
              />
            </FormField>
            <FormField label={t.hr.address} name="address">
              <Input
                id="address"
                name="address"
                defaultValue={valueOf(state, "address", person?.address)}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label={t.hr.nationalId} name="nationalId">
              <Input
                id="nationalId"
                name="nationalId"
                dir="ltr"
                defaultValue={valueOf(state, "nationalId", person?.nationalId)}
              />
            </FormField>
            <FormField
              label={t.hr.cnssNumber}
              name="cnssNumber"
              hint={t.hr.cnssHint}
            >
              <Input
                id="cnssNumber"
                name="cnssNumber"
                dir="ltr"
                defaultValue={valueOf(state, "cnssNumber", person?.cnssNumber)}
              />
            </FormField>
            {/* A bank detail. Absent — not blanked — without HR_PAYROLL, and
                the action leaves the column alone when it is not posted. */}
            {canPayroll ? (
              <FormField label={t.hr.bankRib} name="bankRib">
                <Input
                  id="bankRib"
                  name="bankRib"
                  dir="ltr"
                  defaultValue={valueOf(state, "bankRib", person?.bankRib)}
                />
              </FormField>
            ) : null}
          </div>

          {/* Only for the minority who sign in — see the note on Staff.userId. */}
          {linkableUsers.length > 0 ? (
            <FormField
              label={t.hr.account}
              name="userId"
              hint={t.hr.accountHint}
            >
              <Combobox
                id="userId"
                name="userId"
                defaultValue={
                  valueOf(state, "userId", person?.userId) || "__none__"
                }
                emptyOption={{ value: "__none__", label: t.hr.noAccount }}
                options={linkableUsers.map((user) => ({
                  value: user.id,
                  label: user.label,
                }))}
              />
            </FormField>
          ) : null}

          {/*
            Giving a new hire a login. Behind USER_CREATE and only when the
            record has none — see `offerAccount`, and the note in the action.
          */}
          {offerAccount ? (
            <fieldset className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor="createAccount" className="font-medium">
                    {t.hr.createAccount}
                  </Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t.hr.createAccountHint}
                  </p>
                </div>
                <Switch
                  id="createAccount"
                  name="createAccount"
                  checked={createAccount}
                  onCheckedChange={setCreateAccount}
                />
              </div>

              {createAccount ? (
                <div className="grid gap-3 border-t pt-3">
                  {/* No password field: one is generated and shown once when
                    the form is submitted — see `StaffAccountDialog`. */}
                  <FormField
                    label={t.user.username}
                    name="accountUsername"
                    hint={t.hr.accountPasswordHint}
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
                    label={t.hr.accountRole}
                    name="accountRoleId"
                    hint={t.hr.accountRoleHint}
                    error={errors.accountRoleId}
                  >
                    <Combobox
                      id="accountRoleId"
                      name="accountRoleId"
                      defaultValue="__none__"
                      emptyOption={{ value: "__none__", label: t.hr.noAccount }}
                      options={schoolRoles.map((role) => ({
                        value: role.id,
                        label: role.name,
                      }))}
                    />
                  </FormField>
                </div>
              ) : null}
            </fieldset>
          ) : null}

          <FormField label={t.hr.notes} name="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={valueOf(state, "notes", person?.notes)}
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

      {/* Shown once, then the fiche closes behind it. */}
      <StaffAccountDialog
        credentials={credentials}
        onOpenChange={(open) => {
          if (open) return;
          setCredentials(null);
          onClose();
        }}
      />
    </Dialog>
  );
}
