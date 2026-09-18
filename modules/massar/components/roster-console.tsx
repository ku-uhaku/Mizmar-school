"use client";

import { DownloadIcon, UploadIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  exportRosterAction,
  importRosterAction,
  previewRosterAction,
  type RosterPreviewResult,
} from "@/modules/massar/actions";
import { arrayBufferToBase64, downloadXlsx } from "@/modules/massar/components/xlsx-transfer";
import type { RosterClassOption } from "@/modules/massar/roster-queries";

type Preview = Extract<RosterPreviewResult, { status: "ok" }>;

/** A household as the review shows it — the rows the importer put under one key. */
type Household = {
  /** The importer's key without the per-row suffix a split adds. */
  key: string;
  label: string;
  pupils: string[];
  existingCode?: string;
};

/**
 * The class-list screen: import a ListEleve, or download one.
 *
 * The file is held as base64 and sent again with every call, for the reason
 * `MassarConsole` gives: the server re-plans from the bytes, so the only thing
 * this component can ask for is a household to be *split* — which can only make
 * the outcome more cautious.
 */
export function RosterConsole({
  classes,
  canImport,
  canExport,
}: {
  classes: RosterClassOption[];
  canImport: boolean;
  canExport: boolean;
}) {
  const t = useT();
  const r = t.massar.roster;

  const [fileBase64, setFileBase64] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [split, setSplit] = React.useState<string[]>([]);
  const [isReading, setIsReading] = React.useState(false);
  const [isImporting, startImporting] = React.useTransition();
  const [isExporting, startExporting] = React.useTransition();
  const [classId, setClassId] = React.useState<string>("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const runPreview = React.useCallback(
    async (base64: string, splitFamilies: string[]) => {
      setIsReading(true);
      try {
        const result = await previewRosterAction(base64, { splitFamilies });
        if (result.status === "error") {
          toast.error(result.message);
          setPreview(null);
          return;
        }
        setPreview(result);
      } finally {
        setIsReading(false);
      }
    },
    [],
  );

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    setFileBase64(base64);
    setSplit([]);
    await runPreview(base64, []);
  }

  async function toggleSplit(key: string) {
    if (!fileBase64) return;
    const next = split.includes(key) ? split.filter((k) => k !== key) : [...split, key];
    setSplit(next);
    await runPreview(fileBase64, next);
  }

  function confirmImport() {
    if (!fileBase64) return;
    startImporting(async () => {
      const result = await importRosterAction(fileBase64, { splitFamilies: split });
      if (result.status === "success") {
        toast.success(result.message ?? "");
        // Cleared, like the pupil import: a second click would report every
        // pupil as already on file.
        setPreview(null);
        setFileBase64(null);
        setSplit([]);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  function exportClass() {
    startExporting(async () => {
      const result = await exportRosterAction(classId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      downloadXlsx(result.fileBase64, result.filename);
      toast.success(interpolate(r.exported, { count: result.count }));
    });
  }

  // Households shared by more than one pupil, or joining one already on file:
  // the only ones whose grouping is a guess worth a second look.
  const households = React.useMemo<Household[]>(() => {
    if (!preview) return [];
    const groups = new Map<string, Household>();
    for (const row of preview.plan.rows) {
      if (row.outcome !== "CREATE" || row.familyKey === "") continue;
      const key = row.familyKey.split("#")[0];
      const name = [row.values.lastName, row.values.firstName].filter(Boolean).join(" ");
      const existing = groups.get(key);
      if (existing) existing.pupils.push(name);
      else
        groups.set(key, {
          key,
          label: row.values.familyName ?? key,
          pupils: [name],
          existingCode: row.existingFamilyCode,
        });
    }
    // A split key is no longer shared by anybody, so it would vanish from the
    // list and take its "Group" button with it — keep those visible.
    for (const key of split) {
      if (!groups.has(key)) groups.set(key, { key, label: key, pupils: [] });
    }
    return [...groups.values()].filter(
      (household) => household.pupils.length > 1 || household.existingCode || split.includes(household.key),
    );
  }, [preview, split]);

  const problems = preview?.plan.rows.filter((row) => row.outcome !== "CREATE") ?? [];

  return (
    <div className="grid gap-4">
      {canImport ? (
        <Card>
          <CardHeader>
            <CardTitle>{r.importTitle}</CardTitle>
            <CardDescription>{r.importHint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={onFileChosen}
              />
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={isReading || isImporting}
              >
                <UploadIcon />
                {isReading ? r.reading : r.chooseFile}
              </Button>
            </div>

            {preview ? (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-5">
                  <Fact label={r.fileSchool} value={preview.file.schoolLabel} />
                  <Fact label={r.fileYear} value={preview.file.schoolYearLabel} />
                  <Fact label={r.fileLevel} value={preview.file.levelLabel} />
                  <Fact label={r.fileClass} value={preview.file.classLabel} />
                  <Fact label={r.filePupils} value={String(preview.file.pupilCount)} />
                </dl>

                {preview.classWillBeCreated ? (
                  <p className="bg-warning/10 text-warning rounded-lg px-3 py-2 text-sm">
                    {interpolate(r.classWillBeCreated, { value: preview.file.classLabel ?? "" })}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Tally tone="ok" text={interpolate(t.imports.willCreate, { count: preview.plan.counts.create })} />
                  {preview.plan.counts.skip > 0 ? (
                    <Tally tone="warn" text={interpolate(t.imports.willSkip, { count: preview.plan.counts.skip })} />
                  ) : null}
                  {preview.plan.counts.reject > 0 ? (
                    <Tally tone="bad" text={interpolate(t.imports.willReject, { count: preview.plan.counts.reject })} />
                  ) : null}
                  <Tally tone="muted" text={interpolate(t.imports.newFamilies, { count: preview.plan.counts.newFamilies })} />
                  {preview.plan.counts.enrol > 0 ? (
                    <Tally tone="muted" text={interpolate(t.imports.willEnrol, { count: preview.plan.counts.enrol })} />
                  ) : null}
                </div>

                {households.length > 0 ? (
                  <div className="grid gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{r.familiesTitle}</h3>
                      <p className="text-muted-foreground text-xs">{r.familiesHint}</p>
                    </div>
                    <ul className="divide-y rounded-lg border">
                      {households.map((household) => (
                        <li
                          key={household.key}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{household.label}</div>
                            <div className="text-muted-foreground text-xs">
                              {household.existingCode
                                ? interpolate(r.attachedTo, { code: household.existingCode })
                                : household.pupils.length > 1
                                  ? interpolate(r.groupedPupils, { count: household.pupils.length })
                                  : r.newHousehold}
                              {household.pupils.length > 0 ? ` — ${household.pupils.join("، ")}` : ""}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isReading || isImporting}
                            onClick={() => toggleSplit(household.key)}
                          >
                            {split.includes(household.key) ? r.group : r.split}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {problems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b text-xs">
                          <th className="py-2 text-start font-medium">{t.imports.line}</th>
                          <th className="py-2 text-start font-medium">{t.imports.outcome}</th>
                          <th className="py-2 text-start font-medium">{t.imports.pupil}</th>
                          <th className="py-2 text-start font-medium">{t.imports.problem}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problems.map((row) => (
                          <tr key={row.line} className="border-b last:border-0">
                            <td className="py-2 tabular-nums">{row.line}</td>
                            <td className="py-2">
                              <Badge variant={row.outcome === "REJECT" ? "destructive" : "secondary"}>
                                {row.outcome === "REJECT" ? t.imports.outcomeReject : t.imports.outcomeSkip}
                              </Badge>
                            </td>
                            <td className="py-2">
                              {[row.values.lastName, row.values.firstName].filter(Boolean).join(" ") || "—"}
                            </td>
                            <td className="text-muted-foreground py-2">
                              {row.issues.map((issue) => issue.message).join(" · ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <div>
                  <Button
                    onClick={confirmImport}
                    disabled={isImporting || isReading || preview.plan.counts.create === 0}
                  >
                    {isImporting ? r.importing : interpolate(r.confirm, { count: preview.plan.counts.create })}
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canExport ? (
        <Card>
          <CardHeader>
            <CardTitle>{r.exportTitle}</CardTitle>
            <CardDescription>{r.exportHint}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-64" aria-label={r.chooseClass}>
                <SelectValue placeholder={r.chooseClass} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportClass} disabled={isExporting || classId === ""}>
              <DownloadIcon />
              {isExporting ? r.exporting : r.exportAction}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function Tally({ tone, text }: { tone: "ok" | "warn" | "bad" | "muted"; text: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium",
        tone === "ok" && "bg-success/10 text-success",
        tone === "warn" && "bg-warning/10 text-warning",
        tone === "bad" && "bg-destructive/10 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {text}
    </span>
  );
}
