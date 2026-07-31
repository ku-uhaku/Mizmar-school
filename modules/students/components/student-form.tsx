"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDownIcon, InfoIcon } from "lucide-react";

import { FormField, controlProps } from "@/components/form/form-field";
import {
  FormActions,
  FormGrid,
  FormLayout,
  FormSection,
} from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ageFrom, cn } from "@/lib/utils";
import { formatNumber } from "@/lib/i18n/format";
import {
  createStudentAction,
  updateStudentAction,
} from "@/modules/students/actions";
import { GENDERS } from "@/modules/students/enums";
import type { StudentDetail } from "@/modules/students/queries";

/**
 * A pupil's identity. Nothing about a year is here — the level, the class and
 * the fees are set by enrolment, which is a different screen because it is a
 * different decision made by a different person at a different time.
 *
 * ── Creating and editing are not the same form ────────────────────────────────
 * Opening a file happens at a desk with a parent waiting, and four facts are
 * genuinely required: a name, a sex, a date of birth, and eventually a family.
 * Everything else — the MASSAR code, the CNIE, the place of birth, the medical
 * note — is filled in later, from paperwork, by somebody else.
 *
 * So creating shows those four and folds the rest away; editing, on the profile,
 * shows everything open. Same fields, same action, same validation — only the
 * emphasis differs, because a form that asks for fifteen things to record a
 * six-year-old is a form people work around.
 */
