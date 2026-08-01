"use client";

import * as React from "react";
import {
  EyeIcon,
  LockIcon,
  MessageSquareTextIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteRemarkAction,
  saveRemarkAction,
} from "@/modules/classroom/actions";
import {
  REMARK_KINDS,
  REMARK_MAX_LENGTH,
  REMARK_TONES,
} from "@/modules/classroom/enums";
import type { PupilOption, RemarkRow } from "@/modules/classroom/queries";
import type { TeachingSlot } from "@/modules/classroom/queries";

/** The tone, worn as colour. The label is always beside it. */
const TONE_STYLES: Record<string, string> = {
  POSITIVE: "border-success/40 text-success",
  NEUTRAL: "",
  CONCERN: "border-destructive/40 text-destructive",
};

/**
 * The carnet: what this teacher has noticed about their pupils.
 *
 * Sharing with the family is a switch that is off by default and only offered
 * to somebody who holds the permission — a teacher must be able to record a
 * concern for their colleagues without it reaching the parents before the school
 * has decided what to say.
 */
export function RemarksManager({
  defaultDate,
  remarks,
  pupils,
  teaching,
  permissions,
}: {
  /**
   * What the date box starts at, already clamped into the school year —
   * today is outside it for two months a year. See lib/school-year.ts.
   */
  defaultDate: string;
  remarks: RemarkRow[];
  pupils: PupilOption[];
  teaching: TeachingSlot[];
  permissions: { canWrite: boolean; canPublish: boolean };
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [mineOnly, setMineOnly] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [deleting, setDeleting] = React.useState<RemarkRow | null>(null);

  const [state, formAction] = React.useActionState(saveRemarkAction, IDLE);
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  const visible = remarks.filter((remark) => {
    if (mineOnly && !remark.isMine) return false;
    if (search === "") return true;
    const haystack =
      `${remark.studentName} ${remark.body} ${remark.classCode}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  // One entry per subject the teacher takes, so a remark can be attributed to
  // the lesson it happened in.
  const subjects = [
    ...new Map(
      teaching.map((slot) => [slot.subjectId, slot.subjectName]),
    ).entries(),
  ];

  const newButton = permissions.canWrite ? (
    <Button onClick={() => setOpen(true)} disabled={pupils.length === 0}>
      <PlusIcon />
      {t.classroom.newRemark}
    </Button>
  ) : undefined;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.classroom.searchRemarks}
          className="w-full sm:max-w-xs"
          aria-label={t.classroom.searchRemarks}
        />
        <div className="flex items-center gap-2">
          <Switch
            id="mine-only"
            checked={mineOnly}
            onCheckedChange={setMineOnly}
          />
          <Label htmlFor="mine-only" className="text-sm font-normal">
            {t.classroom.mineOnly}
          </Label>
        </div>
        <div className="ms-auto">{newButton}</div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<MessageSquareTextIcon className="size-5" />}
              title={t.classroom.noRemarks}
              description={t.classroom.noRemarksHint}
              action={newButton}
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {visible.map((remark) => (
            <li key={remark.id}>
              <Card className="gap-0 py-4">
                <CardContent className="px-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {remark.studentName}
                        <span className="text-muted-foreground ms-1.5 font-normal">
                          {remark.classCode}
                        </span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(remark.occurredOn, locale)}
                        {remark.subjectName ? ` · ${remark.subjectName}` : ""}
                        {remark.authorName && !remark.isMine
                          ? ` · ${remark.authorName}`
                          : ""}
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn("shrink-0", TONE_STYLES[remark.tone])}
                    >
                      {
                        t.classroomOptions.remarkKinds[
                          remark.kind as keyof typeof t.classroomOptions.remarkKinds
                        ]
                      }
                    </Badge>

                    {remark.isVisibleToFamily ? (
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <EyeIcon className="size-3" />
                        {t.classroom.shared}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 gap-1">
                        <LockIcon className="size-3" />
                        {t.classroom.internalOnly}
                      </Badge>
                    )}

                    {remark.isMine && permissions.canWrite ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.common.delete}
                        onClick={() => setDeleting(remark)}
                      >
                        <Trash2Icon />
                      </Button>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm text-pretty">{remark.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>{t.classroom.newRemarkTitle}</DialogTitle>
              <DialogDescription>
                {t.classroom.remarkBodyHint}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <FormField name="enrollmentId" label={t.classroom.remarkAbout}>
                <Select
                  name="enrollmentId"
                  defaultValue={pupils[0]?.enrollmentId}
                >
                  <SelectTrigger id="enrollmentId" className="w-full">
                    <SelectValue placeholder={t.classroom.remarkAbout} />
                  </SelectTrigger>
                  <SelectContent>
                    {pupils.map((pupil) => (
                      <SelectItem
                        key={pupil.enrollmentId}
                        value={pupil.enrollmentId}
                      >
                        {pupil.label} · {pupil.classCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField name="kind" label={t.classroom.remarkKind}>
                  <Select name="kind" defaultValue="BEHAVIOUR">
                    <SelectTrigger id="kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMARK_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {t.classroomOptions.remarkKinds[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField name="tone" label={t.classroom.remarkTone}>
                  <Select name="tone" defaultValue="NEUTRAL">
                    <SelectTrigger id="tone" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMARK_TONES.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {t.classroomOptions.remarkTones[tone]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  name="occurredOn"
                  label={t.classroom.occurredOn}
                  error={state.fieldErrors?.occurredOn}
                >
                  <Input
                    {...controlProps(
                      "occurredOn",
                      state.fieldErrors?.occurredOn,
                    )}
                    type="date"
                    defaultValue={defaultDate}
                    dir="ltr"
                  />
                </FormField>
              </div>

              <FormField name="subjectId" label={t.assessment.subject}>
                <Select name="subjectId" defaultValue="__none__">
                  <SelectTrigger id="subjectId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.common.none}</SelectItem>
                    {subjects.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="body"
                label={t.classroom.remarkBody}
                required
                error={state.fieldErrors?.body}
              >
                <Textarea
                  {...controlProps("body", state.fieldErrors?.body)}
                  rows={4}
                  maxLength={REMARK_MAX_LENGTH}
                />
              </FormField>

              {permissions.canPublish ? (
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    id="isVisibleToFamily"
                    name="isVisibleToFamily"
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="isVisibleToFamily"
                    className="grid cursor-pointer gap-1 font-normal"
                  >
                    <span className="text-sm font-medium">
                      {t.classroom.visibleToFamily}
                    </span>
                    <span className="text-muted-foreground text-xs text-pretty">
                      {t.classroom.visibleToFamilyHint}
                    </span>
                  </Label>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <SubmitButton>{t.common.save}</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(isOpen) => !isOpen && setDeleting(null)}
          title={t.classroom.deleteRemarkTitle}
          description={interpolate(t.classroom.deleteRemarkBody, {
            name: deleting.studentName,
          })}
          action={() => deleteRemarkAction(deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
