"use client";

import { PlusIcon } from "lucide-react";
import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/form/combobox";
import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import { cn } from "@/lib/utils";
import { createDevoirAction } from "@/modules/assessments/actions";
import { NOTES_MAX } from "@/modules/assessments/enums";
import type {
  AssessmentTypeOption,
  DevoirTarget,
  TermOption,
} from "@/modules/assessments/queries";

/**
 * Setting one devoir from the vie scolaire, beside the review of them.
 *
 * ── Why the office needs this at all ────────────────────────────────────────
 * A devoir used to be settable only from the phone, so the direction could
 * read every piece of homework in the school and set none of it. That is the
 * wrong shape for the ordinary case it kept meeting: a teacher is absent, or
 * has no device to hand, and the work the class has been told about exists
 * nowhere the mark sheet can be opened from. `createDevoir` already had the
 * office half — `actsForSchool` — because the mobile route passed it; there was
 * simply no screen that did.
 *
 * The generator next door is not the same thing and does not replace it: that
 * plans a round of contrôles across every subject of a level, and this sets one
 * piece of work for one class.
 *
 * ── One picker for the class and the subject ────────────────────────────────
 * `createDevoir` re-derives the TeachingAssignment for the pair and refuses
 * anything with none, so two independent pickers would offer combinations that
 * can only come back refused. The pair is chosen once and posted as two hidden
 * fields — see `listDevoirTargets`, which is scoped the same way the write is.
 *
 * The paper itself is not typed here. A barème is written at a desk with the
 * questions in front of you, and it can be added to the paper afterwards; what
 * this screen is for is getting the devoir on the record so its mark sheet
 * exists.
 */
