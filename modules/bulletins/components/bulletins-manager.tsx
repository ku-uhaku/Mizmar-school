"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState } from "react";
import { CalculatorIcon, PrinterIcon, ScrollTextIcon, SendIcon, UndoIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { Badge } from "@/components/ui/badge";
import { clusterByGroup } from "@/components/form/option-groups";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IDLE } from "@/lib/action-state";
import { formatDateTime, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  computeBulletinsAction,
  publishBulletinsAction,
} from "@/modules/bulletins/actions";
import { PupilPanel } from "@/modules/bulletins/components/pupil-panel";
import type { ClassOption, TermOption } from "@/modules/assessments/queries";
import type { BulletinRow, ClassCouncil } from "@/modules/bulletins/queries";

/**
 * Le conseil de classe: one line per pupil, and the two buttons that matter.
 *
 * The class and the term travel in the URL rather than in component state, for
 * the same reason they do on the contrôles screen: what a class scored is a
 * permission-scoped server read, and keeping the pair in the address means a
 * reload — or a link sent to a colleague sitting in the same council — lands on
 * the same table instead of an empty screen.
 *
 * A plain table rather than the DataTable, deliberately. A council reads its
 * class in class-list order and checks names off against the paper in front of
 * it; sortable columns would let the order drift from the roster they are
 * following, which is worse than useless in a room of eight people.
 */
