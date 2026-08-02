"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { FormField, controlProps } from "@/components/form/form-field";
import { FormNav, type FormNavItem } from "@/components/form/form-nav";
import { ImageField } from "@/components/form/image-field";
import {
  FormActions,
  FormGrid,
  FormLayout,
  FormSection,
} from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Combobox } from "@/components/form/combobox";
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
import type { Dictionary } from "@/lib/i18n/types";
import { ageFrom } from "@/lib/utils";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import {
  createStudentAction,
  updateStudentAction,
} from "@/modules/students/actions";
import {
  BLOOD_TYPES,
  GENDERS,
  LIVES_WITH,
  SCHOOLING_TYPES,
  siblingCountOf,
} from "@/modules/students/enums";
import type { StudentDetail } from "@/modules/students/queries";

/**
 * The fiche's table of contents, in the order the sections are rendered in.
 * Kept beside the form rather than in `enums.ts` — these are the ids of this
 * screen's own anchors, not a domain value anything else may read.
 */
const SECTIONS = (t: Dictionary): FormNavItem[] => [
  { id: "section-essentials", label: t.student.essentials },
  { id: "section-names", label: t.student.names },
  { id: "section-references", label: t.student.references },
  { id: "section-medical", label: t.student.medical },
  { id: "section-schooling", label: t.student.schooling },
  { id: "section-household", label: t.student.household },
  { id: "section-notes", label: t.student.notes },
];

/**
 * A pupil's identity. Nothing about a year is here — the level, the class and
 * the fees are set by enrolment, which is a different screen because it is a
 * different decision made by a different person at a different time.
 *
 * ── Everything at once ────────────────────────────────────────────────────────
 * Creating used to fold all but four fields behind an "add more details"
 * button. It went, because the fiche d'inscription a parent hands over at the
 * desk is filled in top to bottom in one sitting — santé, scolarité antérieure,
 * fratrie and all — and a secretary copying it out cannot see what to type next
 * when it is hidden behind a disclosure. Only `firstName`, `lastName`, `gender`
 * and `birthDate` are required; the length of the form is not a demand.
 *
 * Creating and editing therefore render identically — same sections, same
 * action, same validation — and the only difference left is the wording of the
 * submit button.
 */
