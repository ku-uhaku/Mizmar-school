"use client";

import * as React from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import { Combobox } from "@/components/form/combobox";
import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { setClassSubjectTeacherAction } from "@/modules/classes/actions";
import type { TeachingGridRow } from "@/modules/classes/queries";

/**
 * The class's programme, one row per subject, with who answers for it.
 *
 * ── Why a grid and not the list of assignments ──────────────────────────────
 * A list of assignments shows what has been given out. The question a head of
 * studies opens this screen with is the opposite one — *what is still
 * unstaffed* — and a vacancy is invisible on a list of what exists. It is also
 * the hole that surfaces weeks later as a contrôle that could not be generated:
 * `generateAssessments` refuses a subject with no teacher rather than writing a
 * paper nobody can mark.
 *
 * So every marked subject of the level gets a row whether or not anybody holds
 * it, and the blanks are the point of the screen.
 *
 * ── Saving on change, with no Save button ───────────────────────────────────
 * Twelve subjects is twelve decisions, and a form that batches them into one
 * submit is a form where a mistyped row loses the other eleven. Each row posts
 * itself; the toast names what happened. The row is disabled while its own
 * request is in flight so a double-click cannot race two writes at one subject.
 *
 * ── Why the call is wrapped in a transition ─────────────────────────────────
 * It used to be a bare `void action().then(...)`, on the reasoning that a
 * transition would let a second click through while the first was in flight.
 * That reasoning was wrong twice over. The row is held by `pending`, which is
 * what disables it — the transition never had anything to do with it. And a
 * Server Function is only an *action* when React invokes it as one: through a
 * form, or from an event handler inside `startTransition`. Called as a plain
 * promise it is an ordinary fetch, so the `refresh()` the action performs is
 * never applied to the client router.
 *
 * The effect was a picker that saved and then snapped back: the write landed,
 * `rows` never changed, and the combobox is driven by `row.teacherId`. Reload
 * the page and the new teacher was there all along.
 *
 * The optimistic copy is what removes the round trip from the picker as well.
 * React reverts it when the transition settles, by which point `refresh()` has
 * delivered the server's own answer — so the value never flickers, and a
 * refusal puts the old holder straight back.
 */
export function TeachingGrid({
  schoolClassId,
  rows,
  teachers,
  canManage,
}: {
  schoolClassId: string;
  rows: TeachingGridRow[];
  teachers: { id: string; label: string }[];
  canManage: boolean;
}) {
  const t = useT();
  const [pending, setPending] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  // What the table draws: the server's rows, with the row being saved already
  // showing its new holder. Keyed on the subject rather than the index — the
  // programme is re-read on every refresh and a row must not follow a position.
  const [shownRows, showTeacher] = React.useOptimistic(
    rows,
    (state, next: { subjectId: string; teacherId: string | null }) =>
      state.map((row) =>
        row.subjectId === next.subjectId
          ? { ...row, teacherId: next.teacherId }
          : row,
      ),
  );

  const options = React.useMemo(
    () => teachers.map((teacher) => ({ value: teacher.id, label: teacher.label })),
    [teachers],
  );

  function save(subjectId: string, teacherId: string | null) {
    setPending(subjectId);
    startTransition(async () => {
      // Before the await, which is the only place an optimistic update counts.
      showTeacher({ subjectId, teacherId });

      const result = await setClassSubjectTeacherAction(
        schoolClassId,
        subjectId,
        teacherId,
      );
      if (result.status === "success") {
        toast.success(result.message ?? t.schoolClass.assignmentSaved);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
      setPending(null);
    });
  }

  // Counted off what is on screen, so clearing the last vacancy clears the
  // warning with it rather than one refresh later.
  const unstaffed = shownRows.filter((row) => row.teacherId === null).length;

  return (
    <div className="grid gap-3">
      {/* Said once, above the table: the count is what somebody came to find
        out, and hunting for blanks down a column is not reading. */}
      {unstaffed > 0 ? (
        <p className="text-warning text-sm">
          {interpolate(t.schoolClass.unstaffedSubjects, { count: unstaffed })}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-4 py-2.5 text-start font-medium">
                {t.schoolClass.subjectColumn}
              </th>
              <th className="px-4 py-2.5 text-start font-medium">
                {t.schoolClass.teacherColumn}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shownRows.map((row) => (
              <tr
                key={row.subjectId}
                className={cn(
                  "hover:bg-muted/30",
                  pending === row.subjectId && "opacity-60",
                )}
              >
                <td className="px-4 py-2 align-top">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">
                      {row.subjectLabel}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {row.subjectCode}
                    </Badge>
                  </div>

                  {/*
                    The components, for context and with no picker of their own:
                    القراءة and الإملاء are the same lesson by the same teacher,
                    and `generateAssessments` resolves a component's teacher by
                    falling back to this row's assignment. Naming them is how a
                    head of studies sees what one choice covers.
                  */}
                  {row.components.length > 0 ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {row.components
                        .map((component) => component.label)
                        .join(" · ")}
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-2 align-top">
                  <div className="flex items-center gap-1">
                    <Combobox
                      options={options}
                      value={row.teacherId ?? ""}
                      onValueChange={(value) =>
                        save(row.subjectId, value || null)
                      }
                      placeholder={t.schoolClass.pickTeacher}
                      disabled={!canManage || pending === row.subjectId}
                      className="flex-1"
                    />
                    {/* Clearing is its own control rather than a row in the
                      list: "nobody" is a decision, not an option to scroll to. */}
                    {canManage && row.teacherId ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.common.reset}
                        disabled={pending === row.subjectId}
                        onClick={() => save(row.subjectId, null)}
                      >
                        <XIcon />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
