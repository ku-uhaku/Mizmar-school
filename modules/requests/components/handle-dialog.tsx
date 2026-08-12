"use client";

import { useActionState } from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { handleRequestAction } from "@/modules/requests/actions";
import {
  OFFICE_NOTE_MAX,
  suggestedReadyDate,
  type RequestStatus,
} from "@/modules/requests/enums";
import type { RequestRow } from "@/modules/requests/queries";

/**
 * Answering one request.
 *
 * One dialog for all four moves rather than four, because they differ in two
 * details — whether a day is asked for, and whether the message to the family is
 * optional — and four copies of the same form is four chances for one of them to
 * stop matching what the server enforces.
 *
 * ── What each move asks for ─────────────────────────────────────────────────
 * Accepting *requires* a day: it is the school telling a family when to come,
 * and without one the family is left waiting on a promise with no shape.
 * Refusing *requires* a message: a refusal a parent cannot read is one they will
 * ring about, or file again. The other two ask for neither and offer both.
 *
 * The server checks the same two things (see `handleRequest`) — a Server
 * Function is reachable by direct POST, so this dialog is a convenience, never
 * the gate.
 */
export function HandleDialog({
  open,
  request,
  status,
  onClose,
}: {
  open: boolean;
  request: RequestRow | null;
  /** The move being made. Null while the dialog is closed. */
  status: RequestStatus | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        {request && status ? (
          // Keyed on the pair, so opening it on another request — or on another
          // move for the same one — mounts a fresh form rather than re-seeding
          // the one already there.
          <HandleForm
            key={`${request.id}:${status}`}
            request={request}
            status={status}
            onDone={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const COPY: Record<
  string,
  { title: "acceptTitle" | "markReadyTitle" | "markCollectedTitle" | "rejectTitle"; help: "acceptHelp" | "markReadyHelp" | "markCollectedHelp" | "rejectHelp" }
> = {
  ACCEPTED: { title: "acceptTitle", help: "acceptHelp" },
  READY: { title: "markReadyTitle", help: "markReadyHelp" },
  COLLECTED: { title: "markCollectedTitle", help: "markCollectedHelp" },
  REJECTED: { title: "rejectTitle", help: "rejectHelp" },
};

function HandleForm({
  request,
  status,
  onDone,
}: {
  request: RequestRow;
  status: RequestStatus;
  onDone: () => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState(handleRequestAction, IDLE);
  useActionFeedback(state, { onSuccess: onDone });

  const errors = state.fieldErrors ?? {};
  const copy = COPY[status];

  const needsDate = status === "ACCEPTED";
  const needsNote = status === "REJECTED";

  // The day the office would ordinarily manage, offered as a starting point —
  // the secretary always names it themselves. Falls back to what was already
  // promised, so marking a request ready does not silently drop the date.
  const suggested =
    request.readyAt?.slice(0, 10) ??
    suggestedReadyDate(request.usualDelayDays)?.toISOString().slice(0, 10) ??
    "";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.request[copy.title]}</DialogTitle>
        <DialogDescription>{t.request[copy.help]}</DialogDescription>
      </DialogHeader>

      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="status" value={status} />

        <div className="bg-muted/50 rounded-md p-3 text-sm">
          <p className="font-medium">{request.typeName}</p>
          <p className="text-muted-foreground">{request.studentName}</p>
        </div>

        {needsDate ? (
          <FormField
            name="readyAt"
            label={t.request.readyOn}
            error={errors.readyAt}
            required
          >
            <Input
              {...controlProps("readyAt", errors.readyAt)}
              type="date"
              defaultValue={suggested}
              dir="ltr"
            />
          </FormField>
        ) : (
          // Carried through unchanged on the moves that do not ask for it, so
          // marking a paper ready keeps the day the family was already told.
          <input
            type="hidden"
            name="readyAt"
            value={request.readyAt?.slice(0, 10) ?? ""}
          />
        )}

        <FormField
          name="officeNote"
          label={t.request.noteToFamily}
          hint={needsNote ? undefined : t.request.noteOptional}
          error={errors.officeNote}
          required={needsNote}
        >
          <Textarea
            {...controlProps("officeNote", errors.officeNote)}
            defaultValue={request.officeNote ?? ""}
            maxLength={OFFICE_NOTE_MAX}
            rows={3}
          />
        </FormField>

        <DialogFooter>
          <SubmitButton variant={needsNote ? "destructive" : "default"}>
            {t.request.confirm}
          </SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
