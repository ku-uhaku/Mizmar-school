"use client";

import * as React from "react";
import { useActionState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Combobox } from "@/components/form/combobox";
import { clusterByGroup } from "@/components/form/option-groups";
import { FormField, controlProps } from "@/components/form/form-field";
import { FormGrid } from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import { valueOf } from "@/lib/form-values";
import { GUARDIAN_RELATIONSHIPS } from "@/modules/families/enums";
import { enrolNewStudentAction } from "@/modules/students/actions";
import { GENDERS } from "@/modules/students/enums";

const STEPS = ["family", "guardian", "student", "enrolment"] as const;
type Step = (typeof STEPS)[number];

type Offering = {
  id: string;
  label: string;
  /** Both names and the code — see modules/academics/labels.ts. */
  optionLabel: string;
  /** The cycle it is listed under. */
  cycleName: string;
  levelName: string;
  trackName: string | null;
  classes: {
    id: string;
    code: string;
    name: string | null;
    groups: { id: string; label: string }[];
  }[];
};

/**
 * Registers a pupil in one sitting — the workflow this replaces was four
 * separate screens: create the family, open it back up to add a guardian,
 * create the pupil, then find the enrolment panel on their file to actually
 * seat them. One form, one submit, `enrolNewStudentAction` does the rest and
 * redirects to the finished file.
 *
 * All four steps' fields stay mounted for the lifetime of the form — only
 * their visibility toggles — so nothing typed on an earlier step is lost by
 * moving on, and the final submit posts the whole thing at once. The guardian
 * step is skipped when attaching to a family that already exists, since it
 * already has one.
 */
