"use client";

import * as React from "react";
import { CheckIcon, UndoIcon, XIcon } from "lucide-react";

import { FormField, controlProps } from "@/components/form/form-field";
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
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { reviewSupplyListAction } from "@/modules/supplies/actions";
import { allowedReviewTransitions } from "@/modules/supplies/enums";
import { SupplyStatusBadge } from "@/modules/supplies/components/supply-status-badge";
import type { SupplyListRow } from "@/modules/supplies/queries";

/**
 * The office's decision on one list.
 *
 * The buttons are drawn from `REVIEW_TRANSITIONS` rather than hard-coded, so
 * the screen can never offer a move the service refuses — a button that fails
 * on press is worse than no button.
 *
 * The reason is only asked for on a refusal. Approving needs no justification,
 * and demanding one is how a required field ends up holding "ok".
 */
export function SupplyReviewDialog({
  list,
  onClose,
}: {
  list: SupplyListRow;
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(
    reviewSupplyListAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: onClose });

  const allowed = allowedReviewTransitions(list.status);

  const LABELS: Record<string, string> = {
    APPROVED: t.supply.approve,
    REJECTED: t.supply.reject,
    SUBMITTED: t.supply.withdraw,
  };
  const ICONS: Record<string, React.ReactNode> = {
    APPROVED: <CheckIcon className="size-4" />,
    REJECTED: <XIcon className="size-4" />,
    SUBMITTED: <UndoIcon className="size-4" />,
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {list.title}
              <SupplyStatusBadge status={list.status} />
            </DialogTitle>
            <DialogDescription>
              {list.className} · {list.levelLabel}
              {list.authorName ? ` · ${t.supply.author} ${list.authorName}` : ""}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={list.id} />

          <div className="grid gap-4 py-4">
            <ul className="grid gap-1 text-sm">
              {list.items.map((item) => (
                <li key={item.id} className="flex items-baseline gap-2">
                  {item.quantity !== null ? (
                    <span className="tabular-nums">{item.quantity}×</span>
                  ) : null}
                  <span>
                    {item.label}
                    {item.notes ? (
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        — {item.notes}
                      </span>
                    ) : null}
                    {!item.isRequired ? (
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        ({t.supply.optional})
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>

            {list.notes ? (
              <p className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 text-xs">
                {list.notes}
              </p>
            ) : null}

            {allowed.includes("REJECTED") ? (
              <FormField
                name="reviewNote"
                label={t.supply.reviewNote}
                hint={t.supply.reviewNoteHint}
                error={state.fieldErrors?.reviewNote}
              >
                <Textarea
                  {...controlProps(
                    "reviewNote",
                    state.fieldErrors?.reviewNote,
                    t.supply.reviewNoteHint,
                  )}
                  rows={2}
                />
              </FormField>
            ) : null}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.close}
            </Button>
            <div className="flex flex-wrap gap-2">
              {allowed.map((status) => (
                <Button
                  key={status}
                  type="submit"
                  name="status"
                  value={status}
                  variant={status === "APPROVED" ? "default" : "outline"}
                  className={
                    status === "REJECTED" ? "text-destructive" : undefined
                  }
                >
                  {ICONS[status]}
                  {LABELS[status] ?? status}
                </Button>
              ))}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
