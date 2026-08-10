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
import { checkedOf, valueOf } from "@/lib/form-values";
import { formatMonth, interpolate } from "@/lib/i18n/format";
import {
  deleteEnrolmentAction,
  enrolStudentAction,
  updateEnrolmentAction,
} from "@/modules/enrolment/actions";
import { ENROLMENT_STATUSES } from "@/modules/enrolment/enums";
import type {
  EnrolmentDetail,
  SubscribableCharge,
} from "@/modules/enrolment/queries";

/** A month an opt-in may start in. `value` is `YYYY-MM`. */
export type StartMonthChoice = {
  value: string;
  year: number;
  month: number;
};

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
  startMonths,
  subscribableCharges,
  yearName,
  permissions,
}: {
  studentId: string;
  enrolment: EnrolmentDetail | null;
  offerings: OfferingChoice[];
  /** Months an opt-in may start in — see `loadEnrolmentChoices`. */
  startMonths: StartMonthChoice[];
  /** The optional charges this school sells — see `listSubscribableCharges`. */
  subscribableCharges: SubscribableCharge[];
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

  /*
    The opt-ins are controlled rather than uncontrolled, unlike the switches
    above them: each one reveals a start month, and a month asked for a service
    the family has not taken is a question with no meaning.

    A set keyed by fee type, because the charges are whatever the school sells —
    this was two named booleans until a school wanted to sell a third thing.
  */
  const [taken, setTaken] = React.useState<ReadonlySet<string>>(
    () =>
      new Set(
        subscribableCharges
          .filter((charge) =>
            checkedOf(
              state,
              `option:${charge.id}`,
              enrolment?.options.some(
                (option) => option.feeTypeId === charge.id,
              ) ?? false,
            ),
          )
          .map((charge) => charge.id),
      ),
  );

  const setCharge = (feeTypeId: string, on: boolean) =>
    setTaken((held) => {
      const next = new Set(held);
      if (on) next.add(feeTypeId);
      else next.delete(feeTypeId);
      return next;
    });

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
                  defaultValue={
                    valueOf(state, "classGroupId", enrolment?.classGroupId) ||
                    "__none__"
                  }
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
                  defaultValue={
                    valueOf(state, "status", enrolment?.status) || "ACTIVE"
                  }
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
                  defaultValue={valueOf(
                    state,
                    "enrolledOn",
                    enrolment?.enrolledOn,
                  )}
                  dir="ltr"
                />
              </FormField>

              <div className="flex items-center justify-between gap-4 rounded-lg border px-3">
                <Label htmlFor="isRepeating">{t.enrolment.isRepeating}</Label>
                <Switch
                  id="isRepeating"
                  name="isRepeating"
                  defaultChecked={checkedOf(
                    state,
                    "isRepeating",
                    enrolment?.isRepeating ?? false,
                  )}
                />
              </div>
            </div>

            <fieldset className="grid gap-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">
                {t.enrolment.options}
              </legend>
              <p className="text-muted-foreground -mt-1 text-xs">
                {t.enrolment.optionsHint}
              </p>

              {subscribableCharges.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t.enrolment.noOptionalCharges}
                </p>
              ) : (
                subscribableCharges.map((charge) => (
                  <OptionRow
                    key={charge.id}
                    charge={charge}
                    checked={taken.has(charge.id)}
                    onCheckedChange={(on) => setCharge(charge.id, on)}
                    defaultStart={valueOf(
                      state,
                      `optionStart:${charge.id}`,
                      enrolment?.options.find(
                        (option) => option.feeTypeId === charge.id,
                      )?.startsOn,
                    )}
                    months={startMonths}
                  />
                ))
              )}
            </fieldset>

            <FormField
              name="notes"
              label={t.enrolment.notes}
              error={errors.notes}
            >
              <Textarea
                {...controlProps("notes", errors.notes)}
                defaultValue={valueOf(state, "notes", enrolment?.notes)}
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

/**
 * One opt-in charge: the switch, and — only once it is on — the month it starts
 * being billed from.
 *
 * The month appears on demand rather than sitting there greyed out because a
 * start date for a service the family has not taken is a question with no
 * answer, and two dead selects on a form nobody usually touches is how the two
 * that matter get missed.
 *
 * "From the start of the year" is the default and is spelled out as a choice,
 * not left as an empty select: a bursar reading the form has to be able to see
 * that the full year is what is being billed, without knowing that blank means
 * September.
 */
/**
 * One optional charge: a switch, and the month it starts being billed from.
 *
 * ── Why the three parallel fields ───────────────────────────────────────────
 * Every row posts `optionFeeTypeId`, `optionSubscribed` and `optionStartsOn`,
 * ticked or not, so the arrays stay the same length and `readOptions` can pair
 * them up by index. An unticked switch posting nothing would shift the next
 * charge's month onto the wrong line — the same trap the mark sheet and the
 * supply list avoid the same way.
 *
 * The month input is only *rendered* when the box is ticked, so its hidden
 * twin below carries the slot in that case.
 */
function OptionRow({
  charge,
  checked,
  onCheckedChange,
  defaultStart,
  months,
}: {
  charge: SubscribableCharge;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  defaultStart: string;
  months: StartMonthChoice[];
}) {
  const { t, locale } = useI18n();
  const switchId = `option-${charge.id}`;
  const startId = `optionStart-${charge.id}`;

  return (
    <div className="rounded-md border px-3 py-2.5">
      <input type="hidden" name="optionFeeTypeId" value={charge.id} />
      <input
        type="hidden"
        name="optionSubscribed"
        value={checked ? "1" : "0"}
      />

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={switchId} className="font-normal">
          {charge.name}
        </Label>
        <Switch
          id={switchId}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>

      {checked && months.length > 0 ? (
        <div className="mt-3 grid gap-1.5 border-t pt-3">
          <Label htmlFor={startId} className="text-muted-foreground text-xs">
            {t.enrolment.optionStartsOn}
          </Label>
          <Select name="optionStartsOn" defaultValue={defaultStart || "__none__"}>
            <SelectTrigger id={startId} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                {t.enrolment.optionStartsWithYear}
              </SelectItem>
              {months.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {formatMonth(entry.year, entry.month, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {t.enrolment.optionStartsOnHint}
          </p>
        </div>
      ) : (
        /* The row's slot in the `optionStartsOn` array, kept filled while the
           picker is hidden. Without it the arrays fall out of step the moment
           one charge is unticked. */
        <input type="hidden" name="optionStartsOn" value="" />
      )}
    </div>
  );
}
