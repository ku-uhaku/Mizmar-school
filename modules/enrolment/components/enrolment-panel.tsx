"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarPlusIcon } from "lucide-react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
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
import { interpolate } from "@/lib/i18n/format";
import {
  deleteEnrolmentAction,
  enrolStudentAction,
  updateEnrolmentAction,
} from "@/modules/enrolment/actions";
import { ENROLMENT_STATUSES } from "@/modules/enrolment/enums";
import type { EnrolmentDetail } from "@/modules/enrolment/queries";

export type OfferingChoice = {
  id: string;
  label: string;
  levelName: string;
  trackName: string | null;
  classes: {
    id: string;
    code: string;
    name: string | null;
    capacity: number | null;
    enrolled: number;
    groups: { id: string; label: string }[];
  }[];
};

/**
 * Enrol a pupil, or change where they sit.
 *
 * The class list narrows as soon as a level is chosen, and each class carries
 * how full it is — seating a child in a class that is already over capacity is
 * a decision, not an accident, so the number is put where the choice is made
 * rather than behind a warning afterwards.
 */
export function EnrolmentPanel({
  studentId,
  enrolment,
  offerings,
  yearName,
  permissions,
}: {
  studentId: string;
  enrolment: EnrolmentDetail | null;
  offerings: OfferingChoice[];
  yearName: string | null;
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const isEdit = Boolean(enrolment);

  const [state, formAction] = useActionState(
    isEdit ? updateEnrolmentAction : enrolStudentAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: () => router.refresh() });

  const [offeringId, setOfferingId] = React.useState(
    enrolment?.levelOfferingId ?? offerings[0]?.id ?? "",
  );
  const [classId, setClassId] = React.useState(
    enrolment?.schoolClassId ?? "__none__",
  );
  const [deleting, setDeleting] = React.useState(false);

  const errors = state.fieldErrors ?? {};
  const offering = offerings.find((entry) => entry.id === offeringId) ?? null;
  const classes = offering?.classes ?? [];
  const groups = classes.find((entry) => entry.id === classId)?.groups ?? [];

  const canSubmit = isEdit ? permissions.canUpdate : permissions.canCreate;

  if (!yearName) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<CalendarPlusIcon className="size-5" />}
            title={t.errors.noSchoolYearContext}
          />
        </CardContent>
      </Card>
    );
  }

  if (offerings.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<CalendarPlusIcon className="size-5" />}
            title={t.enrolment.offeringUnavailable}
            description={t.enrolment.levelHint}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/configuration/classes/level-offerings">
                  {t.configuration.title}
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b">
        <div className="min-w-0">
          <CardTitle>{t.enrolment.title}</CardTitle>
          <CardDescription>
            {interpolate(t.enrolment.subtitle, { year: yearName })}
          </CardDescription>
        </div>
        {enrolment ? (
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant={enrolment.status === "ACTIVE" ? "default" : "outline"}
            >
              {
                t.enrolmentOptions.statuses[
                  enrolment.status as keyof typeof t.enrolmentOptions.statuses
                ]
              }
            </Badge>
            {permissions.canDelete ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleting(true)}
              >
                {t.common.delete}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {!enrolment && !permissions.canCreate ? (
          <EmptyState
            icon={<CalendarPlusIcon className="size-5" />}
            title={t.enrolment.notEnrolled}
            description={t.enrolment.notEnrolledHint}
          />
        ) : (
          <form action={formAction} className="grid gap-5">
            <input type="hidden" name="studentId" value={studentId} />
            {enrolment ? (
              <input type="hidden" name="id" value={enrolment.id} />
            ) : null}

            <div className="grid gap-5 sm:grid-cols-3">
              <FormField
                name="levelOfferingId"
                label={t.enrolment.level}
                hint={t.enrolment.levelHint}
                error={errors.levelOfferingId}
                required
              >
                <Select
                  name="levelOfferingId"
                  value={offeringId}
                  onValueChange={(value) => {
                    setOfferingId(value);
                    // The old class belongs to the old level; keeping it would
                    // submit a class the server will refuse.
                    setClassId("__none__");
                  }}
                >
                  <SelectTrigger id="levelOfferingId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {offerings.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label} — {entry.levelName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="schoolClassId"
                label={t.enrolment.schoolClass}
                hint={t.enrolment.classHint}
                error={errors.schoolClassId}
              >
                <Select
                  name="schoolClassId"
                  value={classId}
                  onValueChange={setClassId}
                >
                  <SelectTrigger id="schoolClassId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t.enrolment.noClass}
                    </SelectItem>
                    {classes.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.code}
                        {entry.capacity
                          ? ` · ${interpolate(t.enrolment.capacity, {
                              enrolled: entry.enrolled,
                              capacity: entry.capacity,
                            })}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="classGroupId"
                label={t.enrolment.group}
                hint={t.enrolment.groupHint}
                error={errors.classGroupId}
              >
                <Select
                  name="classGroupId"
                  defaultValue={enrolment?.classGroupId ?? "__none__"}
                  disabled={groups.length === 0}
                >
                  <SelectTrigger id="classGroupId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t.enrolment.noGroup}
                    </SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <FormField
                name="status"
                label={t.enrolment.status}
                error={errors.status}
              >
                <Select
                  name="status"
                  defaultValue={enrolment?.status ?? "ACTIVE"}
                >
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENROLMENT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t.enrolmentOptions.statuses[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="enrolledOn"
                label={t.enrolment.enrolledOn}
                error={errors.enrolledOn}
              >
                <Input
                  {...controlProps("enrolledOn", errors.enrolledOn)}
                  type="date"
                  defaultValue={enrolment?.enrolledOn ?? ""}
                  dir="ltr"
                />
              </FormField>

              <div className="flex items-center justify-between gap-4 rounded-lg border px-3">
                <Label htmlFor="isRepeating">{t.enrolment.isRepeating}</Label>
                <Switch
                  id="isRepeating"
                  name="isRepeating"
                  defaultChecked={enrolment?.isRepeating ?? false}
                />
              </div>
            </div>

            <fieldset className="grid gap-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">
                {t.enrolment.options}
              </legend>
              <p className="text-muted-foreground -mt-1 text-xs">
                {t.enrolment.optionsHint}
              </p>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="usesTransport">
                  {t.enrolment.usesTransport}
                </Label>
                <Switch
                  id="usesTransport"
                  name="usesTransport"
                  defaultChecked={enrolment?.usesTransport ?? false}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="usesCanteen">{t.enrolment.usesCanteen}</Label>
                <Switch
                  id="usesCanteen"
                  name="usesCanteen"
                  defaultChecked={enrolment?.usesCanteen ?? false}
                />
              </div>
            </fieldset>

            <FormField
              name="notes"
              label={t.enrolment.notes}
              error={errors.notes}
            >
              <Textarea
                {...controlProps("notes", errors.notes)}
                defaultValue={enrolment?.notes ?? ""}
                rows={2}
              />
            </FormField>

            {canSubmit ? (
              <div className="flex justify-end">
                <SubmitButton>
                  {isEdit ? t.common.save : t.enrolment.enrol}
                </SubmitButton>
              </div>
            ) : null}
          </form>
        )}
      </CardContent>

      {enrolment && deleting ? (
        <ConfirmDelete
          open={deleting}
          onOpenChange={setDeleting}
          title={t.enrolment.deleteTitle}
          description={t.enrolment.deleteBody}
          action={() => deleteEnrolmentAction(enrolment.id)}
          onDeleted={() => router.refresh()}
        />
      ) : null}
    </Card>
  );
}
