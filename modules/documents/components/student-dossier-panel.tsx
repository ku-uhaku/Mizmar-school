"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { interpolate } from "@/lib/i18n/format";
import { cn, toDateInputValue } from "@/lib/utils";
import {
  recordStudentDocumentAction,
  toggleStudentDocumentAction,
} from "@/modules/documents/actions";
import {
  DOCUMENT_STATUSES,
  acceptsReceivedOn,
  isSettled,
} from "@/modules/documents/enums";
import type { DossierPiece, StudentDossier } from "@/modules/documents/queries";

/**
 * The pupil's dossier: every pièce the school asks for, and where it has got to.
 *
 * Read as a checklist rather than as a list of records, because the question at
 * the guichet is "que manque-t-il ?" and not "what do we hold". So the rows come
 * from the catalogue — a pièce nobody has touched is a row saying *missing*,
 * not an absent row — and the count at the top is the answer to the question.
 *
 * Only the required pièces are counted against completeness; an optional one is
 * shown outstanding and never blocks. That is the same rule the parcours reads,
 * and it lives in `dossierStandingOf` so the two cannot disagree.
 */
export function StudentDossierPanel({
  studentId,
  dossier,
  canManage,
}: {
  studentId: string;
  dossier: StudentDossier;
  canManage: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = React.useState<DossierPiece | null>(null);
  const { standing, pieces } = dossier;

  const statusLabel = (status: string) =>
    t.documentOptions.statuses[
      status as keyof typeof t.documentOptions.statuses
    ] ?? status;

  return (
    <div className="grid gap-4">
      <div className="bg-card ring-foreground/10 flex flex-wrap items-center gap-2 rounded-xl p-4 ring-1">
        <div className="flex-1">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t.document.dossier}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs text-pretty">
            {t.document.dossierSubtitle}
          </p>
        </div>

        {standing.isComplete ? (
          <Badge className="bg-success text-background hover:bg-success">
            <CheckIcon className="size-3" />
            {t.document.complete}
          </Badge>
        ) : (
          <Badge variant="destructive">
            {interpolate(t.document.missingCount, {
              count: standing.missingRequired,
            })}
          </Badge>
        )}

        <Badge variant="secondary" className="tabular-nums">
          {interpolate(t.document.settledOf, {
            settled: standing.settledRequired,
            total: standing.totalRequired,
          })}
        </Badge>

        {/* Reported, never blocking — see the note on DocumentType.isRequired. */}
        {standing.missingOptional > 0 ? (
          <Badge variant="outline">
            {interpolate(t.document.missingOptional, {
              count: standing.missingOptional,
            })}
          </Badge>
        ) : null}
      </div>

      {pieces.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm text-pretty">
          {t.document.noTypes}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {pieces.map((piece) => {
            const settled = isSettled(piece.status);
            return (
              <div
                key={piece.documentTypeId}
                className="flex flex-wrap items-center gap-3 border-b p-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="truncate">{piece.name}</span>
                    {piece.copies !== null ? (
                      <span className="text-muted-foreground text-xs">
                        ({interpolate(t.document.copies, { count: piece.copies })})
                      </span>
                    ) : null}
                    {piece.isRequired ? null : (
                      <Badge variant="outline" className="text-[10px]">
                        {t.document.optional}
                      </Badge>
                    )}
                  </p>

                  {/* The catalogue's own note, then whatever the guichet wrote
                    about this pupil's copy of it. */}
                  {piece.typeNotes ? (
                    <p className="text-muted-foreground truncate text-xs">
                      {piece.typeNotes}
                    </p>
                  ) : null}
                  {piece.notes ? (
                    <p className="text-warning truncate text-xs">{piece.notes}</p>
                  ) : null}
                </div>

                <div className="text-muted-foreground text-end text-xs">
                  {piece.receivedOn ? <p dir="ltr">{piece.receivedOn}</p> : null}
                  {piece.reference ? <p dir="ltr">{piece.reference}</p> : null}
                </div>

                <Badge
                  variant={
                    settled
                      ? "secondary"
                      : piece.isRequired
                        ? "destructive"
                        : "outline"
                  }
                  className={cn(
                    piece.status === "RECEIVED" &&
                      "bg-success text-background hover:bg-success",
                  )}
                >
                  {statusLabel(piece.status)}
                </Badge>

                {canManage ? (
                  <>
                    {/* The guichet's common case, in one click. The button
                      beside it is still the way to refuse, to waive, or to
                      write down a number — a switch has two positions and a
                      dossier has four states. */}
                    <ReceivedSwitch studentId={studentId} piece={piece} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(piece)}
                    >
                      {t.document.record}
                    </Button>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <RecordDialog
          studentId={studentId}
          piece={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * "We have it" / "we do not", inline on the row.
 *
 * On means RECEIVED and nothing else: a pièce refused or waived reads as off,
 * because the school is still not holding the paper. Flipping such a row on is
 * allowed — a family that eventually brings the acte de naissance it was waived
 * from should not need the dialog to say so.
 *
 * Optimistic, and deliberately: the guichet works down a pile of documents with
 * a parent at the counter, and a switch that waits for the round trip before it
 * moves is a switch they click twice. The server's answer still wins — the
 * guess is dropped when the transition ends, so a refusal snaps the row back
 * and the toast says why.
 */
function ReceivedSwitch({
  studentId,
  piece,
}: {
  studentId: string;
  piece: DossierPiece;
}) {
  const t = useT();
  const received = piece.status === "RECEIVED";
  // Same treatment as the star on a report — see FavouriteButton. The guess is
  // discarded when the transition ends, so the row falls back to whatever the
  // refresh actually brought back and a refusal needs no undoing by hand.
  const [optimistic, setOptimistic] = React.useOptimistic(received);
  const [isPending, startTransition] = React.useTransition();

  return (
    <Switch
      checked={optimistic}
      disabled={isPending}
      aria-label={t.document.markReceived}
      onCheckedChange={(next) => {
        startTransition(async () => {
          setOptimistic(next);
          const result = await toggleStudentDocumentAction(
            studentId,
            piece.documentTypeId,
            next,
          );
          if (result.status === "success") {
            toast.success(result.message ?? t.document.recorded);
            return;
          }
          toast.error(result.message ?? t.errors.unexpected);
        });
      }}
    />
  );
}

/** Recording one pièce: where it has got to, and the paperwork that proves it. */
function RecordDialog({
  studentId,
  piece,
  onClose,
}: {
  studentId: string;
  piece: DossierPiece;
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(
    recordStudentDocumentAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: onClose });

  const [status, setStatus] = React.useState(piece.status);
  // Today, for the ordinary case: the paper is being recorded as it crosses the
  // counter. Only ever a starting value — a dossier caught up on in October
  // still needs the date it was actually handed in.
  //
  // Read in local time, never `toISOString().slice(0, 10)`: that reads the *UTC*
  // day, which in Morocco is yesterday for the first hour of every morning. A
  // guichet opening the dialog at 00:30 would have proposed the wrong date.
  const [receivedOn, setReceivedOn] = React.useState(
    piece.receivedOn || toDateInputValue(new Date()),
  );

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{piece.name}</DialogTitle>
            <DialogDescription>
              {piece.typeNotes ?? t.document.dossierSubtitle}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="studentId" value={studentId} />
          <input
            type="hidden"
            name="documentTypeId"
            value={piece.documentTypeId}
          />
          <input type="hidden" name="status" value={status} />

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="document-status">{t.document.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="document-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t.documentOptions.statuses[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shown only where it means something. The server clears it for
              every other status anyway — see `recordDocument` — but offering a
              date on a refusal is inviting somebody to fill it in. */}
            {acceptsReceivedOn(status) ? (
              <div className="grid gap-1.5">
                <Label htmlFor="receivedOn">{t.document.receivedOn}</Label>
                <Input
                  id="receivedOn"
                  name="receivedOn"
                  type="date"
                  dir="ltr"
                  value={receivedOn}
                  onChange={(event) => setReceivedOn(event.target.value)}
                />
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="reference">{t.document.reference}</Label>
              <Input
                id="reference"
                name="reference"
                dir="ltr"
                defaultValue={piece.reference ?? ""}
                placeholder={t.document.referenceHint}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="document-notes">{t.document.notes}</Label>
              <Textarea
                id="document-notes"
                name="notes"
                rows={2}
                defaultValue={piece.notes ?? ""}
                placeholder={t.document.notesHint}
              />
            </div>

            {piece.recordedByName ? (
              <p className="text-muted-foreground text-xs">
                {t.document.recordedBy} · {piece.recordedByName}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton>{t.document.record}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
