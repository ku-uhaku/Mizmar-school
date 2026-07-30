"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockIcon } from "lucide-react";

import { createRoleAction, updateRoleAction } from "@/modules/access/actions";
import { FormField, controlProps } from "@/components/form/form-field";
import { FormActions, FormLayout, FormSection } from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { PermissionMatrix } from "@/modules/access/components/permission-matrix";
import type { RoleRow } from "@/modules/access/components/roles-manager";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { ROLE_SCOPES } from "@/modules/access/enums";
import { interpolate } from "@/lib/i18n/format";

export function RoleForm({
  role,
  readOnly,
}: {
  role?: RoleRow;
  /** View mode for users who may see roles but not edit them. */
  readOnly?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const isEdit = Boolean(role);
  // Narrowed so the system role's own name/scope are readable below.
  const systemRole = role?.isSystem ? role : null;

  const [state, formAction] = useActionState(
    isEdit ? updateRoleAction : createRoleAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: () => router.push("/roles") });

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {role ? <input type="hidden" name="id" value={role.id} /> : null}

      <FormLayout
        aside={
          <Card>
            <CardHeader>
              <CardTitle>{t.role.scope}</CardTitle>
              <CardDescription>{t.role.scopeHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <FormField name="scope" label={t.role.scope} error={errors.scope}>
                {systemRole ? (
                  <>
                    <Input
                      value={
                        t.role.scopes[
                          systemRole.scope as keyof typeof t.role.scopes
                        ]
                      }
                      readOnly
                      disabled
                    />
                    <input type="hidden" name="scope" value={systemRole.scope} />
                  </>
                ) : (
                  <Select
                    name="scope"
                    defaultValue={role?.scope ?? "SCHOOL"}
                    disabled={readOnly}
                  >
                    <SelectTrigger id="scope" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_SCOPES.map((scope) => (
                        <SelectItem key={scope} value={scope}>
                          {t.role.scopes[scope]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              {systemRole ? (
                <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-xs">
                  <LockIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span>{t.role.systemRoleHint}</span>
                </div>
              ) : null}

              {isEdit && role ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{t.role.usedBy}</span>
                  <span className="tabular-nums">
                    {interpolate(t.role.usedByCount, {
                      count: role.assignedCount,
                    })}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        }
      >
        <FormSection title={t.organization.general}>
          <FormField
            name="name"
            label={t.role.name}
            error={errors.name}
            required
          >
            <Input
              {...controlProps("name", errors.name)}
              defaultValue={role?.name ?? ""}
              // A system role's name is part of its identity — the seed looks it
              // up by name to repair permissions.
              readOnly={Boolean(systemRole)}
              disabled={readOnly}
              required
            />
          </FormField>

          <FormField
            name="description"
            label={t.role.description}
            error={errors.description}
          >
            <Textarea
              {...controlProps("description", errors.description)}
              defaultValue={role?.description ?? ""}
              rows={3}
              disabled={readOnly}
            />
          </FormField>
        </FormSection>

        <FormSection
          title={t.role.permissions}
          description={t.role.permissionsDescription}
          className="gap-4"
        >
          <PermissionMatrix
            defaultSelected={role?.permissions ?? []}
            disabled={readOnly}
          />
        </FormSection>
      </FormLayout>

      <FormActions>
        <Button asChild type="button" variant="outline" size="lg">
          <Link href="/roles">{readOnly ? t.common.back : t.common.cancel}</Link>
        </Button>
        {!readOnly ? (
          <SubmitButton size="lg">
            {isEdit ? t.common.save : t.role.createRole}
          </SubmitButton>
        ) : null}
      </FormActions>
    </form>
  );
}