export function StudentForm({
  student,
  families,
  cities,
  neighbourhoods,
}: {
  student?: StudentDetail;
  /** Dossiers to attach to. Empty until the school has opened one. */
  families: { id: string; label: string }[];
  /** The school's towns, for the birthplace — see modules/geography. */
  cities: { id: string; label: string }[];
  /** The school's quartiers, for the address — same list, same module. */
  neighbourhoods: { id: string; label: string }[];
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

  // The three identity fields are mirrored into state so the aside can show the
  // child taking shape as the fiche is copied out — a date of birth that reads
  // back as "47 years" is caught at the desk rather than at the next enrolment.
  // The inputs stay uncontrolled; this only watches them.
  const [firstName, setFirstName] = React.useState(
    valueOf(state, "firstName", student?.firstName),
  );
  const [lastName, setLastName] = React.useState(
    valueOf(state, "lastName", student?.lastName),
  );
  const [birthDate, setBirthDate] = React.useState(
    valueOf(state, "birthDate", student?.birthDate),
  );
  const age = ageFrom(birthDate);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "—";

  // Held in state only so the fratrie total updates as the counts are typed —
  // the total is never submitted, and never stored. See `siblingCountOf`.
  const [brotherCount, setBrotherCount] = React.useState(
    student?.brotherCount === null || student?.brotherCount === undefined
      ? ""
      : String(student.brotherCount),
  );
  const [sisterCount, setSisterCount] = React.useState(
    student?.sisterCount === null || student?.sisterCount === undefined
      ? ""
      : String(student.sisterCount),
  );
  const siblingCount = siblingCountOf({
    brotherCount: brotherCount === "" ? null : Number(brotherCount),
    sisterCount: sisterCount === "" ? null : Number(sisterCount),
  });

  const details = (
    <>
      <FormSection id="section-names" title={t.student.names}>
        <FormGrid cols={2}>
          <FormField
            name="firstNameAr"
            label={t.student.firstNameAr}
            error={errors.firstNameAr}
          >
            <Input
              {...controlProps("firstNameAr", errors.firstNameAr)}
              defaultValue={valueOf(state, "firstNameAr", student?.firstNameAr)}
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
              defaultValue={valueOf(state, "lastNameAr", student?.lastNameAr)}
              dir="rtl"
            />
          </FormField>
        </FormGrid>

        <FormGrid cols={2}>
          {/* One picker, not two boxes: the town's French and Arabic spellings
            are agreed once under /configuration, so a certificat de scolarité
            cannot print two different names for the same place. */}
          <FormField
            name="birthCityId"
            label={t.student.birthPlace}
            hint={cities.length === 0 ? t.student.noCities : undefined}
            error={errors.birthCityId}
          >
            <Select
              name="birthCityId"
              defaultValue={
                valueOf(state, "birthCityId", student?.birthCityId) || "__none__"
              }
            >
              <SelectTrigger id="birthCityId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Asked here, of every child, rather than on the transport tab:
            the quartier is part of the address a secretary is already copying
            off the admission form, it is true of walkers as much as riders, and
            asking for it once is what lets the bus screen open on the right
            circuit instead of asking again. */}
          <FormField
            name="neighbourhoodId"
            label={t.student.neighbourhood}
            hint={
              neighbourhoods.length === 0
                ? t.student.noNeighbourhoods
                : t.student.neighbourhoodHint
            }
            error={errors.neighbourhoodId}
          >
            <Select
              name="neighbourhoodId"
              defaultValue={
                valueOf(state, "neighbourhoodId", student?.neighbourhoodId) ||
                "__none__"
              }
            >
              <SelectTrigger id="neighbourhoodId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {neighbourhoods.map((neighbourhood) => (
                  <SelectItem key={neighbourhood.id} value={neighbourhood.id}>
                    {neighbourhood.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        id="section-references"
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
              defaultValue={valueOf(state, "code", student?.code)}
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
              defaultValue={valueOf(state, "massarCode", student?.massarCode)}
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
              defaultValue={
                valueOf(state, "nationality", student?.nationality) || "MA"
              }
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
              defaultValue={valueOf(state, "nationalId", student?.nationalId)}
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
              defaultValue={valueOf(state, "entryDate", student?.entryDate)}
              dir="ltr"
            />
          </FormField>
        </FormGrid>

        <ImageField
          name="photoUrl"
          label={t.student.photoUrl}
          kind="avatar"
          defaultValue={valueOf(state, "photoUrl", student?.photoUrl)}
          error={errors.photoUrl}
          fallback={`${student?.firstName?.[0] ?? ""}${student?.lastName?.[0] ?? ""}`.toUpperCase()}
        />
      </FormSection>

      <FormSection
        id="section-medical"
        title={t.student.medical}
        description={t.student.medicalHint}
      >
        <FormGrid cols={3}>
          <FormField
            name="bloodType"
            label={t.student.bloodType}
            error={errors.bloodType}
          >
            <Select
              name="bloodType"
              defaultValue={
                valueOf(state, "bloodType", student?.bloodType) || "__none__"
              }
            >
              <SelectTrigger id="bloodType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {/* Rendered as written, not through the dictionary — see the
                  note on BLOOD_TYPES. */}
                {BLOOD_TYPES.map((bloodType) => (
                  <SelectItem key={bloodType} value={bloodType} dir="ltr">
                    {bloodType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            name="doctorName"
            label={t.student.doctorName}
            error={errors.doctorName}
          >
            <Input
              {...controlProps("doctorName", errors.doctorName)}
              defaultValue={valueOf(state, "doctorName", student?.doctorName)}
            />
          </FormField>

          <FormField
            name="doctorPhone"
            label={t.student.doctorPhone}
            error={errors.doctorPhone}
          >
            <Input
              {...controlProps("doctorPhone", errors.doctorPhone)}
              type="tel"
              defaultValue={valueOf(state, "doctorPhone", student?.doctorPhone)}
              dir="ltr"
            />
          </FormField>
        </FormGrid>

        <FormGrid cols={2}>
          <FormField
            name="allergies"
            label={t.student.allergies}
            hint={t.student.allergiesHint}
            error={errors.allergies}
          >
            <Textarea
              {...controlProps(
                "allergies",
                errors.allergies,
                t.student.allergiesHint,
              )}
              defaultValue={valueOf(state, "allergies", student?.allergies)}
              rows={2}
            />
          </FormField>

          <FormField
            name="chronicCondition"
            label={t.student.chronicCondition}
            hint={t.student.chronicConditionHint}
            error={errors.chronicCondition}
          >
            <Textarea
              {...controlProps(
                "chronicCondition",
                errors.chronicCondition,
                t.student.chronicConditionHint,
              )}
              defaultValue={valueOf(
                state,
                "chronicCondition",
                student?.chronicCondition,
              )}
              rows={2}
            />
          </FormField>
        </FormGrid>

        <FormGrid cols={2}>
          <FormField
            name="medications"
            label={t.student.medications}
            hint={t.student.medicationsHint}
            error={errors.medications}
          >
            <Textarea
              {...controlProps(
                "medications",
                errors.medications,
                t.student.medicationsHint,
              )}
              defaultValue={valueOf(state, "medications", student?.medications)}
              rows={2}
            />
          </FormField>

          <FormField
            name="insurer"
            label={t.student.insurer}
            hint={t.student.insurerHint}
            error={errors.insurer}
          >
            <Input
              {...controlProps(
                "insurer",
                errors.insurer,
                t.student.insurerHint,
              )}
              defaultValue={valueOf(state, "insurer", student?.insurer)}
            />
          </FormField>
        </FormGrid>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="hasDisability">{t.student.hasDisability}</Label>
            <p className="text-muted-foreground text-xs text-pretty">
              {t.student.hasDisabilityHint}
            </p>
          </div>
          <Switch
            id="hasDisability"
            name="hasDisability"
            defaultChecked={checkedOf(
              state,
              "hasDisability",
              student?.hasDisability ?? false,
            )}
          />
        </div>

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
            defaultValue={valueOf(state, "medicalNotes", student?.medicalNotes)}
            rows={3}
          />
        </FormField>
      </FormSection>

      <FormSection
        id="section-schooling"
        title={t.student.schooling}
        description={t.student.schoolingHint}
      >
        <FormGrid cols={2}>
          <FormField
            name="previousSchool"
            label={t.student.previousSchool}
            error={errors.previousSchool}
          >
            <Input
              {...controlProps("previousSchool", errors.previousSchool)}
              defaultValue={valueOf(
                state,
                "previousSchool",
                student?.previousSchool,
              )}
            />
          </FormField>

          <FormField
            name="previousSchoolCityId"
            label={t.student.previousSchoolCity}
            error={errors.previousSchoolCityId}
          >
            <Select
              name="previousSchoolCityId"
              defaultValue={
                valueOf(
                  state,
                  "previousSchoolCityId",
                  student?.previousSchoolCityId,
                ) || "__none__"
              }
            >
              <SelectTrigger id="previousSchoolCityId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid cols={2}>
          <FormField
            name="previousLevel"
            label={t.student.previousLevel}
            hint={t.student.previousLevelHint}
            error={errors.previousLevel}
          >
            <Input
              {...controlProps(
                "previousLevel",
                errors.previousLevel,
                t.student.previousLevelHint,
              )}
              defaultValue={valueOf(
                state,
                "previousLevel",
                student?.previousLevel,
              )}
            />
          </FormField>

          <FormField
            name="schoolingType"
            label={t.student.schoolingType}
            error={errors.schoolingType}
          >
            <Select
              name="schoolingType"
              defaultValue={
                valueOf(state, "schoolingType", student?.schoolingType) ||
                "__none__"
              }
            >
              <SelectTrigger id="schoolingType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {SCHOOLING_TYPES.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t.studentOptions.schoolingTypes[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>

        <FormField
          name="transferReason"
          label={t.student.transferReason}
          error={errors.transferReason}
        >
          <Textarea
            {...controlProps("transferReason", errors.transferReason)}
            defaultValue={valueOf(
              state,
              "transferReason",
              student?.transferReason,
            )}
            rows={2}
          />
        </FormField>
      </FormSection>

      <FormSection
        id="section-household"
        title={t.student.household}
        description={t.student.householdHint}
      >
        <FormGrid cols={3}>
          <FormField
            name="brotherCount"
            label={t.student.brotherCount}
            error={errors.brotherCount}
          >
            <Input
              {...controlProps("brotherCount", errors.brotherCount)}
              type="number"
              min={0}
              max={20}
              inputMode="numeric"
              value={brotherCount}
              onChange={(event) => setBrotherCount(event.target.value)}
              dir="ltr"
            />
          </FormField>

          <FormField
            name="sisterCount"
            label={t.student.sisterCount}
            error={errors.sisterCount}
          >
            <Input
              {...controlProps("sisterCount", errors.sisterCount)}
              type="number"
              min={0}
              max={20}
              inputMode="numeric"
              value={sisterCount}
              onChange={(event) => setSisterCount(event.target.value)}
              dir="ltr"
            />
          </FormField>

          <FormField
            name="birthRank"
            label={t.student.birthRank}
            hint={t.student.birthRankHint}
            error={errors.birthRank}
          >
            <Input
              {...controlProps(
                "birthRank",
                errors.birthRank,
                t.student.birthRankHint,
              )}
              type="number"
              min={1}
              max={21}
              inputMode="numeric"
              defaultValue={valueOf(
                state,
                "birthRank",
                student?.birthRank === null || student?.birthRank === undefined
                  ? ""
                  : String(student.birthRank),
              )}
              dir="ltr"
            />
          </FormField>
        </FormGrid>

        {/* Summed here rather than stored: a third column that can disagree
          with the two it adds up is a bug waiting to be filed. */}
        {siblingCount !== null ? (
          <p className="text-muted-foreground text-xs">
            {interpolate(t.student.siblingTotal, {
              count: formatNumber(siblingCount, locale),
            })}
          </p>
        ) : null}

        <FormGrid cols={2}>
          <FormField
            name="livesWith"
            label={t.student.livesWith}
            hint={t.student.livesWithHint}
            error={errors.livesWith}
          >
            <Select
              name="livesWith"
              defaultValue={
                valueOf(state, "livesWith", student?.livesWith) || "__none__"
              }
            >
              <SelectTrigger id="livesWith" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {LIVES_WITH.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t.studentOptions.livesWith[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="isOrphan">{t.student.isOrphan}</Label>
              <p className="text-muted-foreground text-xs text-pretty">
                {t.student.isOrphanHint}
              </p>
            </div>
            <Switch
              id="isOrphan"
              name="isOrphan"
              defaultChecked={checkedOf(
                state,
                "isOrphan",
                student?.isOrphan ?? false,
              )}
            />
          </div>
        </FormGrid>
      </FormSection>

      <FormSection id="section-notes" title={t.student.notes}>
        <FormField name="notes" label={t.student.notes} error={errors.notes}>
          <Textarea
            {...controlProps("notes", errors.notes)}
            defaultValue={valueOf(state, "notes", student?.notes)}
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
          <>
            {/* The child as typed so far. On a blank fiche it is the only thing
              on screen that says what is being created, and on an open file it
              is the confirmation that the right one is being edited. */}
            <Card className="gap-0 py-4">
              <CardContent className="flex items-center gap-3 px-4">
                <Avatar className="size-11 border">
                  {student?.photoUrl ? (
                    <AvatarImage src={student.photoUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {fullName || (
                      <span className="text-muted-foreground font-normal">
                        {t.student.newStudent}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {age !== null
                      ? interpolate(t.student.ageYears, {
                          count: formatNumber(age, locale),
                        })
                      : t.student.birthDateHint}
                  </p>
                </div>
              </CardContent>
            </Card>

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
                  <Combobox
                    id="familyId"
                    name="familyId"
                    defaultValue={
                      valueOf(state, "familyId", student?.familyId) || "__none__"
                    }
                    emptyOption={{ value: "__none__", label: t.common.none }}
                    options={families.map((family) => ({
                      value: family.id,
                      label: family.label,
                    }))}
                  />
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
                    defaultChecked={checkedOf(
                      state,
                      "isActive",
                      student?.isActive ?? true,
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* The age used to sit here as a lone definition row; it now reads
              off the preview above, where it is next to the name it belongs
              to. */}
            <FormNav label={t.student.sections} items={SECTIONS(t)} />
          </>
        }
      >
        <FormSection
          id="section-essentials"
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
                defaultValue={valueOf(state, "firstName", student?.firstName)}
                onChange={(event) => setFirstName(event.target.value)}
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
                defaultValue={valueOf(state, "lastName", student?.lastName)}
                onChange={(event) => setLastName(event.target.value)}
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
              <Select
                name="gender"
                defaultValue={
                  valueOf(state, "gender", student?.gender) || "MALE"
                }
              >
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
                defaultValue={valueOf(state, "birthDate", student?.birthDate)}
                onChange={(event) => setBirthDate(event.target.value)}
                dir="ltr"
                required
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Creating and editing render the same sections — see the note above. */}
        {details}
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
