"use client";

import * as React from "react";
import { PlusIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import { saveAppreciationScaleAction } from "@/modules/assessments/actions";
import {
  APPRECIATION_LABEL_MAX,
  DEFAULT_APPRECIATION_BANDS,
  MAX_APPRECIATION_BANDS,
  appreciationFor,
} from "@/modules/assessments/enums";

/**
 * The school's appréciation scale, edited as one list.
 *
 * ── Why the whole scale posts at once ────────────────────────────────────────
 * A rung means nothing on its own: its range runs from its own floor up to the
 * next one's, so moving one moves its neighbour. Saving row by row would show a
 * scale that is briefly wrong, and would trip the unique index halfway through a
 * reshuffle the user thought was a single edit.
 *
 * ── The preview column ───────────────────────────────────────────────────────
 * Each rung shows what it covers out of 20 as it is typed — "de 18 à 20" — with
 * the ceiling derived from the rung above rather than entered. A scale is
 * written in percentages and read in marks, and the gap between the two is
 * where a school puts a rung at 90% meaning to catch 18/20 and finds it does
 * not.
 */

/** Rows carry a client key so a re-ordered list keeps its inputs in place. */
type Row = {
  key: string;
  minPercent: string;
  label: string;
  labelAr: string;
  colorHex: string;
  isActive: boolean;
};

/** What a rung covers is read out of 20, whatever the paper is marked out of. */
const PREVIEW_MAX = 20;

let nextKey = 0;
function keyFor(): string {
  nextKey += 1;
  return `band-${nextKey}`;
}

export function AppreciationScale({
  bands,
  canManage,
}: {
  bands: {
    id: string;
    minPercentBps: number;
    label: string;
    labelAr: string | null;
    colorHex: string | null;
    isActive: boolean;
  }[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction] = React.useActionState(
    saveAppreciationScaleAction,
    IDLE,
  );
  useActionFeedback(state);

  const [rows, setRows] = React.useState<Row[]>(() =>
    bands.map((band) => ({
      key: keyFor(),
      minPercent: String(band.minPercentBps / 100),
      label: band.label,
      labelAr: band.labelAr ?? "",
      colorHex: band.colorHex ?? "",
      isActive: band.isActive,
    })),
  );

  function update(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: keyFor(),
        minPercent: "",
        label: "",
        labelAr: "",
        colorHex: "",
        isActive: true,
      },
    ]);
  }

  /** Back to the wording most Moroccan schools use — see the enums file. */
  function resetToDefaults() {
    setRows(
      DEFAULT_APPRECIATION_BANDS.map((band) => ({
        key: keyFor(),
        minPercent: String(band.minPercentBps / 100),
        label: band.label,
        labelAr: band.labelAr,
        colorHex: band.colorHex,
        isActive: true,
      })),
    );
  }

  // Sorted for reading only — the form posts document order, and the server
  // does not care which order the rungs arrive in.
  const sorted = React.useMemo(
    () =>
      [...rows].sort(
        (a, b) => (Number(b.minPercent) || 0) - (Number(a.minPercent) || 0),
      ),
    [rows],
  );

  /** Two rungs on the same floor is the one mistake the server will refuse. */
  const duplicated = React.useMemo(() => {
    const seen = new Set<string>();
    const clashes = new Set<string>();
    for (const row of rows) {
      const floor = row.minPercent.trim();
      if (floor === "") continue;
      if (seen.has(floor)) clashes.add(floor);
      seen.add(floor);
    }
    return clashes;
  }, [rows]);

  /** Whether every mark has a rung — a scale with no floor at 0 leaves a hole. */
  const coversBottom = rows.some((row) => Number(row.minPercent) === 0);

  return (
    <form action={formAction} className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4">
          <p className="text-muted-foreground text-sm">
            {t.assessment.scaleHelp}
          </p>

          {rows.length === 0 ? (
            <EmptyState title={t.assessment.scaleEmpty} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-28">
                      {t.assessment.scaleFrom}
                    </TableHead>
                    <TableHead className="w-32">
                      {t.assessment.scaleCovers}
                    </TableHead>
                    <TableHead>{t.assessment.scaleLabel}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t.assessment.scaleLabelAr}
                    </TableHead>
                    <TableHead className="w-20">
                      {t.assessment.scaleColour}
                    </TableHead>
                    <TableHead className="w-20">
                      {t.assessment.scaleActive}
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {sorted.map((row, index) => (
                    <BandRow
                      key={row.key}
                      row={row}
                      /* The rung above is what closes this one — see the note
                         on the preview column. Undefined on the top rung,
                         which runs to full marks. */
                      ceilingPercent={ceilingOf(sorted, index)}
                      clashes={duplicated.has(row.minPercent.trim())}
                      canManage={canManage}
                      onChange={update}
                      onRemove={(key) =>
                        setRows((current) =>
                          current.filter((entry) => entry.key !== key),
                        )
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!coversBottom && rows.length > 0 ? (
            <p className="text-muted-foreground text-sm">
              {t.assessment.scaleNoBottom}
            </p>
          ) : null}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                disabled={rows.length >= MAX_APPRECIATION_BANDS}
              >
                <PlusIcon />
                {t.assessment.scaleAdd}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetToDefaults}
              >
                <RotateCcwIcon />
                {t.assessment.scaleReset}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <div className="flex items-center justify-end gap-3">
          {duplicated.size > 0 ? (
            <p className="text-destructive text-sm">
              {t.assessment.scaleDuplicateFloor}
            </p>
          ) : null}
          <SubmitButton size="lg" disabled={duplicated.size > 0}>
            <SaveIcon />
            {t.assessment.scaleSave}
          </SubmitButton>
        </div>
      ) : null}

      <p className="text-muted-foreground text-sm">
        {interpolate(t.assessment.scaleExample, {
          mark: String(PREVIEW_MAX * 0.85),
          max: String(PREVIEW_MAX),
          label:
            appreciationFor(
              PREVIEW_MAX * 0.85,
              PREVIEW_MAX,
              rows
                .filter((row) => row.isActive && row.minPercent.trim() !== "")
                .map((row) => ({
                  minPercentBps: Number(row.minPercent) * 100,
                  label: row.label,
                })),
            )?.label || "—",
        })}
      </p>
    </form>
  );
}

