"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  createSchoolAction,
  updateSchoolAction,
} from "@/modules/schools/actions";
import { FormField, controlProps } from "@/components/form/form-field";
import { ImageField } from "@/components/form/image-field";
import {
  FormActions,
  FormGrid,
  FormLayout,
  FormSection,
} from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import type { SchoolRow } from "@/modules/schools/components/schools-manager";
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
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import { SCHOOL_LEVELS } from "@/modules/schools/enums";

export function SchoolForm({ school }: { school?: SchoolRow }) {
  const t = useT();
  const router = useRouter();
  const isEdit = Boolean(school);

  const [state, formAction] = useActionState(
    isEdit ? updateSchoolAction : createSchoolAction,
    IDLE,
  );
  // Toast, then return to the list — the list is where the result is visible.
  useActionFeedback(state, { onSuccess: () => router.push("/schools") });

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {school ? <input type="hidden" name="id" value={school.id} /> : null}

      <FormLayout
        aside={
          <Card>
            <CardHeader>
              <CardTitle>{t.school.status}</CardTitle>
              <CardDescription>{t.school.statusDescription}</CardDescription>
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
                    school?.isActive ?? true,
                  )}
                />
              </div>

              {isEdit && school ? (
                <dl className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{t.school.years}</dt>
                    <dd className="tabular-nums">{school.yearCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">
                      {t.school.members}
                    </dt>
                    <dd className="tabular-nums">{school.memberCount}</dd>
                  </div>
                </dl>
              ) : null}
            </CardContent>
          </Card>
        }
      >
        <FormSection title={t.organization.general}>
          <FormGrid cols={3}>
            <FormField
              name="code"
              label={t.school.code}
              hint={t.school.codeHint}
              error={errors.code}
              required
            >
              <Input
                {...controlProps("code", errors.code, t.school.codeHint)}
                defaultValue={valueOf(state, "code", school?.code)}
                dir="ltr"
                className="uppercase"
                placeholder="ALM-CASA"
                required
              />
            </FormField>

            <FormField
              name="name"
              label={t.school.name}
              error={errors.name}
              required
              className="sm:col-span-2"
            >
              <Input
                {...controlProps("name", errors.name)}
                defaultValue={valueOf(state, "name", school?.name)}
                required
              />
            </FormField>
          </FormGrid>

          <FormGrid cols={3}>
            <FormField name="level" label={t.school.level} error={errors.level}>
              <Select
                name="level"
                defaultValue={valueOf(state, "level", school?.level) || "GROUP"}
              >
                <SelectTrigger id="level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t.school.levels[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              name="directorName"
              label={t.school.director}
              error={errors.directorName}
            >
              <Input
                {...controlProps("directorName", errors.directorName)}
                defaultValue={valueOf(
                  state,
                  "directorName",
                  school?.directorName,
                )}
              />
            </FormField>

            <FormField
              name="capacity"
              label={t.school.capacity}
              error={errors.capacity}
            >
              <Input
                {...controlProps("capacity", errors.capacity)}
                type="number"
                min={0}
                defaultValue={valueOf(
                  state,
                  "capacity",
                  school?.capacity === null || school?.capacity === undefined
                    ? ""
                    : String(school.capacity),
                )}
                dir="ltr"
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title={t.organization.contact}>
          <FormGrid cols={3}>
            <FormField name="email" label={t.school.email} error={errors.email}>
              <Input
                {...controlProps("email", errors.email)}
                type="email"
                defaultValue={valueOf(state, "email", school?.email)}
                dir="ltr"
              />
            </FormField>

            <FormField name="phone" label={t.school.phone} error={errors.phone}>
              <Input
                {...controlProps("phone", errors.phone)}
                type="tel"
                defaultValue={valueOf(state, "phone", school?.phone)}
                dir="ltr"
              />
            </FormField>

            <FormField
              name="website"
              label={t.school.website}
              error={errors.website}
            >
              <Input
                {...controlProps("website", errors.website)}
                type="url"
                defaultValue={valueOf(state, "website", school?.website)}
                dir="ltr"
                placeholder="https://…"
              />
            </FormField>
          </FormGrid>

          <ImageField
            name="logoUrl"
            label={t.school.logoUrl}
            hint={t.school.logoHint}
            kind="logo"
            defaultValue={valueOf(state, "logoUrl", school?.logoUrl)}
            error={errors.logoUrl}
            fallback={(school?.code ?? school?.name ?? "?")
              .slice(0, 2)
              .toUpperCase()}
          />
        </FormSection>

        <FormSection title={t.organization.address}>
          <FormField
            name="addressLine"
            label={t.school.addressLine}
            error={errors.addressLine}
          >
            <Input
              {...controlProps("addressLine", errors.addressLine)}
              defaultValue={valueOf(state, "addressLine", school?.addressLine)}
            />
          </FormField>

          <FormGrid cols={4}>
            <FormField name="city" label={t.school.city} error={errors.city}>
              <Input
                {...controlProps("city", errors.city)}
                defaultValue={valueOf(state, "city", school?.city)}
              />
            </FormField>

            <FormField
              name="region"
              label={t.school.region}
              error={errors.region}
              className="lg:col-span-2"
            >
              <Input
                {...controlProps("region", errors.region)}
                defaultValue={valueOf(state, "region", school?.region)}
              />
            </FormField>

            <FormField
              name="postalCode"
              label={t.school.postalCode}
              error={errors.postalCode}
            >
              <Input
                {...controlProps("postalCode", errors.postalCode)}
                defaultValue={valueOf(state, "postalCode", school?.postalCode)}
                dir="ltr"
              />
            </FormField>
          </FormGrid>

          <input type="hidden" name="country" value={school?.country ?? "MA"} />
        </FormSection>
      </FormLayout>

      <FormActions>
        <Button asChild type="button" variant="outline" size="lg">
          <Link href="/schools">{t.common.cancel}</Link>
        </Button>
        <SubmitButton size="lg">
          {isEdit ? t.common.save : t.school.createSchool}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
