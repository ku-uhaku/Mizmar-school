"use client";

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
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import {
  createFamilyAction,
  updateFamilyAction,
} from "@/modules/families/actions";
import { FAMILY_SITUATIONS } from "@/modules/families/enums";
import type { FamilyDetail } from "@/modules/families/queries";

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

  const [state, formAction] = useActionState(
    isEdit ? updateFamilyAction : createFamilyAction,
    IDLE,
  );
  useActionFeedback(state, {
    onSuccess: () =>
      router.push(family ? `/families/${family.id}` : "/families"),
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
              error={errors.name}
              required
              className="sm:col-span-2"
            >
              <Input
                {...controlProps("name", errors.name)}
                defaultValue={valueOf(state, "name", family?.name)}
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
    </form>
  );
}
