"use client";

import * as React from "react";
import { BackpackIcon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { SupplyListDialog } from "@/modules/supplies/components/supply-list-dialog";
import { SupplyReviewDialog } from "@/modules/supplies/components/supply-review-dialog";
import { SupplyStatusBadge } from "@/modules/supplies/components/supply-status-badge";
import {
  deleteSupplyListAction,
  submitSupplyListAction,
} from "@/modules/supplies/actions";
import { isEditableByAuthor } from "@/modules/supplies/enums";
import type {
  SupplyArticleChoice,
  SupplyListRow,
} from "@/modules/supplies/queries";

export type ClassChoice = { id: string; label: string };
export type SubjectChoice = { id: string; label: string };

/**
 * The listes de fournitures of the year, and what to do about each.
 *
 * Grouped by status rather than by class, because the screen answers two
 * different questions depending on who opens it: the office wants the queue of
 * things waiting on them, and a teacher wants their own drafts. Both are "what
 * needs doing", and sorting by class would bury it.
 */
export function SuppliesManager({
  lists,
  classes,
  subjects,
  articles,
  currentUserId,
  permissions,
}: {
  lists: SupplyListRow[];
  classes: ClassChoice[];
  subjects: SubjectChoice[];
  /** The school's supply catalogue, for the list editor's picker. */
  articles: SupplyArticleChoice[];
  /** Whose lists are "mine" — the author checks are re-made on the server. */
  currentUserId: string;
  permissions: { canWrite: boolean; canReview: boolean; canDelete: boolean };
}) {
  const { t } = useI18n();
  const [editing, setEditing] = React.useState<SupplyListRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [reviewing, setReviewing] = React.useState<SupplyListRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const awaiting = lists.filter((list) => list.status === "SUBMITTED");

  function run(action: () => Promise<{ status: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") toast.success(result.message ?? "");
      else toast.error(result.message ?? t.errors.unexpected);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {t.supply.onlyApprovedVisible}
        </p>
        <div className="flex items-center gap-2">
          {permissions.canReview && awaiting.length > 0 ? (
            <Badge variant="outline" className="text-warning border-warning/40">
              {t.supply.awaitingReview}
              <span className="ms-1.5 tabular-nums">{awaiting.length}</span>
            </Badge>
          ) : null}
          {permissions.canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon className="size-4" />
              {t.supply.newList}
            </Button>
          ) : null}
        </div>
      </div>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BackpackIcon className="size-5" />}
              title={t.supply.noLists}
              description={t.supply.noListsHint}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {lists.map((list) => {
            const isMine = list.authorId === currentUserId;
            // Editing is the author's, and only while the decision is still
            // open — the server re-checks both.
            const canEdit =
              permissions.canWrite && isMine && isEditableByAuthor(list.status);
            const canSubmit = canEdit && list.itemCount > 0;

            return (
              <Card key={list.id}>
                <CardContent className="grid gap-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{list.title}</h3>
                        <SupplyStatusBadge status={list.status} />
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {list.className} · {list.levelLabel}
                        {list.subjectName ? ` · ${list.subjectName}` : ""}
                        {" · "}
                        {interpolate(t.supply.itemCount, {
                          count: list.itemCount,
                        })}
                        {list.authorName
                          ? ` · ${t.supply.author} ${list.authorName}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(list)}
                        >
                          {t.common.edit}
                        </Button>
                      ) : null}
                      {canSubmit ? (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(() => submitSupplyListAction(list.id))
                          }
                        >
                          <SendIcon className="size-4" />
                          {t.supply.submit}
                        </Button>
                      ) : null}
                      {permissions.canReview ? (
                        <Button
                          size="sm"
                          variant={
                            list.status === "SUBMITTED" ? "default" : "outline"
                          }
                          onClick={() => setReviewing(list)}
                        >
                          {list.status === "SUBMITTED"
                            ? t.supply.approve
                            : t.common.close}
                        </Button>
                      ) : null}
                      {permissions.canDelete ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          aria-label={t.common.delete}
                          className="text-destructive"
                          onClick={() =>
                            run(() => deleteSupplyListAction(list.id))
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* The refusal reason belongs to the teacher who has to act
                    on it, so it sits on the card rather than in a dialog. */}
                  {list.status === "REJECTED" && list.reviewNote ? (
                    <p className="text-destructive bg-destructive/5 rounded-md px-3 py-2 text-xs">
                      {list.reviewNote}
                    </p>
                  ) : null}

                  {list.items.length > 0 ? (
                    <ul className="grid gap-1 text-sm sm:grid-cols-2">
                      {list.items.map((item) => (
                        <li
                          key={item.id}
                          className={cn(
                            "flex items-baseline gap-2",
                            !item.isRequired && "text-muted-foreground",
                          )}
                        >
                          {item.quantity !== null ? (
                            <span className="tabular-nums">
                              {item.quantity}×
                            </span>
                          ) : null}
                          <span className="min-w-0">
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
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {creating || editing ? (
        <SupplyListDialog
          key={editing?.id ?? "new"}
          list={editing}
          classes={classes}
          subjects={subjects}
          articles={articles}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      {reviewing ? (
        <SupplyReviewDialog
          list={reviewing}
          onClose={() => setReviewing(null)}
        />
      ) : null}
    </div>
  );
}
