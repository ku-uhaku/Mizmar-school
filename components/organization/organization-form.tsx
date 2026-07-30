"use client";

import { useActionState } from "react";

import { updateOrganizationAction } from "@/app/actions/organization";
import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDLE } from "@/lib/action-state";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";

export type OrganizationValues = {
  name: string;
  legalName: string | null;
  ice: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  logoUrl: string | null;
  defaultLocale: string;
};

export function OrganizationForm({
  organization,
  canEdit,
}: {
  organization: OrganizationValues;
  canEdit: boolean;
}) {
  const t = useT();
  const [state, formAction] = useActionState(updateOrganizationAction, IDLE);
  useActionFeedback(state);

  const errors = state.fieldErrors ?? {};
  // Read-only mode still shows the real values — the page is "view or update".
  const readOnly = !canEdit;

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-2">
      <fieldset disabled={readOnly} className="contents">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.organization.general}</CardTitle>
            <CardDescription>{t.organization.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField
              name="name"
              label={t.organization.name}
              error={errors.name}
              required
            >
              <Input
                {...controlProps("name", errors.name)}
                defaultValue={organization.name}
                required
              />
            </FormField>

            <FormField
              name="legalName"
              label={t.organization.legalName}
              error={errors.legalName}
            >
              <Input
                {...controlProps("legalName", errors.legalName)}
                defaultValue={organization.legalName ?? ""}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="ice"
                label={t.organization.ice}
                hint={t.organization.iceHint}
                error={errors.ice}
              >
                <Input
                  {...controlProps("ice", errors.ice, t.organization.iceHint)}
                  defaultValue={organization.ice ?? ""}
                  dir="ltr"
                />
              </FormField>

              <FormField
                name="taxId"
                label={t.organization.taxId}
                error={errors.taxId}
              >
                <Input
                  {...controlProps("taxId", errors.taxId)}
                  defaultValue={organization.taxId ?? ""}
                  dir="ltr"
                />
              </FormField>
            </div>

            <FormField
              name="defaultLocale"
              label={t.organization.defaultLocale}
              error={errors.defaultLocale}
            >
              <Select
                name="defaultLocale"
                defaultValue={organization.defaultLocale}
                disabled={readOnly}
              >
                <SelectTrigger id="defaultLocale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {LOCALE_META[code].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              name="logoUrl"
              label={t.organization.logoUrl}
              error={errors.logoUrl}
            >
              <Input
                {...controlProps("logoUrl", errors.logoUrl)}
                type="url"
                defaultValue={organization.logoUrl ?? ""}
                dir="ltr"
                placeholder="https://…"
              />
            </FormField>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t.organization.contact}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                name="email"
                label={t.organization.email}
                error={errors.email}
              >
                <Input
                  {...controlProps("email", errors.email)}
                  type="email"
                  defaultValue={organization.email ?? ""}
                  dir="ltr"
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  name="phone"
                  label={t.organization.phone}
                  error={errors.phone}
                >
                  <Input
                    {...controlProps("phone", errors.phone)}
                    type="tel"
                    defaultValue={organization.phone ?? ""}
                    dir="ltr"
                  />
                </FormField>

                <FormField
                  name="website"
                  label={t.organization.website}
                  error={errors.website}
                >
                  <Input
                    {...controlProps("website", errors.website)}
                    type="url"
                    defaultValue={organization.website ?? ""}
                    dir="ltr"
                    placeholder="https://…"
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t.organization.address}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                name="addressLine"
                label={t.organization.addressLine}
                error={errors.addressLine}
              >
                <Input
                  {...controlProps("addressLine", errors.addressLine)}
                  defaultValue={organization.addressLine ?? ""}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  name="city"
                  label={t.organization.city}
                  error={errors.city}
                >
                  <Input
                    {...controlProps("city", errors.city)}
                    defaultValue={organization.city ?? ""}
                  />
                </FormField>

                <FormField
                  name="region"
                  label={t.organization.region}
                  error={errors.region}
                >
                  <Input
                    {...controlProps("region", errors.region)}
                    defaultValue={organization.region ?? ""}
                  />
                </FormField>

                <FormField
                  name="postalCode"
                  label={t.organization.postalCode}
                  error={errors.postalCode}
                >
                  <Input
                    {...controlProps("postalCode", errors.postalCode)}
                    defaultValue={organization.postalCode ?? ""}
                    dir="ltr"
                  />
                </FormField>
              </div>

              <FormField
                name="country"
                label={t.organization.country}
                error={errors.country}
              >
                <Input
                  {...controlProps("country", errors.country)}
                  defaultValue={organization.country ?? "MA"}
                  maxLength={2}
                  dir="ltr"
                  className="w-24 uppercase"
                />
              </FormField>
            </CardContent>
          </Card>
        </div>
      </fieldset>

      {canEdit ? (
        <div className="lg:col-span-2">
          <SubmitButton>{t.common.save}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
