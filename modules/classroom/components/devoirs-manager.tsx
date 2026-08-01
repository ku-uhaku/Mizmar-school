"use client";

import Link from "next/link";
import * as React from "react";
import { NotebookPenIcon, PlusIcon } from "lucide-react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDLE } from "@/lib/action-state";
import { formatDate, formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { createDevoirAction } from "@/modules/assessments/actions";
import type {
  AssessmentRow,
  AssessmentTypeOption,
  TermOption,
} from "@/modules/assessments/queries";
import type { TeachingSlot } from "@/modules/classroom/queries";

/**
 * The work a teacher has set, and the button that sets more.
 *
 * A devoir is an `Assessment` like a contrôle — same table, same mark sheet, so
 * it counts toward the term average the same way. What differs is who may
 * create one: only the kinds the school has marked teacher-settable appear in
 * the picker, and the action re-checks that on the way in.
 */
export function DevoirsManager({
  defaultDate,
  devoirs,
  teaching,
  terms,
  types,
  canCreate,
}: {
  /**
   * What the date box starts at, already clamped into the school year —
   * today is outside it for two months a year. See lib/school-year.ts.
   */
  defaultDate: string;
  devoirs: AssessmentRow[];
  teaching: TeachingSlot[];
  terms: TermOption[];
  /** Already filtered to `allowTeacherCreate` by the page. */
  types: AssessmentTypeOption[];
  canCreate: boolean;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(createDevoirAction, IDLE);
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  const [pair, setPair] = React.useState(
    teaching[0] ? `${teaching[0].schoolClassId}:${teaching[0].subjectId}` : "",
  );
  const [typeId, setTypeId] = React.useState(types[0]?.id ?? "");
  const [classId, subjectId] = pair.split(":");

  const openTerms = terms.filter((term) => term.status !== "CLOSED");
  const selectedType = types.find((type) => type.id === typeId);

  const canOpen =
    canCreate &&
    teaching.length > 0 &&
    openTerms.length > 0 &&
    types.length > 0;

  const newButton = canOpen ? (
    <Button onClick={() => setOpen(true)}>
      <PlusIcon />
      {t.classroom.newDevoir}
    </Button>
  ) : undefined;

  return (
    <div className="grid gap-4">
      {types.length === 0 && canCreate ? (
        <Card>
          <CardContent className="text-muted-foreground py-4 text-sm text-pretty">
            {t.classroom.noTeacherKinds}
          </CardContent>
        </Card>
      ) : null}

      {devoirs.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<NotebookPenIcon className="size-5" />}
              title={t.classroom.noDevoirs}
              description={t.classroom.noDevoirsHint}
              action={newButton}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">{newButton}</div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {devoirs.map((devoir) => {
              const accounted = devoir.markedCount + devoir.absentCount;
              const done =
                devoir.rosterCount > 0 && accounted >= devoir.rosterCount;

              return (
                <Link
                  key={devoir.id}
                  href={`/assessments/${devoir.id}`}
                  className="group"
                >
                  <Card className="hover:border-primary/40 h-full gap-0 py-4 transition-colors">
                    <CardContent className="px-4">
                      <div className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="mt-1 h-8 w-1 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              devoir.subjectColorHex ??
                              devoir.typeColorHex ??
                              undefined,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {devoir.title}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {devoir.classCode} · {devoir.subjectName}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {devoir.typeCode}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {devoir.scheduledOn
                            ? formatDate(devoir.scheduledOn, locale)
                            : t.assessment.notScheduled}
                        </span>
                        <span
                          className={cn(
                            "tabular-nums",
                            done ? "text-success" : "text-muted-foreground",
                          )}
                        >
                          {interpolate(t.assessment.markedOf, {
                            marked: accounted,
                            total: devoir.rosterCount,
                          })}
                        </span>
                      </div>

                      {devoir.average !== null ? (
                        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                          {t.assessment.average}:{" "}
                          {formatNumber(devoir.average, locale)}/
                          {devoir.maxScore}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>{t.classroom.newDevoirTitle}</DialogTitle>
              <DialogDescription className="text-pretty">
                {t.classroom.newDevoirHint}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* The class and the subject are one choice, because an
                  assignment is one row: a teacher does not pick a class and
                  then a subject they may not teach in it. */}
              <FormField name="pair" label={t.classroom.pickLesson}>
                <Select value={pair} onValueChange={setPair}>
                  <SelectTrigger id="pair" className="w-full">
                    <SelectValue placeholder={t.classroom.pickLesson} />
                  </SelectTrigger>
                  <SelectContent>
                    {teaching.map((slot) => (
                      <SelectItem
                        key={slot.assignmentId}
                        value={`${slot.schoolClassId}:${slot.subjectId}`}
                      >
                        {slot.classCode} · {slot.subjectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <input type="hidden" name="schoolClassId" value={classId ?? ""} />
              <input type="hidden" name="subjectId" value={subjectId ?? ""} />

              <FormField
                name="title"
                label={t.classroom.devoirTitle}
                required
                error={state.fieldErrors?.title}
              >
                <Input
                  {...controlProps("title", state.fieldErrors?.title)}
                  maxLength={160}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="termId" label={t.assessment.term}>
                  <Select name="termId" defaultValue={openTerms[0]?.id}>
                    <SelectTrigger id="termId" className="w-full">
                      <SelectValue />
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
                  <Select
                    name="assessmentTypeId"
                    value={typeId}
                    onValueChange={setTypeId}
                  >
                    <SelectTrigger id="assessmentTypeId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  name="scheduledOn"
                  label={t.classroom.dueOn}
                  error={state.fieldErrors?.scheduledOn}
                >
                  <Input
                    {...controlProps(
                      "scheduledOn",
                      state.fieldErrors?.scheduledOn,
                    )}
                    type="date"
                    defaultValue={defaultDate}
                    dir="ltr"
                  />
                </FormField>

                {/* Defaulted from the chosen kind, and still editable: a
                    teacher may mark one devoir out of 10 without changing what
                    every future devoir is worth. */}
                <FormField
                  name="maxScore"
                  label={t.assessment.maxScore}
                  error={state.fieldErrors?.maxScore}
                >
                  <Input
                    {...controlProps("maxScore", state.fieldErrors?.maxScore)}
                    key={`max-${typeId}`}
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={selectedType?.defaultMaxScore ?? 20}
                    dir="ltr"
                  />
                </FormField>

                <FormField
                  name="coefficient"
                  label={t.assessment.coefficient}
                  error={state.fieldErrors?.coefficient}
                >
                  <Input
                    {...controlProps(
                      "coefficient",
                      state.fieldErrors?.coefficient,
                    )}
                    key={`coef-${typeId}`}
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={selectedType?.defaultCoefficient ?? 1}
                    dir="ltr"
                  />
                </FormField>
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
              <SubmitButton>
                <PlusIcon />
                {t.classroom.newDevoir}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
