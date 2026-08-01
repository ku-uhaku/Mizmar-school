"use client";

import { SparklesIcon } from "lucide-react";
import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { generateAssessmentsAction } from "@/modules/assessments/actions";
import type {
  AssessmentTypeOption,
  ClassOption,
  ProgrammeEntry,
  TermOption,
} from "@/modules/assessments/queries";

/**
 * "Contrôle n°1, semester 1, 3AP-A" → one paper per marked subject.
 *
 * The whole point is that the operator never names the subjects: the programme
 * already knows them, and typing a dozen near-identical forms per class is how
 * a subject quietly goes missing from a report card. Re-running is safe and the
 * dialog says so, because the operator's real question is "did I already do
 * this one?".
 */
export function GenerateDialog({
  classes,
  terms,
  types,
  programmes,
  defaultClassId,
  defaultTermId,
  defaultDate: initialDate,
}: {
  classes: ClassOption[];
  terms: TermOption[];
  types: AssessmentTypeOption[];
  /** Marked subjects per class, so the picker fills in without a round trip. */
  programmes: Record<string, ProgrammeEntry[]>;
  defaultClassId: string | null;
  defaultTermId: string | null;
  /**
   * What the shared date starts at, already clamped into the school year.
   * Today falls outside it for two months a year, and a contrôle dated then
   * belongs to no term at all. See lib/school-year.ts.
   */
  defaultDate: string;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(
    generateAssessmentsAction,
    IDLE,
  );

  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  // A closed term cannot take a new paper — the action refuses it, so the
  // picker does not offer it either.
  const openTerms = terms.filter((term) => term.status !== "CLOSED");

  const [classId, setClassId] = React.useState(defaultClassId ?? "");
  const [defaultDate, setDefaultDate] = React.useState(initialDate);

  // Memoised so the empty-array fallback is not a fresh identity every render,
  // which would defeat the grouping memo below.
  const programme = React.useMemo(
    () => programmes[classId] ?? [],
    [programmes, classId],
  );

  /**
   * What is ticked, and the date on each — kept together with the class it was
   * chosen for.
   *
   * Storing the class alongside the selection is what lets the reset be
   * *derived* rather than synced in an effect: changing class changes the
   * subject list entirely, so the previous ticks mean nothing, and the untouched
   * state for a new class is simply "everything on". An effect that reset it
   * would run a render late and is the sort of thing that shows the wrong list
   * for a frame.
   */
  const [selection, setSelection] = React.useState<{
    classId: string;
    chosen: Record<string, string>;
  } | null>(null);

  /**
   * The programme as the picker shows it: components gathered under the matière
   * they belong to, subjects in their own right on their own.
   *
   * The order of the programme is preserved — it is `LevelSubject.position`,
   * which is the order a report card prints in — so a group appears where its
   * first component does rather than being sorted somewhere else.
   */
  const groups = React.useMemo(() => {
    const byParent: {
      key: string;
      title: string | null;
      entries: ProgrammeEntry[];
    }[] = [];
    const index = new Map<string, number>();

    for (const entry of programme) {
      const key = entry.parentSubjectId ?? entry.subjectId;
      const seen = index.get(key);
      if (seen === undefined) {
        index.set(key, byParent.length);
        byParent.push({
          key,
          // Null for a matière with no components: it needs no heading, it *is*
          // the row.
          title: entry.parentSubjectName,
          entries: [entry],
        });
      } else {
        byParent[seen].entries.push(entry);
      }
    }

    return byParent;
  }, [programme]);

  /** A subject nobody teaches cannot be generated — the action refuses it. */
  const staffed = programme.filter((entry) => entry.teacherName !== null);
  const unstaffedCount = programme.length - staffed.length;

  const everythingOn = (subjects: ProgrammeEntry[], date: string) =>
    Object.fromEntries(subjects.map((entry) => [entry.subjectId, date]));

  // Untouched means "every subject that has a teacher" — the unstaffed ones
  // start off because ticking them could not produce anything.
  const chosen =
    selection?.classId === classId
      ? selection.chosen
      : everythingOn(staffed, defaultDate);

  const setChosen = (chosenNext: Record<string, string>) =>
    setSelection({ classId, chosen: chosenNext });

  function toggle(subjectId: string, checked: boolean) {
    const next = { ...chosen };
    if (checked) next[subjectId] = defaultDate;
    else delete next[subjectId];
    setChosen(next);
  }

  function setAll(checked: boolean) {
    setChosen(checked ? everythingOn(staffed, defaultDate) : {});
  }

  /** Retyping the shared date moves every paper that still carries the old one. */
  function applyDefaultDate(value: string) {
    const next: Record<string, string> = {};
    for (const [subjectId, date] of Object.entries(chosen)) {
      next[subjectId] = date === defaultDate ? value : date;
    }
    setChosen(next);
    setDefaultDate(value);
  }

  const chosenCount = Object.keys(chosen).length;

  const disabled =
    classes.length === 0 || openTerms.length === 0 || types.length === 0;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}>
        <SparklesIcon />
        {t.assessment.generate}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>{t.assessment.generateTitle}</DialogTitle>
              <DialogDescription className="text-pretty">
                {t.assessment.generateHint}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <FormField name="schoolClassId" label={t.assessment.class}>
                <Select
                  name="schoolClassId"
                  value={classId}
                  onValueChange={setClassId}
                >
                  <SelectTrigger id="schoolClassId" className="w-full">
                    <SelectValue placeholder={t.assessment.class} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.code} · {option.levelLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField name="termId" label={t.assessment.term}>
                <Select name="termId" defaultValue={defaultTermId ?? undefined}>
                  <SelectTrigger id="termId" className="w-full">
                    <SelectValue placeholder={t.assessment.term} />
                  </SelectTrigger>
                  <SelectContent>
                    {openTerms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField name="assessmentTypeId" label={t.assessment.kind}>
                <Select name="assessmentTypeId" defaultValue={types[0]?.id}>
                  <SelectTrigger id="assessmentTypeId" className="w-full">
                    <SelectValue placeholder={t.assessment.kind} />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} · /{type.defaultMaxScore} · ×
                        {type.defaultCoefficient}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  name="sequence"
                  label={t.assessment.sequence}
                  hint={t.assessment.sequenceHint}
                  error={state.fieldErrors?.sequence}
                >
                  <Input
                    {...controlProps("sequence", state.fieldErrors?.sequence)}
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={1}
                    dir="ltr"
                  />
                </FormField>

                <FormField
                  name="scheduledOn"
                  label={t.assessment.scheduledOn}
                  error={state.fieldErrors?.scheduledOn}
                >
                  <Input
                    {...controlProps(
                      "scheduledOn",
                      state.fieldErrors?.scheduledOn,
                    )}
                    type="date"
                    value={defaultDate}
                    onChange={(event) => applyDefaultDate(event.target.value)}
                    dir="ltr"
                  />
                </FormField>
              </div>

              {/*
                The subject picker. Every ticked row posts a `subjectId:date`
                pair, so each paper carries its own date — which is the whole
                point: a round of contrôles is sat across a week, and the one
                thing the old all-or-nothing generator could not express was
                "everything except EPS, and Maths on the Thursday".
              */}
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="flex-1">
                    {t.assessment.subjectsToGenerate}
                    <Badge variant="secondary" className="ms-1.5 tabular-nums">
                      {chosenCount}/{staffed.length}
                    </Badge>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAll(true)}
                  >
                    {t.assessment.allSubjects}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAll(false)}
                  >
                    {t.assessment.noneSubjects}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs text-pretty">
                  {t.assessment.subjectsToGenerateHint}
                </p>

                {unstaffedCount > 0 ? (
                  <p className="text-warning text-xs text-pretty">
                    {interpolate(t.assessment.unstaffedSubjects, {
                      count: unstaffedCount,
                    })}
                  </p>
                ) : null}

                {programme.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    {t.assessment.noProgramme}
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    {groups.map((group) => (
                      <div key={group.key} className="border-b last:border-b-0">
                        {/* Only a matière split into components gets a heading;
                          a subject marked as one paper is its own row. */}
                        {group.title ? (
                          <p className="bg-muted/50 text-muted-foreground px-2 py-1 text-xs font-medium">
                            {group.title}
                          </p>
                        ) : null}

                        {group.entries.map((entry) => {
                          const checked = entry.subjectId in chosen;
                          // No teacher, no paper — the action refuses it, so
                          // the row cannot be ticked and says why.
                          const blocked = entry.teacherName === null;

                          return (
                            <div
                              key={entry.subjectId}
                              className={cn(
                                "flex items-center gap-3 p-2",
                                group.title && "ps-6",
                                blocked && "opacity-60",
                              )}
                            >
                              <Checkbox
                                id={`subject-${entry.subjectId}`}
                                checked={checked}
                                disabled={blocked}
                                onCheckedChange={(value) =>
                                  toggle(entry.subjectId, value === true)
                                }
                              />
                              <Label
                                htmlFor={`subject-${entry.subjectId}`}
                                className="min-w-0 flex-1 cursor-pointer text-sm font-normal"
                              >
                                <span className="truncate">
                                  {entry.subjectName}
                                </span>
                                <span className="text-muted-foreground ms-1.5 text-xs">
                                  ×{entry.coefficient}
                                </span>
                                <span
                                  className={cn(
                                    "block truncate text-xs",
                                    blocked
                                      ? "text-warning"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {entry.teacherName ?? t.assessment.noTeacher}
                                </span>
                              </Label>
                              <Input
                                type="date"
                                value={chosen[entry.subjectId] ?? ""}
                                onChange={(event) =>
                                  setChosen({
                                    ...chosen,
                                    [entry.subjectId]: event.target.value,
                                  })
                                }
                                // A date on an unticked subject would be a
                                // promise the generator will not keep.
                                disabled={!checked}
                                dir="ltr"
                                className="h-8 w-36 text-xs"
                                aria-label={`${entry.subjectName} — ${t.assessment.scheduledOn}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {Object.entries(chosen).map(([subjectId, date]) => (
                  <input
                    key={subjectId}
                    type="hidden"
                    name="target"
                    value={`${subjectId}:${date}`}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <SubmitButton disabled={chosenCount === 0}>
                <SparklesIcon />
                {t.assessment.generate}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
