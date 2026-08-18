import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n/types";
import { interpolate } from "@/lib/i18n/format";
import { formatDuration } from "@/modules/timetable/enums";
import type { ProgrammeCoverage } from "@/modules/timetable/queries";

/**
 * What the programme still owes this class, above the grid it is missing from.
 *
 * ── Why it sits here and not in the generator ───────────────────────────────
 * The draw already reports what it could not fit, but inside a dialog that is
 * closed the moment the week is applied — so the one thing the operator has to
 * act on is the one thing that disappears. This says it where the work is done:
 * on the grid, next to the free periods those hours have to go into, and it
 * keeps saying it until they do.
 *
 * Nothing here is remembered from a run. It is read back from the programme (see
 * `loadProgrammeCoverage`), so it is equally right for a week drawn by hand, and
 * it goes away by itself as the hours are placed rather than by being dismissed.
 */
export function ProgrammeGaps({
  coverage,
  t,
}: {
  coverage: ProgrammeCoverage;
  t: Dictionary;
}) {
  if (coverage.gaps.length === 0 && coverage.undeclared.length === 0) {
    return null;
  }

  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>{t.timetable.programmeGaps}</AlertTitle>
      <AlertDescription className="grid gap-2">
        {coverage.gaps.length > 0 ? (
          <>
            <p>{t.timetable.programmeGapsHint}</p>
            <ul className="flex flex-wrap gap-1.5">
              {coverage.gaps.map((gap) => (
                <li key={gap.subjectId}>
                  <Badge variant="outline" className="font-normal">
                    {gap.subjectLabel}
                    <span className="tabular-nums">
                      {formatDuration(gap.missingMinutes)}
                    </span>
                    {/* A subject nobody is affected to cannot be placed at all,
                      by hand or by the generator — the affectation comes first,
                      so the row says which of the two jobs this is. */}
                    {gap.unstaffed ? (
                      <span className="text-warning">
                        {t.timetable.gapUnstaffed}
                      </span>
                    ) : null}
                  </Badge>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {coverage.undeclared.length > 0 ? (
          <p>
            {interpolate(t.timetable.undeclaredHours, {
              subjects: coverage.undeclared
                .map((subject) => subject.subjectLabel)
                .join(", "),
            })}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