export function EnrolWizard({
  families,
  cities,
  neighbourhoods,
  offerings,
  yearLabel,
}: {
  families: { id: string; label: string }[];
  cities: { id: string; label: string }[];
  neighbourhoods: { id: string; label: string }[];
  offerings: Offering[];
  yearLabel: string | null;
}) {
  const t = useT();
  const [state, formAction] = useActionState(enrolNewStudentAction, IDLE);
  const errors = state.fieldErrors ?? {};

  const [step, setStep] = React.useState<Step>("family");
  const [familyMode, setFamilyMode] = React.useState<"existing" | "new">(
    families.length > 0 ? "existing" : "new",
  );

  const visibleSteps: Step[] =
    familyMode === "new" ? [...STEPS] : STEPS.filter((s) => s !== "guardian");
  const stepNumber = visibleSteps.indexOf(step) + 1;

  const [familyName, setFamilyName] = React.useState("");
  const [existingFamilyId, setExistingFamilyId] = React.useState(
    valueOf(state, "familyId", null) || "",
  );
  const [studentFirstName, setStudentFirstName] = React.useState("");
  const [studentLastName, setStudentLastName] = React.useState("");
  const [studentGender, setStudentGender] = React.useState("MALE");
  const [studentBirthDate, setStudentBirthDate] = React.useState("");

  const [offeringId, setOfferingId] = React.useState(offerings[0]?.id ?? "");
  const [classId, setClassId] = React.useState("__none__");
  const selectedOffering = offerings.find((o) => o.id === offeringId);
  const selectedClass = selectedOffering?.classes.find((c) => c.id === classId);

  const canLeaveFamily =
    familyMode === "existing" ? Boolean(existingFamilyId) : Boolean(familyName);
  const canLeaveStudent =
    Boolean(studentFirstName) &&
    Boolean(studentLastName) &&
    Boolean(studentGender) &&
    Boolean(studentBirthDate);

  function goNext() {
    if (step === "family" && canLeaveFamily) {
      setStep(familyMode === "new" ? "guardian" : "student");
    } else if (step === "guardian") {
      setStep("student");
    } else if (step === "student" && canLeaveStudent) {
      setStep("enrolment");
    }
  }

  function goPrevious() {
    if (step === "enrolment") setStep("student");
    else if (step === "student") setStep(familyMode === "new" ? "guardian" : "family");
    else if (step === "guardian") setStep("family");
  }

  return (
    <form
      action={formAction}
      // Enter should advance the visible step, never silently submit a form
      // three steps early because the last step's (hidden) submit button is
      // still first in tree order.
      onKeyDown={(event) => {
        if (event.key === "Enter" && step !== "enrolment") {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="familyMode" value={familyMode} />

      <Card>
        <CardHeader>
          <CardTitle>{t.student.enrolWizard.title}</CardTitle>
          <CardDescription>{t.student.enrolWizard.subtitle}</CardDescription>
          <div className="mt-2 flex items-center gap-1.5">
            {visibleSteps.map((visible, index) => (
              <span
                key={visible}
                aria-hidden
                className={
                  index + 1 <= stepNumber
                    ? "bg-primary h-1 flex-1 rounded-full"
                    : "bg-muted h-1 flex-1 rounded-full"
                }
              />
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {interpolate(t.student.enrolWizard.stepOf, {
              step: stepNumber,
              total: visibleSteps.length,
            })}
          </p>
        </CardHeader>

        <CardContent className="grid gap-5">
          {/* ── Famille ─────────────────────────────────────────────────── */}
          <div className={step === "family" ? "grid gap-5" : "hidden"}>
            <Tabs
              value={familyMode}
              onValueChange={(value) =>
                setFamilyMode(value === "existing" ? "existing" : "new")
              }
            >
              <TabsList>
                <TabsTrigger value="existing" disabled={families.length === 0}>
                  {t.student.enrolWizard.familyExisting}
                </TabsTrigger>
                <TabsTrigger value="new">
                  {t.student.enrolWizard.familyNew}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {familyMode === "existing" ? (
              <FormField
                name="familyId"
                label={t.student.enrolWizard.familyExistingLabel}
                hint={t.student.enrolWizard.familyExistingHint}
                error={errors.familyId}
                required
              >
                <Combobox
                  id="familyId"
                  name="familyId"
                  value={existingFamilyId}
                  onValueChange={setExistingFamilyId}
                  options={families.map((family) => ({
                    value: family.id,
                    label: family.label,
                  }))}
                />
              </FormField>
            ) : (
              <FormGrid cols={2}>
                <FormField
                  name="familyName"
                  label={t.family.name}
                  hint={t.family.nameHint}
                  error={errors.familyName}
                  required
                  className="sm:col-span-2"
                >
                  <Input
                    {...controlProps(
                      "familyName",
                      errors.familyName,
                      t.family.nameHint,
                    )}
                    value={familyName}
                    placeholder="Bennis"
                    onChange={(event) => setFamilyName(event.target.value)}
                    required
                  />
                </FormField>

                <FormField
                  name="familyPhone"
                  label={t.family.phone}
                  error={errors.familyPhone}
                >
                  <Input
                    {...controlProps("familyPhone", errors.familyPhone)}
                    defaultValue={valueOf(state, "familyPhone", null)}
                    dir="ltr"
                  />
                </FormField>

                <FormField
                  name="familyCity"
                  label={t.family.city}
                  error={errors.familyCity}
                >
                  <Input
                    {...controlProps("familyCity", errors.familyCity)}
                    defaultValue={valueOf(state, "familyCity", null)}
                  />
                </FormField>

                <FormField
                  name="familyAddressLine"
                  label={t.family.addressLine}
                  error={errors.familyAddressLine}
                  className="sm:col-span-2"
                >
                  <Input
                    {...controlProps(
                      "familyAddressLine",
                      errors.familyAddressLine,
                    )}
                    defaultValue={valueOf(state, "familyAddressLine", null)}
                  />
                </FormField>
              </FormGrid>
            )}
          </div>

          {/* ── Tuteur ──────────────────────────────────────────────────── */}
          <div className={step === "guardian" ? "grid gap-5" : "hidden"}>
            <p className="text-muted-foreground text-sm">
              {t.student.enrolWizard.guardianHint}
            </p>
            <FormGrid cols={2}>
              <FormField
                name="guardianRelationship"
                label={t.student.enrolWizard.guardianRelationship}
                error={errors.guardianRelationship}
              >
                <Select
                  name="guardianRelationship"
                  defaultValue={
                    valueOf(state, "guardianRelationship", null) || "FATHER"
                  }
                >
                  <SelectTrigger id="guardianRelationship" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GUARDIAN_RELATIONSHIPS.map((relationship) => (
                      <SelectItem key={relationship} value={relationship}>
                        {t.familyOptions.relationships[relationship]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="guardianPhone"
                label={t.family.phone}
                error={errors.guardianPhone}
              >
                <Input
                  {...controlProps("guardianPhone", errors.guardianPhone)}
                  defaultValue={valueOf(state, "guardianPhone", null)}
                  dir="ltr"
                />
              </FormField>

              <FormField
                name="guardianFirstName"
                label={t.family.firstName}
                error={errors.guardianFirstName}
              >
                <Input
                  {...controlProps(
                    "guardianFirstName",
                    errors.guardianFirstName,
                  )}
                  defaultValue={valueOf(state, "guardianFirstName", null)}
                />
              </FormField>

              <FormField
                name="guardianLastName"
                label={t.family.lastName}
                error={errors.guardianLastName}
              >
                <Input
                  {...controlProps("guardianLastName", errors.guardianLastName)}
                  defaultValue={valueOf(state, "guardianLastName", null)}
                />
              </FormField>
            </FormGrid>
          </div>

          {/* ── Élève ───────────────────────────────────────────────────── */}
          <div className={step === "student" ? "grid gap-5" : "hidden"}>
            <FormGrid cols={2}>
              <FormField
                name="studentFirstName"
                label={t.student.firstName}
                error={errors.studentFirstName}
                required
              >
                <Input
                  {...controlProps("studentFirstName", errors.studentFirstName)}
                  value={studentFirstName}
                  onChange={(event) => setStudentFirstName(event.target.value)}
                  autoFocus
                  required
                />
              </FormField>

              <FormField
                name="studentLastName"
                label={t.student.lastName}
                error={errors.studentLastName}
                required
              >
                <Input
                  {...controlProps("studentLastName", errors.studentLastName)}
                  value={studentLastName}
                  onChange={(event) => setStudentLastName(event.target.value)}
                  required
                />
              </FormField>

              <FormField
                name="studentGender"
                label={t.student.gender}
                error={errors.studentGender}
                required
              >
                <Select
                  name="studentGender"
                  value={studentGender}
                  onValueChange={setStudentGender}
                >
                  <SelectTrigger id="studentGender" className="w-full">
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
                name="studentBirthDate"
                label={t.student.birthDate}
                hint={t.student.birthDateHint}
                error={errors.studentBirthDate}
                required
              >
                <Input
                  {...controlProps(
                    "studentBirthDate",
                    errors.studentBirthDate,
                    t.student.birthDateHint,
                  )}
                  type="date"
                  value={studentBirthDate}
                  onChange={(event) => setStudentBirthDate(event.target.value)}
                  dir="ltr"
                  required
                />
              </FormField>

              <FormField
                name="studentBirthCityId"
                label={t.student.birthPlace}
                hint={cities.length === 0 ? t.student.noCities : undefined}
                error={errors.studentBirthCityId}
              >
                <Select
                  name="studentBirthCityId"
                  defaultValue={
                    valueOf(state, "studentBirthCityId", null) || "__none__"
                  }
                >
                  <SelectTrigger id="studentBirthCityId" className="w-full">
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

              <FormField
                name="studentNeighbourhoodId"
                label={t.student.neighbourhood}
                hint={
                  neighbourhoods.length === 0
                    ? t.student.noNeighbourhoods
                    : t.student.neighbourhoodHint
                }
                error={errors.studentNeighbourhoodId}
              >
                <Select
                  name="studentNeighbourhoodId"
                  defaultValue={
                    valueOf(state, "studentNeighbourhoodId", null) ||
                    "__none__"
                  }
                >
                  <SelectTrigger id="studentNeighbourhoodId" className="w-full">
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
          </div>

          {/* ── Inscription ─────────────────────────────────────────────── */}
          <div className={step === "enrolment" ? "grid gap-5" : "hidden"}>
            <p className="text-muted-foreground text-sm">
              {yearLabel
                ? interpolate(t.student.enrolWizard.enrolmentHint, {
                    year: yearLabel,
                  })
                : null}
            </p>
            <FormGrid cols={2}>
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
                    setClassId("__none__");
                  }}
                >
                  <SelectTrigger id="levelOfferingId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clusterByGroup(
                      offerings.map((offering) => ({
                        ...offering,
                        group: offering.cycleName,
                      })),
                    ).map((cluster) => (
                      <SelectGroup key={cluster.heading}>
                        <SelectLabel>{cluster.heading}</SelectLabel>
                        {cluster.options.map((offering) => (
                          <SelectItem key={offering.id} value={offering.id}>
                            {offering.optionLabel}
                          </SelectItem>
                        ))}
                      </SelectGroup>
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
                  disabled={!selectedOffering || selectedOffering.classes.length === 0}
                >
                  <SelectTrigger id="schoolClassId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.enrolment.noClass}</SelectItem>
                    {selectedOffering?.classes.map((schoolClass) => (
                      <SelectItem key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name ?? schoolClass.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {selectedClass && selectedClass.groups.length > 0 ? (
                <FormField
                  name="classGroupId"
                  label={t.enrolment.group}
                  error={errors.classGroupId}
                >
                  <Select
                    name="classGroupId"
                    defaultValue={
                      valueOf(state, "classGroupId", null) || "__none__"
                    }
                  >
                    <SelectTrigger id="classGroupId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {t.enrolment.noGroup}
                      </SelectItem>
                      {selectedClass.groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
            </FormGrid>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goPrevious}
          disabled={step === "family"}
        >
          <ChevronLeftIcon className="rtl-flip" />
          {t.student.enrolWizard.previous}
        </Button>

        {step === "enrolment" ? (
          <SubmitButton disabled={offerings.length === 0}>
            {t.student.enrolWizard.submit}
          </SubmitButton>
        ) : (
          <Button
            type="button"
            onClick={goNext}
            disabled={
              (step === "family" && !canLeaveFamily) ||
              (step === "student" && !canLeaveStudent)
            }
          >
            {t.student.enrolWizard.next}
            <ChevronRightIcon className="rtl-flip" />
          </Button>
        )}
      </div>
    </form>
  );
}
