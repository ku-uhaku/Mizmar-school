"use client";

import {
  EyeIcon,
  LockIcon,
  MessageSquareTextIcon,
  MinusIcon,
  PlusIcon,
  ThumbsUpIcon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
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
import { Textarea } from "@/components/ui/textarea";
import { IDLE, type ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  publishRemarkAction,
  saveRemarkAction,
} from "@/modules/classroom/actions";
import {
  REMARK_KINDS,
  REMARK_MAX_LENGTH,
  REMARK_TONES,
} from "@/modules/classroom/enums";
import type { PupilRemarkRow } from "@/modules/classroom/queries";

/** Tone decides the colour; kind decides the label. See REMARK_TONES. */
const TONE_STYLES: Record<
  string,
  { surface: string; text: string; icon: React.ReactNode }
> = {
  POSITIVE: {
    surface: "border-success/30 bg-success/5",
    text: "text-success",
    icon: <ThumbsUpIcon className="size-3.5" />,
  },
  CONCERN: {
    surface: "border-destructive/30 bg-destructive/5",
    text: "text-destructive",
    icon: <TriangleAlertIcon className="size-3.5" />,
  },
  NEUTRAL: {
    surface: "",
    text: "text-muted-foreground",
    icon: <MinusIcon className="size-3.5" />,
  },
};

/**
 * Le carnet: what teachers have written about this pupil.
 *
 * A timeline rather than a table, because a remark is a paragraph somebody
 * wrote and a table would truncate every one of them into uselessness. Newest
 * first: the question at the desk is almost always "what has happened lately".
 *
 * Praise is coloured as clearly as concern. A carnet that only ever shows
 * problems is one nobody reads to the child's credit — the same reason `tone`
 * exists apart from `kind` at all.
 *
 * ── Written here as well as read ────────────────────────────────────────────
 * This panel used to be read-only, on the reasoning that remarks belong to the
 * espace enseignant. In practice the pupil's file is where somebody is standing
 * when they have something to record — a parent is at the desk, the child is in
 * front of them, and the alternative was to leave, open the carnet, and find
 * the pupil again in a list of several hundred.
 *
 * So both halves are here: writing one, and — for whoever holds the publish
 * code — releasing it to the family. Neither control decides anything on its
 * own. `saveRemarkAction` re-derives the right to write against the signed-in
 * user's own assignments, and downgrades `isVisibleToFamily` to false for
 * anyone without the publish grant whatever the form said.
 */
export function PupilRemarksPanel({
  remarks,
  enrollmentId,
  defaultDate,
  permissions,
}: {
  remarks: PupilRemarkRow[];
  /**
   * The enrolment a new remark is written against. Null when the pupil has
   * none this year — there is nothing to attach an observation to, so the
   * writing half is simply not offered.
   */
  enrollmentId: string | null;
  defaultDate: string;
  permissions: { canWrite: boolean; canPublish: boolean };
}) {
  const { t, locale } = useI18n();
  const [tone, setTone] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const [state, formAction] = React.useActionState(saveRemarkAction, IDLE);
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  const canAdd = permissions.canWrite && enrollmentId !== null;
  const [kind, setKind] = React.useState<string | null>(null);

  const shown = remarks.filter(
    (remark) =>
      (tone === null || remark.tone === tone) &&
      (kind === null || remark.kind === kind),
  );

  const addButton = canAdd ? (
    <Button onClick={() => setOpen(true)}>
      <PlusIcon />
      {t.classroom.newRemark}
    </Button>
  ) : undefined;

  /*
    One return, not two.

    The empty state used to be an early `return`, which meant the dialog had to
    be mounted in both branches — and it was mounted in only one, so on a pupil
    who already had remarks the button toggled a state with nothing listening
    and no modal ever appeared. Folding the empty state into the single tree
    removes the branch that made that possible rather than fixing the instance.
  */
  const isEmpty = remarks.length === 0;

  return (
    <div className="grid gap-4">
      {/* Two small filter rows rather than a DataTable toolbar: there are three
          tones and five kinds, and a dropdown to choose among three is slower
          than the three buttons themselves. Hidden when there is nothing to
          filter — the empty state carries the write button instead. */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          isEmpty && "hidden",
        )}
      >
        <FilterChip
          label={t.common.all}
          active={tone === null && kind === null}
          onClick={() => {
            setTone(null);
            setKind(null);
          }}
        />
        <span className="bg-border h-4 w-px" />
        {REMARK_TONES.map((option) => (
          <FilterChip
            key={option}
            label={t.classroomOptions.remarkTones[option]}
            active={tone === option}
            onClick={() => setTone(tone === option ? null : option)}
          />
        ))}
        <span className="bg-border h-4 w-px" />
        {REMARK_KINDS.map((option) => (
          <FilterChip
            key={option}
            label={t.classroomOptions.remarkKinds[option]}
            active={kind === option}
            onClick={() => setKind(kind === option ? null : option)}
          />
        ))}

        <div className="ms-auto">{addButton}</div>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<MessageSquareTextIcon className="size-5" />}
              title={t.classroom.noRemarksYet}
              description={t.classroom.noRemarksHint}
              action={addButton}
            />
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {t.common.noResults}
          </CardContent>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {shown.map((remark) => {
            const style = TONE_STYLES[remark.tone] ?? TONE_STYLES.NEUTRAL;

            return (
              <li key={remark.id}>
                <Card className={cn("gap-0 py-0", style.surface)}>
                  <CardContent className="grid gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn("flex items-center gap-1.5", style.text)}
                      >
                        {style.icon}
                        <span className="text-xs font-medium">
                          {
                            t.classroomOptions.remarkTones[
                              remark.tone as keyof typeof t.classroomOptions.remarkTones
                            ]
                          }
                        </span>
                      </span>
                      <Badge variant="outline">
                        {
                          t.classroomOptions.remarkKinds[
                            remark.kind as keyof typeof t.classroomOptions.remarkKinds
                          ]
                        }
                      </Badge>
                      {remark.subjectName ? (
                        <Badge variant="secondary">{remark.subjectName}</Badge>
                      ) : null}
                      {remark.isVisibleToFamily ? (
                        <Badge variant="outline" className="gap-1">
                          <EyeIcon className="size-3" />
                          {t.classroom.visibleToFamily}
                        </Badge>
                      ) : (
                        /* Stated on the pupil's file as well as in the carnet:
                          the commonest reading of this panel is a parent at the
                          desk, and "internal" is the difference between a note
                          you may read them and one you may not. */
                        <Badge variant="outline" className="gap-1">
                          <LockIcon className="size-3" />
                          {permissions.canPublish
                            ? t.classroom.awaitingRelease
                            : t.classroom.internalOnly}
                        </Badge>
                      )}
                      <span className="text-muted-foreground ms-auto text-xs whitespace-nowrap">
                        {formatDate(remark.occurredOn, locale)}
                      </span>
                    </div>

                    <p className="text-sm whitespace-pre-line">{remark.body}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {remark.authorName ? (
                        <p className="text-muted-foreground text-xs">
                          {remark.authorName}
                        </p>
                      ) : null}

                      {/* The office's decision, on the screen where the pupil's
                        whole file is open. Only for whoever holds the code —
                        the action re-checks it, so this only decides what is
                        drawn. */}
                      {permissions.canPublish ? (
                        <div className="ms-auto">
                          <ReleaseButton remark={remark} />
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      {/* Mounted once, on the only path there is. */}
      <RemarkDialog
        open={open}
        onOpenChange={setOpen}
        formAction={formAction}
        state={state}
        enrollmentId={enrollmentId}
        defaultDate={defaultDate}
        canPublish={permissions.canPublish}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Releasing one remark to the family, or taking it back.
 *
 * Its own component so each row owns its pending state — a single shared one
 * would grey out every button on the panel while one of them was saving. The
 * same control as the carnet's, deliberately: two spellings of the same
 * decision on two screens is how they come to behave differently.
 */
function ReleaseButton({ remark }: { remark: PupilRemarkRow }) {
  const { t } = useI18n();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant={remark.isVisibleToFamily ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await publishRemarkAction(remark.id, !remark.isVisibleToFamily);
        })
      }
    >
      {remark.isVisibleToFamily ? (
        <>
          <LockIcon />
          {t.classroom.withdrawFromFamily}
        </>
      ) : (
        <>
          <EyeIcon />
          {t.classroom.releaseToFamily}
        </>
      )}
    </Button>
  );
}

/**
 * Writing an observation from the pupil's own file.
 *
 * Shorter than the carnet's form by one field, and on purpose: the pupil is not
 * a choice here — it is whose file is open — so offering a picker of several
 * hundred children would be an invitation to write about the wrong one. The
 * subject is left out for the same reason it is optional on the column: a
 * remark raised from the dossier is about the child rather than about a lesson,
 * and the carnet remains the place to attribute one to a subject.
 */
function RemarkDialog({
  open,
  onOpenChange,
  formAction,
  state,
  enrollmentId,
  defaultDate,
  canPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formAction: (formData: FormData) => void;
  state: ActionState;
  enrollmentId: string | null;
  defaultDate: string;
  canPublish: boolean;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{t.classroom.newRemarkTitle}</DialogTitle>
            <DialogDescription>{t.classroom.remarkBodyHint}</DialogDescription>
          </DialogHeader>

          {/* The pupil, fixed and not chosen. Still re-derived server-side
            against the writer's own assignments — a hidden field is a request
            like any other. */}
          <input type="hidden" name="enrollmentId" value={enrollmentId ?? ""} />

          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField name="kind" label={t.classroom.remarkKind}>
                <Select name="kind" defaultValue="BEHAVIOUR">
                  <SelectTrigger id="kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMARK_KINDS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t.classroomOptions.remarkKinds[option]}
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
                    {REMARK_TONES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t.classroomOptions.remarkTones[option]}
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
                  id="occurredOn"
                  name="occurredOn"
                  type="date"
                  defaultValue={defaultDate}
                  dir="ltr"
                  aria-invalid={Boolean(state.fieldErrors?.occurredOn)}
                />
              </FormField>
            </div>

            <FormField
              name="body"
              label={t.classroom.remarkBody}
              required
              error={state.fieldErrors?.body}
            >
              <Textarea
                id="body"
                name="body"
                rows={4}
                maxLength={REMARK_MAX_LENGTH}
                aria-invalid={Boolean(state.fieldErrors?.body)}
              />
            </FormField>

            {/*
              Publishing as you write, for whoever may. The action downgrades
              this to false for anyone without the code whatever the form said,
              so this only decides what is offered.
            */}
            {canPublish ? (
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
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t.common.cancel}
              </Button>
            </DialogClose>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
