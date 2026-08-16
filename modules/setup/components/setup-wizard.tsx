"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import type { SchoolSettingsValues } from "@/lib/school-settings";
import { runSetupAction } from "@/modules/setup/actions";
import type { SetupSnapshot } from "@/modules/setup/queries";
import { StepShell } from "@/modules/setup/components/step-shell";
import { BellStep } from "@/modules/setup/components/steps/bell-step";
import { ClassesInputs, ClassesStep } from "@/modules/setup/components/steps/classes-step";
import {
  CustomLevelInputs,
  CyclesStep,
  LevelsStep,
  ProgrammeInputs,
  ProgrammeStep,
  SubjectsStep,
  TracksStep,
} from "@/modules/setup/components/steps/cursus-steps";
import { FeesInputs, FeesStep } from "@/modules/setup/components/steps/fees-step";
import { IdentityStep } from "@/modules/setup/components/steps/identity-step";
import { ReviewStep } from "@/modules/setup/components/steps/review-step";
import { RoomsInputs, RoomsStep } from "@/modules/setup/components/steps/rooms-step";
import { WeekStep } from "@/modules/setup/components/steps/week-step";
import { YearInputs, YearStep } from "@/modules/setup/components/steps/year-step";
import { useSetupState, type SetupMode } from "@/modules/setup/components/use-setup-state";

const STEPS = [
  "identity",
  "year",
  "cycles",
  "levels",
  "tracks",
  "subjects",
  "programme",
  "rooms",
  "bell",
  "week",
  "classes",
  "fees",
  "review",
] as const;
type Step = (typeof STEPS)[number];

/**
 * Which step owns a given field error, so a failure on a pane the user cannot
 * see still takes them to it. With twelve steps this is not optional: a message
 * rendered three panes away is a message nobody reads.
 */
const STEP_OF_FIELD: Record<string, Step> = {
  code: "identity", name: "identity", level: "identity", massarCode: "identity",
  directorName: "identity", capacity: "identity", email: "identity", phone: "identity",
  website: "identity", logoUrl: "identity", addressLine: "identity", city: "identity",
  region: "identity", postalCode: "identity", country: "identity", isActive: "identity",

  yearName: "year", yearStartDate: "year", yearEndDate: "year", yearStatus: "year",
  yearIsDefault: "year", terms: "year",

  levels: "levels",
  programme: "programme",
  rooms: "rooms",

  // Every key `bellScheduleSchema` can fail on, the Ramadan pair included: a
  // message on a key that is not here lands on no step at all, and the wizard
  // then reports an error the user cannot see and cannot clear.
  teachingDays: "bell", dayStartsAt: "bell", afternoonStartsAt: "bell",
  periodMinutes: "bell", morningPeriods: "bell", afternoonPeriods: "bell",
  periodsBeforeBreak: "bell", breakMinutes: "bell", freeAfternoonDays: "bell",
  withRamadan: "bell", ramadanStartsAt: "bell", ramadanPeriods: "bell",

  classes: "classes", groupsPerClass: "classes", groupPurpose: "classes",

  fees: "fees", currencyCode: "fees", defaultInstalmentCount: "fees",
  feeDueDayOfMonth: "fees",
};

/**
 * One guided pass from an empty school to a configured one.
 *
 * ── Why every pane stays mounted ────────────────────────────────────────────
 * All twelve steps' fields are in the DOM for the lifetime of the form and only
 * their visibility toggles, so nothing answered on an earlier step is lost by
 * moving on and the final submit posts the whole thing at once. It is the same
 * shape `enrol-wizard.tsx` uses, for the same reason.
 *
 * ── Why a step can be switched off ──────────────────────────────────────────
 * A school that only wants its cursus should not have to invent a fee list to
 * get past the wizard. A step switched off wraps its controls in a disabled
 * `<fieldset>` and renders no hidden inputs, so it posts nothing and the action
 * reads an empty array — "skipped" needs no flag of its own.
 *
 * ── Why `tracks` can disappear entirely ─────────────────────────────────────
 * Only the qualifying cycle streams into filières. A préscolaire-and-primaire
 * school is never shown the step, and its step count says eleven rather than
 * twelve — the same way the guardian step vanishes when a pupil joins a family
 * that already has one.
 */
