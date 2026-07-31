"use client";

import { useActionState } from "react";

import {
  changeOwnPasswordAction,
  updateOwnProfileAction,
} from "@/modules/profile/actions";
import { BirthDateField } from "@/components/form/birth-date-field";
import { FormField, controlProps } from "@/components/form/form-field";
import { ImageField } from "@/components/form/image-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";

export type ProfileValues = {
  firstName: string;
  lastName: string;
  phone: string | null;
  jobTitle: string | null;
  bio: string | null;
  avatarUrl: string | null;
  /** `YYYY-MM-DD`, or "" when unset. */
  birthDate: string;
  email: string;
};

export function ProfileDetailsForm({ profile }: { profile: ProfileValues }) {
  const t = useT();
  const [state, formAction] = useActionState(updateOwnProfileAction, IDLE);
  useActionFeedback(state);

  const errors = state.fieldErrors ?? {};

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle className="text-base">{t.profile.personal}</CardTitle>
          <CardDescription>{t.profile.subtitle}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="firstName"
              label={t.profile.firstName}
              error={errors.firstName}
              required
            >
              <Input
                {...controlProps("firstName", errors.firstName)}
                defaultValue={profile.firstName}
                autoComplete="given-name"
                required
              />
            </FormField>

            <FormField
              name="lastName"
              label={t.profile.lastName}
              error={errors.lastName}
              required
            >
              <Input
                {...controlProps("lastName", errors.lastName)}
                defaultValue={profile.lastName}
                autoComplete="family-name"
                required
              />
            </FormField>
          </div>

          {/* Changing your own email would change your sign-in identity, so it
              is administrator-only. */}
          <FormField
            name="emailDisplay"
            label={t.profile.email}
            hint={t.profile.emailReadonly}
          >
            <Input
              id="emailDisplay"
              value={profile.email}
              readOnly
              disabled
              dir="ltr"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="phone" label={t.profile.phone} error={errors.phone}>
              <Input
                {...controlProps("phone", errors.phone)}
                type="tel"
                defaultValue={profile.phone ?? ""}
                dir="ltr"
                autoComplete="tel"
              />
            </FormField>

            <FormField
              name="jobTitle"
              label={t.profile.jobTitle}
              error={errors.jobTitle}
            >
              <Input
                {...controlProps("jobTitle", errors.jobTitle)}
                defaultValue={profile.jobTitle ?? ""}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BirthDateField
              defaultValue={profile.birthDate}
              error={errors.birthDate}
            />
          </div>

          <ImageField
            name="avatarUrl"
            label={t.profile.avatarUrl}
            kind="avatar"
            defaultValue={profile.avatarUrl ?? ""}
            error={errors.avatarUrl}
            fallback={`${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase()}
          />

          <FormField name="bio" label={t.profile.bio} error={errors.bio}>
            <Textarea
              {...controlProps("bio", errors.bio)}
              defaultValue={profile.bio ?? ""}
              rows={3}
            />
          </FormField>
        </CardContent>

        <CardFooter>
          <SubmitButton>{t.common.save}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

export function PasswordChangeForm() {
  const t = useT();
  const [state, formAction] = useActionState(changeOwnPasswordAction, IDLE);
  useActionFeedback(state);

  const errors = state.fieldErrors ?? {};

  return (
    <Card>
      {/* `key` clears the password inputs after a successful change. */}
      <form key={state.status === "success" ? state.key : "form"} action={formAction}>
        <CardHeader>
          <CardTitle className="text-base">{t.profile.changePassword}</CardTitle>
          <CardDescription>{t.profile.security}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          <FormField
            name="currentPassword"
            label={t.profile.currentPassword}
            error={errors.currentPassword}
            required
          >
            <Input
              {...controlProps("currentPassword", errors.currentPassword)}
              type="password"
              autoComplete="current-password"
              dir="ltr"
              required
            />
          </FormField>

          <FormField
            name="newPassword"
            label={t.profile.newPassword}
            error={errors.newPassword}
            required
          >
            <Input
              {...controlProps("newPassword", errors.newPassword)}
              type="password"
              autoComplete="new-password"
              dir="ltr"
              required
            />
          </FormField>

          <FormField
            name="confirmPassword"
            label={t.profile.confirmPassword}
            error={errors.confirmPassword}
            required
          >
            <Input
              {...controlProps("confirmPassword", errors.confirmPassword)}
              type="password"
              autoComplete="new-password"
              dir="ltr"
              required
            />
          </FormField>
        </CardContent>

        <CardFooter>
          <SubmitButton>{t.profile.changePassword}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
