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
import { checkedOf, valueOf } from "@/lib/form-values";
import { saveGuardianAction } from "@/modules/families/actions";
import type { ActionStateWith } from "@/lib/action-state";
import type { IssuedPortalCredentials } from "@/modules/families/service";
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
  parentJobs,
  onCredentials,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  guardian?: GuardianRow;
  /** The school's own professions, active ones only — see ParentJob. */
  parentJobs: { id: string; name: string }[];
  /**
   * Handed the household's credentials when saving this guardian opened the
   * dossier's access — which happens on the *first* one, automatically. The
   * password exists in readable form for this one moment, so it is passed up
   * to be shown rather than dropped when the dialog closes.
   */
  onCredentials?: (credentials: IssuedPortalCredentials) => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState<
    ActionStateWith<IssuedPortalCredentials>,
    FormData
  >(saveGuardianAction, IDLE);
  useActionFeedback(state, {
    onSuccess: () => {
      if (state.data) onCredentials?.(state.data);
      onOpenChange(false);
    },
  });

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
                    defaultValue={
                      valueOf(state, "relationship", guardian?.relationship) ||
                      "FATHER"
                    }
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
                    defaultValue={valueOf(
                      state,
                      "firstName",
                      guardian?.firstName,
                    )}
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
                    defaultValue={valueOf(
                      state,
                      "lastName",
                      guardian?.lastName,
                    )}
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
                    defaultValue={valueOf(state, "nameAr", guardian?.nameAr)}
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
                    defaultValue={valueOf(
                      state,
                      "nationalId",
                      guardian?.nationalId,
                    )}
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
                    defaultValue={valueOf(state, "phone", guardian?.phone)}
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
                    defaultValue={valueOf(
                      state,
                      "phoneAlt",
                      guardian?.phoneAlt,
                    )}
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
                    defaultValue={valueOf(state, "email", guardian?.email)}
                    dir="ltr"
                  />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  name="parentJobId"
                  label={t.family.profession}
                  hint={parentJobs.length === 0 ? t.family.noParentJobs : undefined}
                  error={errors.parentJobId}
                >
                  {/* The school's own list, not free text — a dossier familial
                    is read in aggregate, and "Prof.", "Professeur" and
                    "enseignant" were three answers to one question. */}
                  <Select
                    name="parentJobId"
                    defaultValue={
                      valueOf(state, "parentJobId", guardian?.parentJobId) ||
                      "none"
                    }
                    disabled={parentJobs.length === 0}
                  >
                    <SelectTrigger id="parentJobId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.common.none}</SelectItem>
                      {parentJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  name="employer"
                  label={t.family.employer}
                  error={errors.employer}
                >
                  <Input
                    {...controlProps("employer", errors.employer)}
                    defaultValue={valueOf(
                      state,
                      "employer",
                      guardian?.employer,
                    )}
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
                    defaultValue={valueOf(
                      state,
                      "addressLine",
                      guardian?.addressLine,
                    )}
                  />
                </FormField>

                <FormField
                  name="city"
                  label={t.family.city}
                  error={errors.city}
                >
                  <Input
                    {...controlProps("city", errors.city)}
                    defaultValue={valueOf(state, "city", guardian?.city)}
                  />
                </FormField>
              </div>

              <div className="grid gap-3 rounded-lg border p-3">
                <ToggleRow
                  name="isPrimaryContact"
                  label={t.family.isPrimaryContact}
                  hint={t.family.primaryContactHint}
                  defaultChecked={checkedOf(
                    state,
                    "isPrimaryContact",
                    guardian?.isPrimaryContact ?? false,
                  )}
                />
                <ToggleRow
                  name="isEmergencyContact"
                  label={t.family.isEmergencyContact}
                  defaultChecked={checkedOf(
                    state,
                    "isEmergencyContact",
                    guardian?.isEmergencyContact ?? false,
                  )}
                />
                <ToggleRow
                  name="canPickUp"
                  label={t.family.canPickUp}
                  defaultChecked={checkedOf(
                    state,
                    "canPickUp",
                    guardian?.canPickUp ?? true,
                  )}
                />
                <ToggleRow
                  name="isActive"
                  label={t.common.active}
                  defaultChecked={checkedOf(
                    state,
                    "isActive",
                    guardian?.isActive ?? true,
                  )}
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
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
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
