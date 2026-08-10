"use client";

import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { ImageField } from "@/components/form/image-field";
import { FormGrid } from "@/components/form/form-page";
import { useT } from "@/components/providers/i18n-provider";
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
import type { ActionState } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import { SCHOOL_LEVELS } from "@/modules/schools/enums";

/**
 * The school itself.
 *
 * Deliberately the same field names `createSchoolAction` reads, so the identity
 * half of the wizard goes through `schoolSchema` unprefixed and a message comes
 * back on the key the field is rendered with.
 */
export function IdentityStep({
  state,
  errors,
}: {
  state: ActionState;
  errors: Record<string, string>;
}) {
  const t = useT();

  return (
    <div className="grid gap-5">
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
            defaultValue={valueOf(state, "code", null)}
            dir="ltr"
            className="uppercase"
            placeholder="ALM-CASA"
            required
          />
        </FormField>

        <FormField name="name" label={t.school.name} error={errors.name} required className="sm:col-span-2">
          <Input
            {...controlProps("name", errors.name)}
            defaultValue={valueOf(state, "name", null)}
            required
          />
        </FormField>

        <FormField name="level" label={t.school.level} error={errors.level}>
          <Select name="level" defaultValue={valueOf(state, "level", null) || "GROUP"}>
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

        <FormField name="massarCode" label="MASSAR" error={errors.massarCode}>
          <Input
            {...controlProps("massarCode", errors.massarCode)}
            defaultValue={valueOf(state, "massarCode", null)}
            dir="ltr"
          />
        </FormField>

        <FormField name="directorName" label={t.school.director} error={errors.directorName}>
          <Input
            {...controlProps("directorName", errors.directorName)}
            defaultValue={valueOf(state, "directorName", null)}
          />
        </FormField>

        <FormField name="email" label={t.school.email} error={errors.email}>
          <Input
            {...controlProps("email", errors.email)}
            type="email"
            dir="ltr"
            defaultValue={valueOf(state, "email", null)}
          />
        </FormField>

        <FormField name="phone" label={t.school.phone} error={errors.phone}>
          <Input
            {...controlProps("phone", errors.phone)}
            dir="ltr"
            defaultValue={valueOf(state, "phone", null)}
          />
        </FormField>

        <FormField name="capacity" label={t.school.capacity} error={errors.capacity}>
          <Input
            {...controlProps("capacity", errors.capacity)}
            type="number"
            min={0}
            defaultValue={valueOf(state, "capacity", null)}
          />
        </FormField>

        <FormField name="addressLine" label={t.school.addressLine} error={errors.addressLine} className="sm:col-span-2">
          <Input
            {...controlProps("addressLine", errors.addressLine)}
            defaultValue={valueOf(state, "addressLine", null)}
          />
        </FormField>

        <FormField name="city" label={t.school.city} error={errors.city}>
          <Input
            {...controlProps("city", errors.city)}
            defaultValue={valueOf(state, "city", null)}
          />
        </FormField>

        <FormField name="region" label={t.school.region} error={errors.region}>
          <Input
            {...controlProps("region", errors.region)}
            defaultValue={valueOf(state, "region", null)}
          />
        </FormField>

        <FormField name="postalCode" label={t.school.postalCode} error={errors.postalCode}>
          <Input
            {...controlProps("postalCode", errors.postalCode)}
            dir="ltr"
            defaultValue={valueOf(state, "postalCode", null)}
          />
        </FormField>

        <FormField name="website" label={t.school.website} error={errors.website}>
          <Input
            {...controlProps("website", errors.website)}
            dir="ltr"
            defaultValue={valueOf(state, "website", null)}
          />
        </FormField>
      </FormGrid>

      <ImageField
        name="logoUrl"
        label={t.school.logoUrl}
        hint={t.school.logoHint}
        kind="logo"
        defaultValue={valueOf(state, "logoUrl", null)}
        error={errors.logoUrl}
        fallback={(valueOf(state, "code", null) || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="isActive">{t.common.active}</Label>
          <p className="text-muted-foreground text-xs">{t.school.statusDescription}</p>
        </div>
        <Switch id="isActive" name="isActive" defaultChecked={checkedOf(state, "isActive", true)} />
      </div>

      {/* Morocco unless somebody asks otherwise, exactly as the school form. */}
      <input type="hidden" name="country" value="MA" />
    </div>
  );
}
