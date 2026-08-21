"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { FormField, controlProps } from "@/components/form/form-field";
import {
  FormActions,
  FormGrid,
  FormLayout,
  FormSection,
} from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { ActionStateWith } from "@/lib/action-state";
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import {
  createFamilyAction,
  updateFamilyAction,
  type FamilyCreated,
} from "@/modules/families/actions";
import { PortalAccountDialog } from "@/modules/families/components/portal-account-dialog";
import {
  FAMILY_SITUATIONS,
  GUARDIAN_RELATIONSHIPS,
} from "@/modules/families/enums";
import type { FamilyDetail } from "@/modules/families/queries";
import type { IssuedPortalCredentials } from "@/modules/families/service";

/**
 * The dossier itself — address, phone, situation. Who is *on* the dossier is
 * edited from the detail screen, not here: a new family is created from a phone
 * call with a name and a number, and asking for the father's CIN before the
 * file exists is how a form gets abandoned.
 */
export function FamilyForm({ family }: { family?: FamilyDetail }) {
  const t = useT();
  const router = useRouter();
  const isEdit = Boolean(family);

  const [credentials, setCredentials] =
    React.useState<IssuedPortalCredentials | null>(null);
  const [createdFamilyId, setCreatedFamilyId] = React.useState<string | null>(
    null,
  );

  const [state, formAction] = useActionState<
    ActionStateWith<FamilyCreated>,
    FormData
  >(isEdit ? updateFamilyAction : createFamilyAction, IDLE);
  useActionFeedback(state, {
    onSuccess: () => {
      if (family) {
        router.push(`/families/${family.id}`);
        return;
      }
      // The credentials are shown once before leaving — see
      // `PortalAccountDialog` — so a brand-new file does not navigate away
      // until the office has had a chance to copy or print them.
      if (state.data?.credentials) {
        setCreatedFamilyId(state.data.familyId);
        setCredentials(state.data.credentials);
        return;
      }
      router.push(
        state.data?.familyId ? `/families/${state.data.familyId}` : "/families",
      );
    },
  });

  const errors = state.fieldErrors ?? {};
  const cancelHref = family ? `/families/${family.id}` : "/families";

  return (
    <form action={formAction}>
      {family ? <input type="hidden" name="id" value={family.id} /> : null}

      <FormLayout
        aside={
          <Card>
            <CardHeader>
              <CardTitle>{t.family.household}</CardTitle>
              <CardDescription>{t.family.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">{t.common.active}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.common.active} / {t.common.inactive}
                  </p>
                </div>
                <Switch
                  id="isActive"
                  name="isActive"
                  defaultChecked={checkedOf(
                    state,
                    "isActive",
                    family?.isActive ?? true,
                  )}
                />
              </div>

              {family ? (
                <dl className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">
                      {t.family.guardians}
                    </dt>
                    <dd className="tabular-nums">{family.guardianCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">
                      {t.family.children}
                    </dt>
                    <dd className="tabular-nums">{family.childCount}</dd>
                  </div>
                </dl>
              ) : null}
            </CardContent>
          </Card>
        }
      >
        <FormSection title={t.family.household}>
          <FormGrid cols={3}>
            <FormField
              name="code"
              label={t.family.code}
              hint={t.family.codeHint}
              error={errors.code}
            >
              <Input
                {...controlProps("code", errors.code, t.family.codeHint)}
                defaultValue={valueOf(state, "code", family?.code)}
                dir="ltr"
                placeholder="F-2025-0142"
              />
            </FormField>

            <FormField
              name="name"
              label={t.family.name}
              hint={t.family.nameHint}
              error={errors.name}
              required
              className="sm:col-span-2"
            >
              <Input
                {...controlProps("name", errors.name, t.family.nameHint)}
                defaultValue={valueOf(state, "name", family?.name)}
                placeholder="Bennis"
                required
              />
            </FormField>
          </FormGrid>

          <FormGrid cols={2}>
            <FormField
              name="nameAr"
              label={t.family.nameAr}
              error={errors.nameAr}
            >
              <Input
                {...controlProps("nameAr", errors.nameAr)}
                defaultValue={valueOf(state, "nameAr", family?.nameAr)}
                dir="rtl"
              />
            </FormField>

            <FormField
              name="situation"
              label={t.family.situation}
              error={errors.situation}
            >
              <Select
                name="situation"
                defaultValue={
                  valueOf(state, "situation", family?.situation) || "MARRIED"
                }
              >
                <SelectTrigger id="situation" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_SITUATIONS.map((situation) => (
                    <SelectItem key={situation} value={situation}>
                      {t.familyOptions.situations[situation]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title={t.family.contact}>
          <FormGrid cols={2}>
            <FormField name="phone" label={t.family.phone} error={errors.phone}>
              <Input
                {...controlProps("phone", errors.phone)}
                type="tel"
                defaultValue={valueOf(state, "phone", family?.phone)}
                dir="ltr"
                placeholder="+212 6 12 34 56 78"
              />
            </FormField>

            <FormField name="email" label={t.family.email} error={errors.email}>
              <Input
                {...controlProps("email", errors.email)}
                type="email"
                defaultValue={valueOf(state, "email", family?.email)}
                dir="ltr"
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Only on creation — an existing dossier's guardians are managed
          from its detail screen, not re-collected here. See the file's
          module note on why a new family is opened with a name and a
          number, not a form full of fields. */}
        {!isEdit ? (
          <FormSection
            title={t.family.primaryContact}
            description={t.family.firstContactSectionHint}
          >
            <FormGrid cols={3}>
              <FormField
                name="guardianRelationship"
                label={t.family.relationship}
                error={errors.guardianRelationship}
                required
              >
                <Select
                  name="guardianRelationship"
                  defaultValue={
                    valueOf(state, "guardianRelationship", undefined) ||
                    "FATHER"
                  }
                >
                  <SelectTrigger id="guardianRelationship" className="w-full">
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
                name="guardianFirstName"
                label={t.family.firstName}
                error={errors.guardianFirstName}
                required
              >
                <Input
                  {...controlProps(
                    "guardianFirstName",
                    errors.guardianFirstName,
                  )}
                  defaultValue={valueOf(state, "guardianFirstName", undefined)}
                  required
                />
              </FormField>

              <FormField
                name="guardianLastName"
                label={t.family.lastName}
                error={errors.guardianLastName}
                required
              >
                <Input
                  {...controlProps(
                    "guardianLastName",
                    errors.guardianLastName,
                  )}
                  defaultValue={valueOf(state, "guardianLastName", undefined)}
                  required
                />
              </FormField>
            </FormGrid>

            <FormField
              name="guardianPhone"
              label={t.family.phone}
              hint={t.family.guardianPhoneHint}
              error={errors.guardianPhone}
            >
              <Input
                {...controlProps("guardianPhone", errors.guardianPhone)}
                type="tel"
                defaultValue={valueOf(state, "guardianPhone", undefined)}
                dir="ltr"
                placeholder="+212 6 12 34 56 78"
              />
            </FormField>
          </FormSection>
        ) : null}

        <FormSection title={t.family.address}>
          <FormField
            name="addressLine"
            label={t.family.addressLine}
            error={errors.addressLine}
          >
            <Input
              {...controlProps("addressLine", errors.addressLine)}
              defaultValue={valueOf(state, "addressLine", family?.addressLine)}
            />
          </FormField>

          <FormGrid cols={2}>
            <FormField name="city" label={t.family.city} error={errors.city}>
              <Input
                {...controlProps("city", errors.city)}
                defaultValue={valueOf(state, "city", family?.city)}
              />
            </FormField>

            <FormField
              name="postalCode"
              label={t.family.postalCode}
              error={errors.postalCode}
            >
              <Input
                {...controlProps("postalCode", errors.postalCode)}
                defaultValue={valueOf(state, "postalCode", family?.postalCode)}
                dir="ltr"
              />
            </FormField>
          </FormGrid>

          <input type="hidden" name="country" value={family?.country ?? "MA"} />

          <FormField name="notes" label={t.family.notes} error={errors.notes}>
            <Textarea
              {...controlProps("notes", errors.notes)}
              defaultValue={valueOf(state, "notes", family?.notes)}
              rows={3}
            />
          </FormField>
        </FormSection>
      </FormLayout>

      <FormActions>
        <Button asChild type="button" variant="outline" size="lg">
          <Link href={cancelHref}>{t.common.cancel}</Link>
        </Button>
        <SubmitButton size="lg">
          {isEdit ? t.common.save : t.family.createFamily}
        </SubmitButton>
      </FormActions>

      {/* Shown once, then the office is sent on to the new dossier. */}
      <PortalAccountDialog
        credentials={credentials}
        onOpenChange={(open) => {
          if (open) return;
          setCredentials(null);
          router.push(
            createdFamilyId ? `/families/${createdFamilyId}` : "/families",
          );
        }}
      />
    </form>
  );
}
