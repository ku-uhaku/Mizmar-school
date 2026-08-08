"use client";

import { DownloadIcon, PlayIcon, PrinterIcon } from "lucide-react";
import * as React from "react";

import { Combobox } from "@/components/form/combobox";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toCsv } from "@/lib/csv";
import { formatDate, formatMoney, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { ReportFilterChoices } from "@/modules/reports/queries";
import type {
  ReportDef,
  ReportResult,
  ReportRow,
} from "@/modules/reports/types";

const ANY = "__any__";

/**
 * One report: a filter bar, a table, a totals row, and two ways out of it.
 *
 * ── Why the filters live in the URL ─────────────────────────────────────────
 * A report somebody has narrowed to "3AP-B, November" is a thing they will send
 * to a colleague or come back to tomorrow. Held in component state it would
 * survive neither; in the query string the page is a link, the back button
 * works, and the server does the filtering on a fresh request rather than the
 * browser filtering rows it should never have been sent.
 *
 * ── Why the totals row is only some columns ─────────────────────────────────
 * Money and counts sum; an average does not. Averaging a column of averages
 * across rows of different sizes is the classic way to publish a wrong figure,
 * so a column that would need weighting simply declares no total — see
 * `ReportColumn.total`.
 */
export function ReportView({
  report,
  result,
  choices,
  params,
}: {
  report: ReportDef;
  /**
   * Null until the report has actually been asked for.
   *
   * A reporting screen that runs itself on arrival scans the whole year for
   * every visitor, and shows a table nobody chose the shape of. So the first
   * visit draws the filter bar and nothing else, and the query runs when
   * somebody presses the button — see the `ran` flag on the page.
   */
  result: ReportResult | null;
  choices: ReportFilterChoices;
  params: Record<string, string>;
}) {
  const { t, locale } = useI18n();
  const { currencyCode: currency } = useSettings();

  /*
    The three pupil filters cascade: cycle → niveau → classe.

    Held in state rather than read straight off the URL because choosing a cycle
    has to narrow the level list *before* anything is submitted — a manager
    picking "primaire" should not then be offered 2BAC. Clearing a parent clears
    its children, so the form can never post a class that does not belong to the
    level beside it.
  */
  const [cycle, setCycle] = React.useState(params.cycle || ANY);
  const [levelId, setLevelId] = React.useState(params.levelOfferingId || ANY);
  const [classId, setClassId] = React.useState(params.schoolClassId || ANY);

  const levels = React.useMemo(
    () =>
      cycle === ANY
        ? choices.levels
        : choices.levels.filter((level) => level.parentId === cycle),
    [choices.levels, cycle],
  );
  const classes = React.useMemo(
    () =>
      levelId === ANY
        ? // Without a level chosen, still respect the cycle above it.
          choices.classes.filter(
            (row) =>
              cycle === ANY ||
              levels.some((level) => level.id === row.parentId),
          )
        : choices.classes.filter((row) => row.parentId === levelId),
    [choices.classes, levels, levelId, cycle],
  );

  const label = (key: string) =>
    t.report.columns[key as keyof typeof t.report.columns] ?? key;

  /** Raw value → what the cell shows. The runners never format. */
  function render(value: ReportRow[string], kind: string) {
    if (value === null || value === "") return "—";
    switch (kind) {
      case "money":
        return formatMoney(Number(value), locale, currency);
      case "date":
        return formatDate(new Date(String(value)), locale);
      case "percent":
        return `${value}%`;
      default:
        return String(value);
    }
  }

  /**
   * The same rows as a spreadsheet.
   *
   * Built in the browser from what is already on screen rather than fetched
   * again: a second round trip could return different rows than the ones the
   * user is looking at, and an export that disagrees with the screen is worse
   * than no export. Values are raw — a date stays ISO and money stays a number,
   * because a spreadsheet wants to sort them, not read them.
   *
   * ── Serialised by `lib/csv.ts`, not by hand ─────────────────────────────────
   * This used to build the text itself, and quoted a cell without neutralising
   * it. Half of what a report prints is text somebody typed into the app — a
   * pupil's name, a guardian's profession, a note on a dossier — so a name
   * beginning `=` is a formula the moment a secretary double-clicks the
   * download, and quoting does not help because CSV quotes are stripped before
   * the cell is parsed. `toCsv` marks those as text and writes the BOM, which
   * is also what stops every Arabic name arriving mangled.
   */
  function exportCsv() {
    if (!result) return;
    const header = report.columns.map((column) => label(column.labelKey));
    const lines = result.rows.map((row) =>
      report.columns.map((column) => {
        const value = row[column.key];
        if (value === null) return "";
        // Money is stored in centimes; a spreadsheet wants dirhams.
        return String(column.kind === "money" ? Number(value) / 100 : value);
      }),
    );

    const blob = new Blob([toCsv([header, ...lines])], {
      type: "text/csv;charset=utf-8",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${report.id}-${params.from}-${params.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="grid gap-4">
      {/* Filters in one row above the table, and a form so the whole thing is a
        GET — which is what puts the choices in the URL. */}
      <form
        method="get"
        className="bg-card ring-foreground/10 grid gap-3 rounded-xl p-4 ring-1 print:hidden"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t.report.from}>
            <Input type="date" name="from" defaultValue={params.from} dir="ltr" />
          </Field>
          <Field label={t.report.to}>
            <Input type="date" name="to" defaultValue={params.to} dir="ltr" />
          </Field>

          {report.filters.includes("cycle") ? (
            <Field label={t.configuration.fields.cycle}>
              <Combobox
                name="cycle"
                value={cycle}
                onValueChange={(next) => {
                  setCycle(next);
                  // A level of the old cycle would be a contradiction.
                  setLevelId(ANY);
                  setClassId(ANY);
                }}
                emptyOption={{ value: ANY, label: t.report.allCycles }}
                options={choices.cycles.map((row) => ({
                  value: row.id,
                  label: row.label,
                }))}
              />
            </Field>
          ) : null}

          {report.filters.includes("level") ? (
            <Field label={t.report.columns.level}>
              <Combobox
                name="levelOfferingId"
                value={levelId}
                onValueChange={(next) => {
                  setLevelId(next);
                  setClassId(ANY);
                }}
                emptyOption={{ value: ANY, label: t.report.allLevels }}
                options={levels.map((row) => ({
                  value: row.id,
                  label: row.label,
                }))}
              />
            </Field>
          ) : null}

          {report.filters.includes("class") ? (
            <Field label={t.report.columns.class}>
              <Combobox
                name="schoolClassId"
                value={classId}
                onValueChange={setClassId}
                emptyOption={{ value: ANY, label: t.report.allClasses }}
                options={classes.map((row) => ({
                  value: row.id,
                  label: row.label,
                }))}
              />
            </Field>
          ) : null}

          {report.filters.includes("staff") ? (
            <Field label={t.report.columns.employee}>
              <Combobox
                name="staffId"
                defaultValue={params.staffId || ANY}
                emptyOption={{ value: ANY, label: t.report.allStaff }}
                options={choices.staff.map((row) => ({
                  value: row.id,
                  label: row.label,
                }))}
              />
            </Field>
          ) : null}

          {report.filters.includes("feeType") ? (
            <Field label={t.report.columns.category}>
              <Combobox
                name="feeTypeId"
                defaultValue={params.feeTypeId || ANY}
                emptyOption={{ value: ANY, label: t.report.allFees }}
                options={choices.feeTypes.map((row) => ({
                  value: row.id,
                  label: row.label,
                }))}
              />
            </Field>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* What tells the server this was asked for rather than merely
            visited — see the `ran` flag on the page. */}
          <input type="hidden" name="run" value="1" />
          <Button type="submit" size="sm">
            <PlayIcon />
            {t.report.run}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!result || result.rows.length === 0}
          >
            <DownloadIcon />
            {t.report.exportCsv}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={!result || result.rows.length === 0}
          >
            <PrinterIcon />
            {t.print.download}
          </Button>

          <span className="text-muted-foreground ms-auto text-xs">
            {result === null
              ? null
              : result.truncated
              ? interpolate(t.report.truncated, {
                  count: result.rows.length,
                  total: result.rowCount,
                  })
                : interpolate(t.report.rows, { count: result.rowCount })}
          </span>
        </div>
      </form>

      {result === null ? (
        <EmptyState
          title={t.report.notRunYet}
          description={t.report.notRunYetHint}
        />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title={t.report.noRows}
          description={t.report.noRowsHint}
        />
      ) : (
        <div className="bg-card ring-foreground/10 overflow-x-auto rounded-xl ring-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-xs">
                {report.columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "px-3 py-2 font-medium",
                      column.kind === "money" || column.kind === "number"
                        ? "text-end"
                        : "text-start",
                    )}
                  >
                    {label(column.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  {report.columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-3 py-1.5",
                        column.kind === "money" || column.kind === "number"
                          ? "text-end tabular-nums"
                          : "text-start",
                      )}
                    >
                      {render(row[column.key], column.kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            {Object.keys(result.totals).length > 0 ? (
              <tfoot>
                <tr className="bg-muted/50 border-t font-medium">
                  {report.columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-3 py-2",
                        column.kind === "money" || column.kind === "number"
                          ? "text-end tabular-nums"
                          : "text-start",
                      )}
                    >
                      {index === 0
                        ? t.report.totalRow
                        : column.total
                          ? render(result.totals[column.key], column.kind)
                          : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