export function SetDevoirDialog({
  targets,
  terms,
  types,
  defaultDate,
}: {
  targets: DevoirTarget[];
  terms: TermOption[];
  types: AssessmentTypeOption[];
  /** Already clamped into the school year — see lib/school-year.ts. */
  defaultDate: string;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(createDevoirAction, IDLE);

  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  // A closed term takes no new paper — the service refuses it, so it is not
  // offered either.
  const openTerms = terms.filter((term) => term.status !== "CLOSED");

  const [targetKey, setTargetKey] = React.useState("");
  const target = targets.find((option) => option.key === targetKey) ?? null;

  /**
   * The pairs as the picker reads them.
   *
   * The teacher goes in `keywords` as well as on the second line, so typing a
   * colleague's name finds every class they hold — which is the search the
   * office runs when covering for one. The cycle heads the rows; the list is
   * ordered by it server-side, which is what keeps one heading per cycle.
   */
  const targetOptions: ComboboxOption[] = React.useMemo(
    () =>
      targets.map((option) => ({
        value: option.key,
        label: `${option.classCode} · ${option.subjectLabel}`,
        hint: `${option.levelNameLabel} · ${option.teacherName}`,
        keywords: option.teacherName,
        group: option.cycleName,
      })),
    [targets],
  );

  /**
   * The kind, held rather than left to the form: it carries the school's
   * defaults for the scale and the weight, and picking one has to move both.
   */
  const [assessmentTypeId, setAssessmentTypeId] = React.useState(
    types[0]?.id ?? "",
  );
  const kind = types.find((type) => type.id === assessmentTypeId) ?? null;

  const blockedReason =
    targets.length === 0
      ? t.assessment.setDevoirNoTeaching
      : types.length === 0
        ? t.assessment.setDevoirNoKinds
        : openTerms.length === 0
          ? t.assessment.generateNoOpenTerm
          : null;

  return (
    <>
      {/* Wrapped rather than tooltipping the button: a disabled button fires no
        pointer events, so a tooltip on it would never open. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(blockedReason && "cursor-not-allowed")}>
            <Button onClick={() => setOpen(true)} disabled={blockedReason !== null}>
              <PlusIcon />
              {t.assessment.setDevoir}
            </Button>
          </span>
        </TooltipTrigger>
        {blockedReason ? <TooltipContent>{blockedReason}</TooltipContent> : null}
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>{t.assessment.setDevoirTitle}</DialogTitle>
              <DialogDescription className="text-pretty">
                {t.assessment.setDevoirHint}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* The pair, posted as the two ids the action validates. Chosen as
                one value because that is what an assignment is. */}
              <input
                type="hidden"
                name="schoolClassId"
                value={target?.schoolClassId ?? ""}
              />
              <input
                type="hidden"
                name="subjectId"
                value={target?.subjectId ?? ""}
              />

              <FormField
                name="target"
                label={t.assessment.classAndSubject}
                hint={t.assessment.classAndSubjectHint}
                error={
                  state.fieldErrors?.schoolClassId ?? state.fieldErrors?.subjectId
                }
                required
              >
                {/* A Combobox rather than a Select: this is every staffed
                  class-and-subject pair in the school, which on a collège is
                  several hundred rows. Scrolling for "3APIC-B · Physique" is
                  not a way to find it — and searching on the teacher is how the
                  office actually thinks about it when covering for somebody. */}
                <Combobox
                  id="target"
                  options={targetOptions}
                  value={targetKey}
                  onValueChange={setTargetKey}
                  placeholder={t.assessment.classAndSubject}
                />
              </FormField>

              {/* Whose class it is, repeated once chosen: the trigger shows
                only the label, and the paper is answerable to the teacher who
                holds the post rather than to whoever typed it in — see
                `createDevoir`. Better said before pressing than after. */}
              {target ? (
                <p className="text-muted-foreground -mt-2 text-xs">
                  {target.levelNameLabel} · {target.teacherName}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  name="termId"
                  label={t.assessment.term}
                  error={state.fieldErrors?.termId}
                  required
                >
                  <Select
                    name="termId"
                    defaultValue={valueOf(state, "termId", openTerms[0]?.id)}
                  >
                    <SelectTrigger id="termId" className="w-full">
                      <SelectValue placeholder={t.assessment.term} />
                    </SelectTrigger>
                    <SelectContent>
                      {openTerms.map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          {term.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  name="assessmentTypeId"
                  label={t.assessment.kind}
                  error={state.fieldErrors?.assessmentTypeId}
                  required
                >
                  <Select
                    name="assessmentTypeId"
                    value={assessmentTypeId}
                    onValueChange={setAssessmentTypeId}
                  >
                    <SelectTrigger id="assessmentTypeId" className="w-full">
                      <SelectValue placeholder={t.assessment.kind} />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <FormField
                name="title"
                label={t.assessment.paperTitle}
                error={state.fieldErrors?.title}
                required
              >
                <Input
                  {...controlProps("title", state.fieldErrors?.title)}
                  defaultValue={valueOf(state, "title", "")}
                  maxLength={160}
                  placeholder={t.assessment.devoirTitlePlaceholder}
                />
              </FormField>

              <FormField
                name="notes"
                label={t.assessment.covers}
                hint={t.assessment.coversHint}
                error={state.fieldErrors?.notes}
              >
                <Textarea
                  {...controlProps("notes", state.fieldErrors?.notes, t.assessment.coversHint)}
                  defaultValue={valueOf(state, "notes", "")}
                  maxLength={NOTES_MAX}
                  rows={2}
                  placeholder={t.assessment.coversPlaceholder}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  name="scheduledOn"
                  label={t.assessment.scheduledOn}
                  error={state.fieldErrors?.scheduledOn}
                  required
                >
                  <Input
                    {...controlProps("scheduledOn", state.fieldErrors?.scheduledOn)}
                    type="date"
                    defaultValue={valueOf(state, "scheduledOn", defaultDate)}
                    dir="ltr"
                  />
                </FormField>

                {/*
                  Keyed on the kind so the school's defaults follow the picker.
                  An uncontrolled input keeps its first value for as long as it
                  is mounted, so switching from a devoir out of 10 to a contrôle
                  out of 20 would have left the old scale in the box; remounting
                  is what makes the default a default and still lets it be
                  typed over.
                */}
                <FormField
                  name="maxScore"
                  label={t.assessment.maxScore}
                  error={state.fieldErrors?.maxScore}
                  required
                >
                  <Input
                    key={`maxScore-${assessmentTypeId}`}
                    {...controlProps("maxScore", state.fieldErrors?.maxScore)}
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={valueOf(
                      state,
                      "maxScore",
                      String(kind?.defaultMaxScore ?? 20),
                    )}
                    dir="ltr"
                  />
                </FormField>

                <FormField
                  name="coefficient"
                  label={t.assessment.coefficient}
                  error={state.fieldErrors?.coefficient}
                  required
                >
                  <Input
                    key={`coefficient-${assessmentTypeId}`}
                    {...controlProps("coefficient", state.fieldErrors?.coefficient)}
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={valueOf(
                      state,
                      "coefficient",
                      String(kind?.defaultCoefficient ?? 1),
                    )}
                    dir="ltr"
                  />
                </FormField>
              </div>

              {/*
                Whether it weighs on the term.

                Defaulted from the kind and keyed on it, so picking a kind the
                school never averages starts unticked — and a school running one
                devoir kind that does count can still set a piece of revision
                that does not, without inventing a second kind to say so.
              */}
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="countsTowardAverage">
                    {t.assessment.countsTowardAverage}
                  </Label>
                  <p className="text-muted-foreground text-xs text-pretty">
                    {t.assessment.countsTowardAverageHint}
                  </p>
                </div>
                <Switch
                  key={`counts-${assessmentTypeId}`}
                  id="countsTowardAverage"
                  name="countsTowardAverage"
                  defaultChecked={checkedOf(
                    state,
                    "countsTowardAverage",
                    kind?.countsTowardAverage ?? true,
                  )}
                />
              </div>

              <p className="text-muted-foreground text-xs text-pretty">
                {t.assessment.setDevoirDraftHint}
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <SubmitButton disabled={target === null}>
                <PlusIcon />
                {t.assessment.setDevoir}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
