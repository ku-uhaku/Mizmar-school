"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  BookOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import {
  deleteTeachingAssignmentAction,
  saveTeachingAssignmentAction,
} from "@/modules/classes/actions";
import type { AssignmentRow, ClassDetail } from "@/modules/classes/queries";

type Choices = {
  subjects: { id: string; code: string; name: string }[];
  teachers: { id: string; label: string }[];
};

/**
 * Who teaches what in this class.
 *
 * Separate from the timetable on purpose: this answers "who is responsible for
 * Maths in 2BAC-SM-B" — what mark entry and report cards read — while the grid
 * answers "when and where". One assignment covers many lessons, which is why
 * assigning a teacher here fills the timetable dialog in rather than the other
 * way round.
 */
export function TeachingPanel({
  schoolClass,
  choices,
  canManage,
}: {
  schoolClass: ClassDetail;
  choices: Choices;
  canManage: boolean;
}) {
  const t = useT();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AssignmentRow | undefined>();
  const [deleting, setDeleting] = React.useState<AssignmentRow | null>(null);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b">
        <div className="min-w-0">
          <CardTitle>{t.schoolClass.teaching}</CardTitle>
          <CardDescription>{t.schoolClass.teachingHint}</CardDescription>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <PlusIcon />
            {t.schoolClass.assignTeacher}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {schoolClass.assignments.length === 0 ? (
          <EmptyState
            icon={<BookOpenIcon className="size-5" />}
            title={t.schoolClass.emptyTeaching}
            description={t.schoolClass.emptyTeachingHint}
            action={
              canManage ? (
                <Button size="sm" onClick={openCreate}>
                  <PlusIcon />
                  {t.schoolClass.assignTeacher}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y">
            {schoolClass.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center gap-3 px-6 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{assignment.subjectName}</span>
                    <Badge variant="outline" className="text-xs" >
                      {assignment.subjectCode}
                    </Badge>
                    {assignment.isPrimary ? (
                      <Badge variant="secondary">
                        {t.schoolClass.primaryBadge}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground truncate text-sm">
                    {assignment.teacherName}
                    {assignment.groupLabel
                      ? ` · ${assignment.groupLabel}`
                      : ` · ${t.schoolClass.wholeClass}`}
                    {assignment.weeklyMinutes
                      ? ` · ${assignment.weeklyMinutes} min`
                      : ""}
                  </p>
                </div>

                {canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.common.openMenu}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(assignment);
                          setDialogOpen(true);
                        }}
                      >
                        <PencilIcon />
                        {t.common.edit}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(assignment)}
                      >
                        <Trash2Icon />
                        {t.common.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {canManage ? (
        <AssignmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          schoolClass={schoolClass}
          choices={choices}
          assignment={editing}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.schoolClass.deleteAssignmentTitle}
          description={interpolate(t.schoolClass.deleteAssignmentBody, {
            name: deleting.teacherName,
            subject: deleting.subjectName,
          })}
          action={() => deleteTeachingAssignmentAction(deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </Card>
  );
}

function AssignmentDialog({
  open,
  onOpenChange,
  schoolClass,
  choices,
  assignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolClass: ClassDetail;
  choices: Choices;
  assignment?: AssignmentRow;
}) {
  const t = useT();
  const [state, formAction] = useActionState(
    saveTeachingAssignmentAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {assignment
              ? t.schoolClass.editAssignment
              : t.schoolClass.assignTeacher}
          </DialogTitle>
          <DialogDescription>{t.schoolClass.teachingHint}</DialogDescription>
        </DialogHeader>

        <form action={formAction} key={assignment?.id ?? "new"}>
          <input
            type="hidden"
            name="schoolClassId"
            value={schoolClass.id}
          />
          {assignment ? (
            <input type="hidden" name="id" value={assignment.id} />
          ) : null}

          <div className="grid gap-5">
            <FormField
              name="subjectId"
              label={t.schoolClass.subject}
              error={errors.subjectId}
              required
            >
              <Select
                name="subjectId"
                defaultValue={assignment?.subjectId ?? choices.subjects[0]?.id}
              >
                <SelectTrigger id="subjectId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {choices.subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              name="teacherId"
              label={t.schoolClass.teacher}
              error={errors.teacherId}
              required
            >
              <Select
                name="teacherId"
                defaultValue={assignment?.teacherId ?? choices.teachers[0]?.id}
              >
                <SelectTrigger id="teacherId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {choices.teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                name="classGroupId"
                label={t.schoolClass.group}
                error={errors.classGroupId}
              >
                <Select
                  name="classGroupId"
                  defaultValue={assignment?.classGroupId ?? "__none__"}
                  disabled={schoolClass.groups.length === 0}
                >
                  <SelectTrigger id="classGroupId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t.schoolClass.wholeClass}
                    </SelectItem>
                    {schoolClass.groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="weeklyMinutes"
                label={t.schoolClass.weeklyMinutes}
                hint={t.schoolClass.weeklyMinutesHint}
                error={errors.weeklyMinutes}
              >
                <Input
                  {...controlProps(
                    "weeklyMinutes",
                    errors.weeklyMinutes,
                    t.schoolClass.weeklyMinutesHint,
                  )}
                  type="number"
                  min={0}
                  max={3000}
                  defaultValue={assignment?.weeklyMinutes ?? ""}
                  dir="ltr"
                />
              </FormField>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="isPrimary">{t.schoolClass.isPrimary}</Label>
                <p className="text-muted-foreground text-xs">
                  {t.schoolClass.isPrimaryHint}
                </p>
              </div>
              <Switch
                id="isPrimary"
                name="isPrimary"
                defaultChecked={assignment?.isPrimary ?? true}
              />
            </div>
          </div>

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.common.cancel}
            </Button>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