export function BulletinsManager({
  council,
  classes,
  terms,
  classId,
  termId,
  permissions,
}: {
  council: ClassCouncil | null;
  classes: ClassOption[];
  terms: TermOption[];
  classId: string | null;
  termId: string | null;
  permissions: {
    canCompute: boolean;
    canAppreciate: boolean;
    canCouncil: boolean;
    canPublish: boolean;
  };
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState<BulletinRow | null>(null);

  const [computeState, compute] = useActionState(computeBulletinsAction, IDLE);
  const [publishState, publish] = useActionState(publishBulletinsAction, IDLE);
  useActionFeedback(computeState);
  useActionFeedback(publishState);

  function navigate(next: { classId?: string; termId?: string }) {
    const params = new URLSearchParams();
    const resolvedClass = next.classId ?? classId;
    const resolvedTerm = next.termId ?? termId;
    if (resolvedClass) params.set("class", resolvedClass);
    if (resolvedTerm) params.set("term", resolvedTerm);
    router.push(`/bulletins?${params.toString()}`);
  }

  const ready = classId !== null && termId !== null;
  const rows = council?.rows ?? [];

  // The panel is re-read out of the fresh rows on every render rather than held
  // in state: saving an appreciation refreshes the page, and a copy captured
  // when the sheet opened would keep showing the text the teacher replaced.
  const selected = open ? (rows.find((row) => row.id === open.id) ?? null) : null;

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <span className="text-muted-foreground text-xs">
              {t.bulletin.class}
            </span>
            <Select
              value={classId ?? undefined}
              onValueChange={(value) => navigate({ classId: value })}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder={t.bulletin.pickClass} />
              </SelectTrigger>
              <SelectContent>
                {/* Same picker as the assessments screen, and it reads the same
                  way: headed by cycle, both names. They share `ClassOption`. */}
                {clusterByGroup(
                  classes.map((option) => ({
                    ...option,
                    group: option.cycleName,
                  })),
                ).map((cluster) => (
                  <SelectGroup key={cluster.heading}>
                    <SelectLabel>{cluster.heading}</SelectLabel>
                    {cluster.options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.code} · {option.levelNameLabel}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <span className="text-muted-foreground text-xs">
              {t.bulletin.term}
            </span>
            <Select
              value={termId ?? undefined}
              onValueChange={(value) => navigate({ termId: value })}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder={t.bulletin.pickTerm} />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            {permissions.canCompute && ready ? (
              <form action={compute}>
                <input type="hidden" name="schoolClassId" value={classId} />
                <input type="hidden" name="termId" value={termId} />
                <SubmitButton
                  variant={rows.length === 0 ? "default" : "outline"}
                  size="sm"
                >
                  <CalculatorIcon />
                  {rows.length === 0 ? t.bulletin.compute : t.bulletin.recompute}
                </SubmitButton>
              </form>
            ) : null}

            {permissions.canPublish && ready && council ? (
              <form action={publish}>
                <input type="hidden" name="schoolClassId" value={classId} />
                <input type="hidden" name="termId" value={termId} />
                {/* One action, two directions — see the note on the action. */}
                <input
                  type="hidden"
                  name="intent"
                  value={council.draftCount > 0 ? "publish" : "withdraw"}
                />
                <SubmitButton
                  size="sm"
                  variant={council.draftCount > 0 ? "default" : "outline"}
                  disabled={rows.length === 0}
                >
                  {council.draftCount > 0 ? <SendIcon /> : <UndoIcon />}
                  {council.draftCount > 0
                    ? t.bulletin.publish
                    : t.bulletin.withdraw}
                </SubmitButton>
              </form>
            ) : null}

            {ready && rows.length > 0 ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/print/class/${classId}/bulletins/${termId}`}>
                  <PrinterIcon />
                  {t.bulletin.printClass}
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Both buttons have consequences a label cannot carry: one overwrites
        every figure, the other freezes them and shows them to families. */}
      {ready && (permissions.canCompute || permissions.canPublish) ? (
        <p className="text-muted-foreground -mt-2 text-xs">
          {permissions.canCompute ? t.bulletin.computeHint : null}
          {permissions.canCompute && permissions.canPublish ? " " : null}
          {permissions.canPublish
            ? council && council.draftCount === 0
              ? t.bulletin.withdrawHint
              : t.bulletin.publishHint
            : null}
        </p>
      ) : null}

      {!ready ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<ScrollTextIcon className="size-5" />}
              title={t.bulletin.pickBoth}
              description={t.bulletin.pickBothHint}
            />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<ScrollTextIcon className="size-5" />}
              title={t.bulletin.noBulletins}
              description={
                permissions.canCompute
                  ? t.bulletin.noBulletinsHint
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.bulletin.pupil}</TableHead>
                  <TableHead className="text-end">
                    {t.bulletin.generalAverage}
                  </TableHead>
                  <TableHead className="text-end">{t.bulletin.rank}</TableHead>
                  <TableHead>{t.bulletin.mention}</TableHead>
                  <TableHead className="text-end">
                    {t.bulletin.absences}
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-start font-medium hover:underline"
                        onClick={() => setOpen(row)}
                      >
                        {row.fullName}
                      </button>
                      <p className="text-muted-foreground text-xs" dir="ltr">
                        {row.studentCode}
                      </p>
                    </TableCell>

                    <TableCell className="text-end tabular-nums">
                      {row.generalAverage === null ? (
                        <span className="text-muted-foreground">
                          {t.bulletin.noMark}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "font-medium",
                            // Half the scale is the ordinary pass mark; the
                            // school's own ratio decides the real one, and this
                            // is only a reading aid on a working table.
                            row.generalAverage * 2 < row.outOf &&
                              "text-destructive",
                          )}
                        >
                          {row.generalAverage.toFixed(2)}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-end tabular-nums">
                      {row.rank === null
                        ? t.bulletin.noMark
                        : interpolate(t.bulletin.rankOf, {
                            rank: row.rank,
                            size: row.classSize,
                          })}
                    </TableCell>

                    <TableCell>
                      {row.mention ? (
                        <Badge variant="secondary">
                          {
                            t.bulletinOptions.mentions[
                              row.mention as keyof typeof t.bulletinOptions.mentions
                            ]
                          }
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {t.bulletin.noMention}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-end tabular-nums">
                      {row.absenceCount}
                      {row.unjustifiedAbsenceCount > 0 ? (
                        <span className="text-destructive">
                          {" "}
                          ({row.unjustifiedAbsenceCount})
                        </span>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-2">
                        <Badge
                          variant={row.isPublished ? "default" : "secondary"}
                        >
                          {
                            t.bulletinOptions.statuses[
                              row.status as keyof typeof t.bulletinOptions.statuses
                            ]
                          }
                        </Badge>
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/print/student/${row.studentId}/bulletin/${termId}`}
                          >
                            <PrinterIcon />
                            <span className="sr-only">{t.bulletin.print}</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {council && rows.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          {interpolate(t.bulletin.computedOn, {
            date: formatDateTime(rows[0].computedAt, locale),
          })}
          {" · "}
          {t.bulletin.classAverage}:{" "}
          {rows[0].classAverage === null
            ? t.bulletin.noMark
            : rows[0].classAverage.toFixed(2)}
        </p>
      ) : null}

      <PupilPanel
        bulletin={selected}
        isFinalTerm={council?.isFinalTerm ?? false}
        permissions={permissions}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
      />
    </div>
  );
}