function BandRow({
  row,
  ceilingPercent,
  clashes,
  canManage,
  onChange,
  onRemove,
}: {
  row: Row;
  /** The floor of the rung above, or null when this is the top one. */
  ceilingPercent: number | null;
  clashes: boolean;
  canManage: boolean;
  onChange: (key: string, patch: Partial<Row>) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useI18n();

  const floor = Number(row.minPercent);
  const hasFloor = row.minPercent.trim() !== "" && Number.isFinite(floor);

  // Read out of 20 as the teacher types, so a percentage lands where they meant
  // it to. The top of the band is the next rung's floor, exclusive.
  const covers = hasFloor
    ? `${round(floor * (PREVIEW_MAX / 100))} – ${
        ceilingPercent === null
          ? PREVIEW_MAX
          : round(ceilingPercent * (PREVIEW_MAX / 100))
      }`
    : "—";

  return (
    <TableRow className={row.isActive ? undefined : "opacity-60"}>
      <TableCell>
        {/*
          Every rung must contribute one value to every field, in document
          order — the action reads them back as parallel arrays. Inside a cell
          rather than under the row: a `<tr>` may only hold `<td>`, and a stray
          input would be hoisted out of the table by the parser.
        */}
        <input type="hidden" name="label" value={row.label} />
        <input type="hidden" name="labelAr" value={row.labelAr} />
        <input type="hidden" name="colorHex" value={row.colorHex} />
        <input type="hidden" name="active" value={row.isActive ? "1" : "0"} />

        <div className="flex items-center gap-1">
          <Input
            name="minPercent"
            value={row.minPercent}
            onChange={(event) =>
              onChange(row.key, { minPercent: event.target.value })
            }
            disabled={!canManage}
            type="number"
            step="0.5"
            min={0}
            max={100}
            dir="ltr"
            aria-label={t.assessment.scaleFrom}
            className={clashes ? "border-destructive h-9 w-20" : "h-9 w-20"}
          />
          <span className="text-muted-foreground text-sm">%</span>
        </div>
      </TableCell>

      <TableCell className="text-muted-foreground text-sm tabular-nums" dir="ltr">
        {covers}
      </TableCell>

      <TableCell>
        <Input
          value={row.label}
          onChange={(event) => onChange(row.key, { label: event.target.value })}
          disabled={!canManage}
          maxLength={APPRECIATION_LABEL_MAX}
          aria-label={t.assessment.scaleLabel}
          className="h-9"
        />
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <Input
          value={row.labelAr}
          onChange={(event) =>
            onChange(row.key, { labelAr: event.target.value })
          }
          disabled={!canManage}
          maxLength={APPRECIATION_LABEL_MAX}
          dir="rtl"
          aria-label={t.assessment.scaleLabelAr}
          className="h-9"
        />
      </TableCell>

      <TableCell>
        <Input
          value={row.colorHex || "#000000"}
          onChange={(event) =>
            onChange(row.key, { colorHex: event.target.value })
          }
          disabled={!canManage}
          type="color"
          aria-label={t.assessment.scaleColour}
          className="h-9 w-14 p-1"
        />
      </TableCell>

      <TableCell>
        <Checkbox
          checked={row.isActive}
          disabled={!canManage}
          onCheckedChange={(value) =>
            onChange(row.key, { isActive: value === true })
          }
          aria-label={t.assessment.scaleActive}
        />
      </TableCell>

      <TableCell>
        {canManage ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(row.key)}
            aria-label={t.assessment.scaleRemove}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

/** One decimal at most — 17.5/20 reads, 17.499999999999996 does not. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * What closes a rung: the floor of the one above it, or nothing for the top
 * rung, which runs to full marks. Null too when the rung above has no floor
 * typed yet, since a half-entered row must not silently cap its neighbour at 0.
 */
function ceilingOf(sorted: Row[], index: number): number | null {
  if (index === 0) return null;
  const above = sorted[index - 1];
  if (!above || above.minPercent.trim() === "") return null;
  const value = Number(above.minPercent);
  return Number.isFinite(value) ? value : null;
}
