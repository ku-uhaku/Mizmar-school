"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createUserAction, updateUserAction } from "@/modules/users/actions";
import { AvatarUrlField } from "@/components/form/avatar-url-field";
import { BirthDateField } from "@/components/form/birth-date-field";
import { FormField, controlProps } from "@/components/form/form-field";
import { FormActions, FormGrid, FormLayout, FormSection } from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  MembershipEditor,
  type RoleChoice,
  type SchoolChoice,
} from "@/modules/users/components/membership-editor";
import type { UserRow } from "@/modules/users/components/users-manager";
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
import { formatDateTime } from "@/lib/i18n/format";

export function UserForm({
  user,
  schools,
  orgRoles,
  schoolRoles,
  canManageSuperAdmin,
  canAssignOrgRole,
}: {
  user?: UserRow;
  schools: SchoolChoice[];
  orgRoles: RoleChoice[];
  schoolRoles: RoleChoice[];
  canManageSuperAdmin: boolean;
  canAssignOrgRole: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const isEdit = Boolean(user);

  const [state, formAction] = useActionState(
    isEdit ? updateUserAction : createUserAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: () => router.push("/users") });

  const errors = state.fieldErrors ?? {};

  const defaultMemberships = Object.fromEntries(
    (user?.memberships ?? []).map((m) => [m.schoolId, m.roleId]),
  );

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`
    .toUpperCase()
    .trim();

  return (
    <form action={formAction}>
      {user ? <input type="hidden" name="id" value={user.id} /> : null}

      <FormLayout
        aside={
          <Card>
            <CardHeader>
              <CardTitle>{t.profile.access}</CardTitle>
              <CardDescription>{t.user.orgRoleHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              {/* Only shown to actors with org-wide grant authority. The action
                  drops the field for everyone else, so rendering it otherwise
                  would be a control that silently does nothing. */}
              {canAssignOrgRole ? (
                <FormField
                  name="orgRoleId"
                  label={t.user.orgRole}
                  error={errors.orgRoleId}
                >
                  <Select name="orgRoleId" defaultValue={user?.orgRoleId ?? "none"}>
                    <SelectTrigger id="orgRoleId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.common.none}</SelectItem>
                      {orgRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}

              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">{t.user.active}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.common.active} / {t.common.inactive}
                  </p>
                </div>
                <Switch
                  id="isActive"
                  name="isActive"
                  defaultChecked={user?.isActive ?? true}
                />
              </div>

              {canManageSuperAdmin ? (
                <div className="border-destructive/30 flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="isSuperAdmin">{t.user.superAdmin}</Label>
                    <p className="text-muted-foreground text-xs">
                      {t.user.superAdminHint}
                    </p>
                  </div>
                  <Switch
                    id="isSuperAdmin"
                    name="isSuperAdmin"
                    defaultChecked={user?.isSuperAdmin ?? false}
                  />
                </div>
              ) : null}

              {isEdit && user ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {t.user.lastLogin}
                  </span>
                  <span>
                    {user.lastLoginAt
                      ? formatDateTime(user.lastLoginAt, locale)
                      : t.user.never}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        }
      >
        <FormSection title={t.profile.personal}>
          <FormGrid>
            <FormField
              name="firstName"
              label={t.user.firstName}
              error={errors.firstName}
              required
            >
              <Input
                {...controlProps("firstName", errors.firstName)}
                defaultValue={user?.firstName ?? ""}
                autoComplete="given-name"
                required
              />
            </FormField>

            <FormField
              name="lastName"
              label={t.user.lastName}
              error={errors.lastName}
              required
            >
              <Input
                {...controlProps("lastName", errors.lastName)}
                defaultValue={user?.lastName ?? ""}
                autoComplete="family-name"
                required
              />
            </FormField>
          </FormGrid>

          <FormGrid>
            <FormField name="phone" label={t.user.phone} error={errors.phone}>
              <Input
                {...controlProps("phone", errors.phone)}
                type="tel"
                defaultValue={user?.phone ?? ""}
                dir="ltr"
              />
            </FormField>

            <FormField
              name="jobTitle"
              label={t.user.jobTitle}
              error={errors.jobTitle}
            >
              <Input
                {...controlProps("jobTitle", errors.jobTitle)}
                defaultValue={user?.jobTitle ?? ""}
              />
            </FormField>
          </FormGrid>

          <FormGrid>
            <BirthDateField
              defaultValue={user?.birthDate ?? ""}
              error={errors.birthDate}
            />

            <AvatarUrlField
              defaultValue={user?.avatarUrl ?? ""}
              error={errors.avatarUrl}
              fallback={initials}
            />
          </FormGrid>
        </FormSection>

        <FormSection title={t.profile.security}>
          <FormGrid>
            <FormField
              name="email"
              label={t.user.email}
              error={errors.email}
              required
            >
              <Input
                {...controlProps("email", errors.email)}
                type="email"
                defaultValue={user?.email ?? ""}
                dir="ltr"
                autoComplete="off"
                required
              />
            </FormField>

            <FormField
              name="password"
              label={t.user.password}
              hint={isEdit ? t.user.passwordEditHint : t.user.passwordHint}
              error={errors.password}
              required={!isEdit}
            >
              <Input
                {...controlProps(
                  "password",
                  errors.password,
                  isEdit ? t.user.passwordEditHint : t.user.passwordHint,
                )}
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required={!isEdit}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection
          title={t.user.schoolAccess}
          description={t.user.schoolAccessHint}
        >
          <MembershipEditor
            schools={schools}
            roles={schoolRoles}
            defaultValue={defaultMemberships}
          />
        </FormSection>
      </FormLayout>

      <FormActions>
        <Button asChild type="button" variant="outline" size="lg">
          <Link href="/users">{t.common.cancel}</Link>
        </Button>
        <SubmitButton size="lg">
          {isEdit ? t.common.save : t.user.createUser}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
