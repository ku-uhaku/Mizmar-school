"use client";

import * as React from "react";
import { useActionState } from "react";

import { FormField, controlProps } from "@/components/form/form-field";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { IDLE } from "@/lib/action-state";
import { saveGuardianAction } from "@/modules/families/actions";
import { GUARDIAN_RELATIONSHIPS } from "@/modules/families/enums";
import type { GuardianRow } from "@/modules/families/queries";

/**
 * Add or edit one adult on a dossier. A dialog rather than a page: it is a dozen
 * short fields and it is always opened from the family it belongs to, so
 * navigating away and back would lose the reader's place for no gain.
 */
export function GuardianDialog({
  open,
  onOpenChange,
  familyId,
  guardian,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  guardian?: GuardianRow;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveGuardianAction, IDLE);
  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {guardian ? t.family.editGuardian : t.family.addGuardian}
          </DialogTitle>
          <DialogDescription>{t.family.guardiansHint}</DialogDescription>
        </DialogHeader>

        {/*
          Remounted per target so the uncontrolled inputs pick up the right
          defaults — without the key, opening "edit" after "add" would keep the
          blank values.
        */}
        <form action={formAction} key={guardian?.id ?? "new"}>
          <input type="hidden" name="familyId" value={familyId} />
          {guardian ? (
            <input type="hidden" name="id" value={guardian.id} />
          ) : null}

          <ScrollArea className="-mx-6 max-h-[60vh] px-6">
            <div className="grid gap-5 py-1">
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField
                  name="relationship"
                  label={t.family.relationship}
                  error={errors.relationship}
                  required
                >
                  <Select
                    name="relationship"
                    defaultValue={guardian?.relationship ?? "FATHER"}
                  >
                    <SelectTrigger id="relationship" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GUARDIAN_RELATIONSHIPS.map((relationship) => (
                        <SelectItem key={relationship} value={relationship}>
                          {t.familyOptions.relationships[relationship]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  name="firstName"
                  label={t.family.firstName}
                  error={errors.firstName}
                  required
                >
                  <Input
                    {...controlProps("firstName", errors.firstName)}
                    defaultValue={guardian?.firstName ?? ""}
                    required
                  />
                </FormField>

                <FormField
                  name="lastName"
                  label={t.family.lastName}
                  error={errors.lastName}
                  required
                >
                  <Input
                    {...controlProps("lastName", errors.lastName)}
                    defaultValue={guardian?.lastName ?? ""}
                    required
                  />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  name="nameAr"
                  label={t.family.guardianNameAr}
                  error={errors.nameAr}
                >
                  <Input
                    {...controlProps("nameAr", errors.nameAr)}
                    defaultValue={guardian?.nameAr ?? ""}
                    dir="rtl"
                  />
                </FormField>

                <FormField
                  name="nationalId"
                  label={t.family.nationalId}
                  error={errors.nationalId}
                >
                  <Input
                    {...controlProps("nationalId", errors.nationalId)}
                    defaultValue={guardian?.nationalId ?? ""}
                    dir="ltr"
                    className="uppercase"
                    placeholder="BE123456"
                  />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <FormField
                  name="phone"
                  label={t.family.phone}
                  error={errors.phone}
                >
                  <Input
                    {...controlProps("phone", errors.phone)}
                    type="tel"
                    defaultValue={guardian?.phone ?? ""}
                    dir="ltr"
                  />
                </FormField>

                <FormField
                  name="phoneAlt"
                  label={t.family.phoneAlt}
                  error={errors.phoneAlt}
                >
                  <Input
                    {...controlProps("phoneAlt", errors.phoneAlt)}
                    type="tel"
                    defaultValue={guardian?.phoneAlt ?? ""}
                    dir="ltr"
                  />
                </FormField>

                <FormField
                  name="email"
                  label={t.family.email}
                  error={errors.email}
                >
                  <Input
                    {...controlProps("email", errors.email)}
                    type="email"
                    defaultValue={guardian?.email ?? ""}
                    dir="ltr"
                  />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  name="profession"
                  label={t.family.profession}
                  error={errors.profession}
                >
                  <Input
                    {...controlProps("profession", errors.profession)}
                    defaultValue={guardian?.profession ?? ""}
                  />
                </FormField>

                <FormField
                  name="employer"
                  label={t.family.employer}
                  error={errors.employer}
                >
                  <Input
                    {...controlProps("employer", errors.employer)}
                    defaultValue={guardian?.employer ?? ""}
                  />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <FormField
                  name="addressLine"
                  label={t.family.ownAddress}
                  hint={t.family.ownAddressHint}
                  error={errors.addressLine}
                  className="sm:col-span-2"
                >
                  <Input
                    {...controlProps(
                      "addressLine",
                      errors.addressLine,
                      t.family.ownAddressHint,
                    )}
                    defaultValue={guardian?.addressLine ?? ""}
                  />
                </FormField>

                <FormField name="city" label={t.family.city} error={errors.city}>
                  <Input
                    {...controlProps("city", errors.city)}
                    defaultValue={guardian?.city ?? ""}
                  />
                </FormField>
              </div>

              <div className="grid gap-3 rounded-lg border p-3">
                <ToggleRow
                  name="isPrimaryContact"
                  label={t.family.isPrimaryContact}
                  hint={t.family.primaryContactHint}
                  defaultChecked={guardian?.isPrimaryContact ?? false}
                />
                <ToggleRow
                  name="isEmergencyContact"
                  label={t.family.isEmergencyContact}
                  defaultChecked={guardian?.isEmergencyContact ?? false}
                />
                <ToggleRow
                  name="canPickUp"
                  label={t.family.canPickUp}
                  defaultChecked={guardian?.canPickUp ?? true}
                />
                <ToggleRow
                  name="isActive"
                  label={t.common.active}
                  defaultChecked={guardian?.isActive ?? true}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.common.cancel}
            </Button>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={name}>{label}</Label>
        {hint ? (
          <p className="text-muted-foreground text-xs">{hint}</p>
        ) : null}
      </div>
      <Switch id={name} name={name} defaultChecked={defaultChecked} />
    </div>
  );
}

/** Shared by the family detail screen and the student profile's family tab. */
export function useGuardianDialog() {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GuardianRow | undefined>();

  return {
    open,
    setOpen,
    editing,
    openCreate: () => {
      setEditing(undefined);
      setOpen(true);
    },
    openEdit: (guardian: GuardianRow) => {
      setEditing(guardian);
      setOpen(true);
    },
  };
}