export function SetupWizard({
  mode,
  snapshot,
  settings,
}: {
  mode: SetupMode;
  snapshot: SetupSnapshot | null;
  settings: SchoolSettingsValues;
}) {
  const t = useT();
  const setup = useSetupState({ mode, snapshot, settings });

  const [state, formAction] = useActionState(runSetupAction, IDLE);
  useActionFeedback(state);
  const errors = React.useMemo(() => state.fieldErrors ?? {}, [state.fieldErrors]);

  const [selected, setSelected] = React.useState<Step>(mode === "new" ? "identity" : "year");

  const yearOn = setup.enabled.year;
  const cursusOn = setup.enabled.cycles;

  const visibleSteps = React.useMemo(
    () =>
      STEPS.filter((id) => mode === "new" || id !== "identity").filter(
        (id) => id !== "tracks" || setup.cursus.catalogueTracks.length > 0,
      ),
    [mode, setup.cursus.catalogueTracks.length],
  );

  // Derived rather than corrected by an effect: a step that stops being visible
  // — the filières, when the last qualifying level is unticked — simply is not
  // the selected one any more.
  const step = visibleSteps.includes(selected) ? selected : visibleSteps[0];
  const setStep = setSelected;

  /*
    Land on the step that owns the first error, otherwise the message sits on a
    pane the user is not looking at. Adjusted during render rather than in an
    effect: it is a response to a new action result arriving as props, and an
    effect here would render the wrong step once before correcting itself.
  */
  const [handledKey, setHandledKey] = React.useState<number | undefined>(undefined);
  if (state.status === "error" && state.key !== handledKey) {
    setHandledKey(state.key);
    const first = Object.keys(state.fieldErrors ?? {})[0];
    const target = first ? STEP_OF_FIELD[first] : undefined;
    if (target && visibleSteps.includes(target)) setSelected(target);
  }

  const index = visibleSteps.indexOf(step);
  const isFirst = index <= 0;
  const isLast = index === visibleSteps.length - 1;

  const goNext = () => setStep(visibleSteps[Math.min(index + 1, visibleSteps.length - 1)]);
  const goPrevious = () => setStep(visibleSteps[Math.max(index - 1, 0)]);

  const blockedByYear = yearOn ? undefined : t.setup.blockedByYear;
  const cursusBlocked = cursusOn ? undefined : t.setup.nothingChosen;

  return (
    <form
      action={formAction}
      /*
        Native constraint validation is off, and has to be: every pane stays
        mounted and all but one are `display: none`, so the browser refuses to
        submit on a `required` or out-of-step control it then cannot focus to
        complain about — "An invalid form control with name='' is not
        focusable", and the submit silently does nothing. The server validates
        every field anyway, and `STEP_OF_FIELD` opens the step that owns the
        first error, which is the only reporting that works across twelve panes.
      */
      noValidate
      // Enter should advance the visible step, never submit the whole wizard
      // eleven steps early because the last step's button is first in tree order.
      onKeyDown={(event) => {
        if (event.key === "Enter" && !isLast) event.preventDefault();
      }}
    >
      <input type="hidden" name="mode" value={mode} />
      {snapshot ? <input type="hidden" name="schoolId" value={snapshot.school.id} /> : null}
      <input type="hidden" name="defaultLocale" value={setup.fees.defaultLocale} />

      <div className="grid gap-2">
        <div className="flex items-center gap-1.5">
          {visibleSteps.map((id, position) => (
            <span
              key={id}
              aria-hidden
              className={
                position <= index
                  ? "bg-primary h-1 flex-1 rounded-full"
                  : "bg-muted h-1 flex-1 rounded-full"
              }
            />
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {interpolate(t.setup.stepOf, { step: index + 1, total: visibleSteps.length })}
          {" · "}
          {t.setup.steps[step]}
        </p>
      </div>

      {/*
        The same errors the toast carries, kept on the page.

        A toast is gone in four seconds and the submit button is at the bottom
        of a thirteen-pane form, so a failure read once and then scrolled past
        is a failure nobody can act on. Every field is listed, not just the
        first, because fixing one at a time through thirteen submits is how a
        wizard becomes unusable.
      */}
      {state.status === "error" ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            <span className="font-medium">{state.message}</span>
            {Object.keys(errors).length > 0 ? (
              <ul className="mt-1 grid gap-0.5 text-xs">
                {Object.entries(errors).map(([name, reason]) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="text-start underline-offset-2 hover:underline"
                      onClick={() => {
                        const target = STEP_OF_FIELD[name];
                        if (target && visibleSteps.includes(target)) setStep(target);
                      }}
                    >
                      <span className="font-mono">{name}</span> — {reason}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {snapshot && snapshot.counts.levels + snapshot.counts.rooms + snapshot.counts.classes > 0 ? (
        <Alert className="mt-4">
          <AlertDescription>
            {interpolate(t.setup.existingBanner, {
              levels: snapshot.counts.levels,
              rooms: snapshot.counts.rooms,
              classes: snapshot.counts.classes,
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-5">
        {mode === "new" ? (
          <StepShell
            id="identity"
            visible={step === "identity"}
            title={t.setup.steps.identity}
            description={t.setup.hints.identity}
          >
            <IdentityStep state={state} errors={errors} />
          </StepShell>
        ) : null}

        <StepShell
          id="year"
          visible={step === "year"}
          title={t.setup.steps.year}
          description={t.setup.hints.year}
          enabled={setup.enabled.year}
          onEnabledChange={(value) => setup.toggleStep("year", value)}
          hidden={<YearInputs setup={setup} />}
        >
          <YearStep setup={setup} errors={errors} />
        </StepShell>

        <StepShell
          id="cycles"
          visible={step === "cycles"}
          title={t.setup.steps.cycles}
          description={t.setup.hints.cycles}
          enabled={setup.enabled.cycles}
          onEnabledChange={(value) => setup.toggleStep("cycles", value)}
        >
          <CyclesStep setup={setup} />
        </StepShell>

        <StepShell
          id="levels"
          visible={step === "levels"}
          title={t.setup.steps.levels}
          description={t.setup.hints.levels}
          blockedReason={cursusBlocked}
          hidden={<CustomLevelInputs setup={setup} />}
        >
          <LevelsStep setup={setup} />
        </StepShell>

        <StepShell
          id="tracks"
          visible={step === "tracks"}
          title={t.setup.steps.tracks}
          description={t.setup.hints.tracks}
          blockedReason={cursusBlocked}
        >
          <TracksStep setup={setup} />
        </StepShell>

        <StepShell
          id="subjects"
          visible={step === "subjects"}
          title={t.setup.steps.subjects}
          description={t.setup.hints.subjects}
          blockedReason={cursusBlocked}
        >
          <SubjectsStep setup={setup} />
        </StepShell>

        <StepShell
          id="programme"
          visible={step === "programme"}
          title={t.setup.steps.programme}
          description={t.setup.hints.programme}
          blockedReason={cursusBlocked}
          hidden={<ProgrammeInputs setup={setup} />}
        >
          <ProgrammeStep setup={setup} />
        </StepShell>

        <StepShell
          id="rooms"
          visible={step === "rooms"}
          title={t.setup.steps.rooms}
          description={t.setup.hints.rooms}
          enabled={setup.enabled.rooms}
          onEnabledChange={(value) => setup.toggleStep("rooms", value)}
          hidden={<RoomsInputs setup={setup} />}
        >
          <RoomsStep setup={setup} error={errors.rooms} />
        </StepShell>

        <StepShell
          id="bell"
          visible={step === "bell"}
          title={t.setup.steps.bell}
          description={t.setup.hints.bell}
          enabled={setup.enabled.bell}
          onEnabledChange={(value) => setup.toggleStep("bell", value)}
          blockedReason={blockedByYear}
        >
          <BellStep setup={setup} errors={errors} />
        </StepShell>

        {/* Reads the bell's answers and writes nothing, so it has no switch of
            its own — it is blocked by whatever blocks the step it draws. */}
        <StepShell
          id="week"
          visible={step === "week"}
          title={t.setup.steps.week}
          description={t.setup.hints.week}
          blockedReason={blockedByYear ?? (setup.enabled.bell ? undefined : t.setup.week.bellOff)}
        >
          <WeekStep setup={setup} />
        </StepShell>

        <StepShell
          id="classes"
          visible={step === "classes"}
          title={t.setup.steps.classes}
          description={t.setup.hints.classes}
          enabled={setup.enabled.classes}
          onEnabledChange={(value) => setup.toggleStep("classes", value)}
          blockedReason={blockedByYear ?? cursusBlocked}
          hidden={<ClassesInputs setup={setup} />}
        >
          <ClassesStep setup={setup} error={errors.classes} />
        </StepShell>

        <StepShell
          id="fees"
          visible={step === "fees"}
          title={t.setup.steps.fees}
          description={t.setup.hints.fees}
          enabled={setup.enabled.fees}
          onEnabledChange={(value) => setup.toggleStep("fees", value)}
          hidden={<FeesInputs setup={setup} yearEnabled={yearOn} />}
        >
          <FeesStep setup={setup} yearEnabled={yearOn} error={errors.fees} />
        </StepShell>

        <StepShell
          id="review"
          visible={step === "review"}
          title={t.setup.steps.review}
          description={t.setup.hints.review}
        >
          <ReviewStep setup={setup} />
        </StepShell>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={goPrevious} disabled={isFirst}>
            <ChevronLeftIcon className="rtl-flip" />
            {t.setup.previous}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/schools">{t.common.cancel}</Link>
          </Button>
        </div>

        {isLast ? (
          <SubmitButton size="lg" pendingLabel={t.setup.submitting}>
            {mode === "new" ? t.setup.submit : t.setup.submitExisting}
          </SubmitButton>
        ) : (
          <Button type="button" onClick={goNext}>
            {t.setup.next}
            <ChevronRightIcon className="rtl-flip" />
          </Button>
        )}
      </div>
    </form>
  );
}