export function StudentForm({
  student,
  families,
}: {
  student?: StudentDetail;
  /** Dossiers to attach to. Empty until the school has opened one. */
  families: { id: string; label: string }[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const isEdit = Boolean(student);

  const [state, formAction] = useActionState(
    isEdit ? updateStudentAction : createStudentAction,
    IDLE,
  );
  // Creating redirects to the new file from the action itself, so only the edit
  // case needs to be sent anywhere.
  useActionFeedback(state, {
    onSuccess: () => {
      if (student) router.refresh();
    },
  });

  const errors = state.fieldErrors ?? {};
  const age = student ? ageFrom(student.birthDate) : null;

  // A field the server complained about must not stay hidden behind a fold.
  const detailFields = [
    "code",
    "massarCode",
    "nationality",
    "nationalId",
    "photoUrl",
    "birthPlace",
    "birthPlaceAr",
    "firstNameAr",
    "lastNameAr",
    "entryDate",
    "medicalNotes",
    "notes",
  ];
  // A validation error the user cannot see is a dead end, so an error on a
  // folded-away field forces the panel open rather than waiting to be asked.
  const hasHiddenError = detailFields.some((name) => name in errors);
  const [expanded, setExpanded] = React.useState(isEdit);
  const showDetails = expanded || hasHiddenError;

  const details = (
    <>
      <FormSection title={t.student.names}>
        <FormGrid cols={2}>
          <FormField
            name="firstNameAr"
            label={t.student.firstNameAr}
            error={errors.firstNameAr}
          >
            <Input
              {...controlProps("firstNameAr", errors.firstNameAr)}
              defaultValue={student?.firstNameAr ?? ""}
              dir="rtl"
            />
          </FormField>

          <FormField
            name="lastNameAr"
            label={t.student.lastNameAr}
            error={errors.lastNameAr}
          >
            <Input
              {...controlProps("lastNameAr", errors.lastNameAr)}
              defaultValue={student?.lastNameAr ?? ""}
              dir="rtl"
            />
          </FormField>
        </FormGrid>

        <FormGrid cols={2}>
          <FormField
            name="birthPlace"
            label={t.student.birthPlace}
            error={errors.birthPlace}
          >
            <Input
              {...controlProps("birthPlace", errors.birthPlace)}
              defaultValue={student?.birthPlace ?? ""}
            />
          </FormField>

          <FormField
            name="birthPlaceAr"
            label={t.student.birthPlaceAr}
            error={errors.birthPlaceAr}
          >
            <Input
              {...controlProps("birthPlaceAr", errors.birthPlaceAr)}
              defaultValue={student?.birthPlaceAr ?? ""}
              dir="rtl"
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        title={t.student.references}
        description={t.student.referencesHint}
      >
        <FormGrid cols={2}>
          <FormField
            name="code"
            label={t.student.code}
            hint={t.student.codeHint}
            error={errors.code}
          >
            <Input
              {...controlProps("code", errors.code, t.student.codeHint)}
              defaultValue={student?.code ?? ""}
              dir="ltr"
              placeholder="E-2025-0431"
            />
          </FormField>

          <FormField
            name="massarCode"
            label={t.student.massarCode}
            hint={t.student.massarCodeHint}
            error={errors.massarCode}
          >
            <Input
              {...controlProps(
                "massarCode",
                errors.massarCode,
                t.student.massarCodeHint,
              )}
              defaultValue={student?.massarCode ?? ""}
              dir="ltr"
              className="uppercase"
            />
          </FormField>
        </FormGrid>

        <FormGrid cols={3}>
          <FormField
            name="nationality"
            label={t.student.nationality}
            error={errors.nationality}
          >
            <Input
              {...controlProps("nationality", errors.nationality)}
              defaultValue={student?.nationality ?? "MA"}
              dir="ltr"
              maxLength={2}
              className="uppercase"
            />
          </FormField>

          <FormField
            name="nationalId"
            label={t.student.nationalId}
            hint={t.student.nationalIdHint}
            error={errors.nationalId}
          >
            <Input
              {...controlProps(
                "nationalId",
                errors.nationalId,
                t.student.nationalIdHint,
              )}
              defaultValue={student?.nationalId ?? ""}
              dir="ltr"
              className="uppercase"
            />
          </FormField>

          <FormField
            name="entryDate"
            label={t.student.entryDate}
            error={errors.entryDate}
          >
            <Input
              {...controlProps("entryDate", errors.entryDate)}
              type="date"
              defaultValue={student?.entryDate ?? ""}
              dir="ltr"
            />
          </FormField>
        </FormGrid>

        <FormField
          name="photoUrl"
          label={t.student.photoUrl}
          error={errors.photoUrl}
        >
          <Input
            {...controlProps("photoUrl", errors.photoUrl)}
            type="url"
            defaultValue={student?.photoUrl ?? ""}
            dir="ltr"
            placeholder="https://…"
          />
        </FormField>
      </FormSection>

      <FormSection title={t.student.medical}>
        <FormField
          name="medicalNotes"
          label={t.student.medicalNotes}
          hint={t.student.medicalNotesHint}
          error={errors.medicalNotes}
        >
          <Textarea
            {...controlProps(
              "medicalNotes",
              errors.medicalNotes,
              t.student.medicalNotesHint,
            )}
            defaultValue={student?.medicalNotes ?? ""}
            rows={3}
          />
        </FormField>

        <FormField name="notes" label={t.student.notes} error={errors.notes}>
          <Textarea
            {...controlProps("notes", errors.notes)}
            defaultValue={student?.notes ?? ""}
            rows={3}
          />
        </FormField>
      </FormSection>
    </>
  );

  return (
    <form action={formAction}>
      {student ? <input type="hidden" name="id" value={student.id} /> : null}

      <FormLayout
        aside={
          <Card>
            <CardHeader>
              <CardTitle>{t.student.family}</CardTitle>
              <CardDescription>{t.student.familyHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <FormField
                name="familyId"
                label={t.student.family}
                error={errors.familyId}
              >
                <Select
                  name="familyId"
                  defaultValue={student?.familyId ?? "__none__"}
                >
                  <SelectTrigger id="familyId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.common.none}</SelectItem>
                    {families.map((family) => (
                      <SelectItem key={family.id} value={family.id}>
                        {family.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {!isEdit ? (
                <p className="text-muted-foreground text-xs text-pretty">
                  {t.student.familyLater}
                </p>
              ) : null}

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
                  defaultChecked={student?.isActive ?? true}
                />
              </div>

              {age !== null ? (
                <dl className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{t.student.age}</dt>
                    <dd className="tabular-nums">{formatNumber(age, locale)}</dd>
                  </div>
                </dl>
              ) : null}
            </CardContent>
          </Card>
        }
      >
        <FormSection
          title={t.student.essentials}
          description={isEdit ? undefined : t.student.essentialsHint}
        >
          <FormGrid cols={2}>
            <FormField
              name="firstName"
              label={t.student.firstName}
              error={errors.firstName}
              required
            >
              <Input
                {...controlProps("firstName", errors.firstName)}
                defaultValue={student?.firstName ?? ""}
                autoFocus={!isEdit}
                required
              />
            </FormField>

            <FormField
              name="lastName"
              label={t.student.lastName}
              error={errors.lastName}
              required
            >
              <Input
                {...controlProps("lastName", errors.lastName)}
                defaultValue={student?.lastName ?? ""}
                required
              />
            </FormField>
          </FormGrid>

          <FormGrid cols={2}>
            <FormField
              name="gender"
              label={t.student.gender}
              error={errors.gender}
              required
            >
              <Select name="gender" defaultValue={student?.gender ?? "MALE"}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((gender) => (
                    <SelectItem key={gender} value={gender}>
                      {t.studentOptions.genders[gender]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              name="birthDate"
              label={t.student.birthDate}
              hint={t.student.birthDateHint}
              error={errors.birthDate}
              required
            >
              <Input
                {...controlProps(
                  "birthDate",
                  errors.birthDate,
                  t.student.birthDateHint,
                )}
                type="date"
                defaultValue={student?.birthDate ?? ""}
                dir="ltr"
                required
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Editing shows everything; creating folds it away until asked for. */}
        {isEdit ? (
          details
        ) : (
          <Collapsible open={showDetails} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <InfoIcon className="size-4" />
                  {t.student.moreDetails}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-4 transition-transform",
                    showDetails && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-5 pt-5">
              <p className="text-muted-foreground text-xs text-pretty">
                {t.student.moreDetailsHint}
              </p>
              {details}
            </CollapsibleContent>
          </Collapsible>
        )}
      </FormLayout>

      <FormActions hint={isEdit ? undefined : t.student.createHint}>
        <Button asChild type="button" variant="outline" size="lg">
          <Link href={student ? `/students/${student.id}` : "/students"}>
            {t.common.cancel}
          </Link>
        </Button>
        <SubmitButton size="lg">
          {isEdit ? t.common.save : t.student.createStudent}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
