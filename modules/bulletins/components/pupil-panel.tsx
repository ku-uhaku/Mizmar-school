"use client";

import * as React from "react";
import { useActionState } from "react";
import { LockIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  saveAppreciationAction,
  saveCouncilAction,
} from "@/modules/bulletins/actions";
import {
  APPRECIATION_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  COUNCIL_DECISIONS,
  MENTIONS,
  suggestMention,
} from "@/modules/bulletins/enums";
import type { BulletinDetail, BulletinLineRow } from "@/modules/bulletins/queries";

/** A Select's blank choice cannot be `""` in Radix, so "not awarded" needs a value. */
const NONE = "__none__";

/**
 * One pupil's bulletin, opened out of the council's table.
 *
 * Two jobs on one sheet, and they belong together even though they are behind
 * different permissions: the subject lines a teacher writes against, and the
 * mention and decision the council awards. A council reads the first while
 * deciding the second, and putting them on separate screens would mean
 * switching back and forth mid-discussion.
 *
 * Everything is read-only once the bulletin is issued. That is enforced in the
 * service, not here — this only says so, so that somebody is told why the boxes
 * are gone rather than finding them missing.
 */
export function PupilPanel({
  bulletin,
  isFinalTerm,
  permissions,
  onOpenChange,
}: {
  bulletin: BulletinDetail | null;
  isFinalTerm: boolean;
  permissions: { canAppreciate: boolean; canCouncil: boolean };
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <Sheet open={bulletin !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        {bulletin ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {bulletin.fullName}
                <Badge variant={bulletin.isPublished ? "default" : "secondary"}>
                  {
                    t.bulletinOptions.statuses[
                      bulletin.status as keyof typeof t.bulletinOptions.statuses
                    ]
                  }
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {bulletin.termName}
                {bulletin.className ? ` · ${bulletin.className}` : ""}
                {" · "}
                {bulletin.generalAverage === null
                  ? t.bulletin.noMark
                  : `${bulletin.generalAverage.toFixed(2)} ${interpolate(
                      t.bulletin.outOf,
                      { max: bulletin.outOf },
                    )}`}
                {bulletin.rank === null
                  ? ""
                  : ` · ${interpolate(t.bulletin.rankOf, {
                      rank: bulletin.rank,
                      size: bulletin.classSize,
                    })}`}
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-6 px-4 pb-6">
              {bulletin.isPublished ? (
                <Alert>
                  <LockIcon />
                  <AlertDescription>
                    {t.bulletin.publishedLocked}
                  </AlertDescription>
                </Alert>
              ) : null}

              <SubjectLines
                bulletin={bulletin}
                canEdit={permissions.canAppreciate && !bulletin.isPublished}
              />

              <Separator />

              <CouncilForm
                bulletin={bulletin}
                isFinalTerm={isFinalTerm}
                canEdit={permissions.canCouncil && !bulletin.isPublished}
              />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// ── The subjects ─────────────────────────────────────────────────────────────

function SubjectLines({
  bulletin,
  canEdit,
}: {
  bulletin: BulletinDetail;
  canEdit: boolean;
}) {
  const { t } = useI18n();

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">{t.bulletin.subject}</h3>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.bulletin.subject}</TableHead>
            <TableHead className="text-end">{t.bulletin.coefficient}</TableHead>
            <TableHead className="text-end">{t.bulletin.average}</TableHead>
            <TableHead className="text-end">{t.bulletin.marks}</TableHead>
            <TableHead className="text-end">{t.bulletin.rank}</TableHead>
            <TableHead className="text-end">
              {t.bulletin.classAverage}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bulletin.lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                {/* A component is indented under its matière rather than given
                  a row of its own kind — that is how the printed bulletin
                  reads, and the two must not disagree. */}
                <span className={cn(line.parentSubjectId !== null && "ps-4")}>
                  {line.subjectName}
                </span>
                {line.teacherName ? (
                  <p className="text-muted-foreground text-xs">
                    {line.teacherName}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {line.coefficient}
              </TableCell>
              <TableCell className="text-end tabular-nums font-medium">
                {line.average === null
                  ? t.bulletin.noMark
                  : line.average.toFixed(2)}
              </TableCell>
              <TableCell className="text-muted-foreground text-end tabular-nums">
                {line.markCount}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {line.rank ?? t.bulletin.noMark}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {line.classAverage === null
                  ? t.bulletin.noMark
                  : line.classAverage.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="grid gap-3 pt-2">
        {bulletin.lines.map((line) => (
          <AppreciationForm key={line.id} line={line} canEdit={canEdit} />
        ))}
      </div>
    </section>
  );
}

function AppreciationForm({
  line,
  canEdit,
}: {
  line: BulletinLineRow;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveAppreciationAction, IDLE);
  useActionFeedback(state);

  if (!canEdit) {
    return line.appreciation ? (
      <p className="text-sm">
        <span className="font-medium">{line.subjectName}</span> —{" "}
        <span className="text-muted-foreground">{line.appreciation}</span>
      </p>
    ) : null;
  }

  const name = `appreciation-${line.id}`;

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={line.id} />
      <FormField
        name={name}
        label={`${t.bulletin.appreciation} — ${line.subjectName}`}
        error={state.fieldErrors?.appreciation}
      >
        <Textarea
          {...controlProps(name, state.fieldErrors?.appreciation)}
          // The field the action reads is `appreciation`; the id above is only
          // what labels this one of a dozen boxes on the sheet.
          name="appreciation"
          rows={2}
          maxLength={APPRECIATION_MAX_LENGTH}
          defaultValue={line.appreciation ?? ""}
          placeholder={t.bulletin.appreciationHint}
        />
      </FormField>
      <div className="flex justify-end">
        <SubmitButton size="sm" variant="outline">
          {t.common.save}
        </SubmitButton>
      </div>
    </form>
  );
}

// ── The council's decision ───────────────────────────────────────────────────

function CouncilForm({
  bulletin,
  isFinalTerm,
  canEdit,
}: {
  bulletin: BulletinDetail;
  isFinalTerm: boolean;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveCouncilAction, IDLE);
  useActionFeedback(state);

  const suggestion = suggestMention(bulletin.generalAverage, bulletin.outOf);

  if (!canEdit) {
    return (
      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">{t.bulletin.council}</h3>
        <dl className="grid gap-1 text-sm">
          <Read
            label={t.bulletin.mention}
            value={
              bulletin.mention
                ? t.bulletinOptions.mentions[
                    bulletin.mention as keyof typeof t.bulletinOptions.mentions
                  ]
                : t.bulletin.noMention
            }
          />
          {isFinalTerm ? (
            <Read
              label={t.bulletin.decision}
              value={
                bulletin.decision
                  ? t.bulletinOptions.decisions[
                      bulletin.decision as keyof typeof t.bulletinOptions.decisions
                    ]
                  : t.bulletin.noDecision
              }
            />
          ) : null}
          {bulletin.councilComment ? (
            <Read
              label={t.bulletin.councilComment}
              value={bulletin.councilComment}
            />
          ) : null}
          {bulletin.mainTeacherComment ? (
            <Read
              label={t.bulletin.mainTeacherComment}
              value={bulletin.mainTeacherComment}
            />
          ) : null}
        </dl>
      </section>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={bulletin.id} />

      <div>
        <h3 className="text-sm font-semibold">{t.bulletin.council}</h3>
        <p className="text-muted-foreground text-xs">{t.bulletin.councilHint}</p>
      </div>

      <FormField
        name="mention"
        label={t.bulletin.mention}
        hint={
          suggestion
            ? interpolate(t.bulletin.suggested, {
                mention: t.bulletinOptions.mentions[suggestion],
              })
            : undefined
        }
        error={state.fieldErrors?.mention}
      >
        {/* Defaulted to what the council decided, and only to the suggestion
          when they have not decided anything — a mention is awarded, never
          filled in on their behalf. See `suggestMention`. */}
        <Select name="mention" defaultValue={bulletin.mention ?? NONE}>
          <SelectTrigger id="mention" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t.bulletin.noMention}</SelectItem>
            {MENTIONS.map((mention) => (
              <SelectItem key={mention} value={mention}>
                {t.bulletinOptions.mentions[mention]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Asked on the last term only — see the note on Bulletin.decision. */}
      {isFinalTerm ? (
        <FormField
          name="decision"
          label={t.bulletin.decision}
          hint={t.bulletin.decisionHint}
          error={state.fieldErrors?.decision}
        >
          <Select name="decision" defaultValue={bulletin.decision ?? NONE}>
            <SelectTrigger id="decision" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.bulletin.noDecision}</SelectItem>
              {COUNCIL_DECISIONS.map((decision) => (
                <SelectItem key={decision} value={decision}>
                  {t.bulletinOptions.decisions[decision]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : null}

      <FormField
        name="mainTeacherComment"
        label={t.bulletin.mainTeacherComment}
        error={state.fieldErrors?.mainTeacherComment}
      >
        <Textarea
          {...controlProps(
            "mainTeacherComment",
            state.fieldErrors?.mainTeacherComment,
          )}
          rows={2}
          maxLength={COMMENT_MAX_LENGTH}
          defaultValue={bulletin.mainTeacherComment ?? ""}
        />
      </FormField>

      <FormField
        name="councilComment"
        label={t.bulletin.councilComment}
        error={state.fieldErrors?.councilComment}
      >
        <Textarea
          {...controlProps("councilComment", state.fieldErrors?.councilComment)}
          rows={3}
          maxLength={COMMENT_MAX_LENGTH}
          defaultValue={bulletin.councilComment ?? ""}
        />
      </FormField>

      <div className="flex justify-end">
        <SubmitButton size="sm">{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}

function Read({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
