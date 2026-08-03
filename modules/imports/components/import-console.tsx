"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";
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
import { toCsv } from "@/lib/csv";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { modelFileRows } from "@/modules/imports/columns";
import {
  exportStudentsAction,
  previewImportAction,
  runImportAction,
} from "@/modules/imports/actions";
import type { ImportPlan } from "@/modules/imports/service";

/** Rows rendered in the preview. Beyond this the table stops being readable. */
const PREVIEW_LIMIT = 100;

/**
 * The import screen: take a model file, choose a filled one, check, confirm.
 *
 * The three steps are laid out as three cards rather than a wizard because a
 * secretary doing this the second time wants to skip straight to step two, and
 * because a wizard that hides step one is a wizard that gets a file in the wrong
 * shape. Nothing is written until the last button.
 */
export function ImportConsole({ canImport }: { canImport: boolean }) {
  const t = useT();
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [csvText, setCsvText] = React.useState<string | null>(null);
  const [plan, setPlan] = React.useState<ImportPlan | null>(null);
  const [isReading, setIsReading] = React.useState(false);
  const [isImporting, startImporting] = React.useTransition();
  const [isExporting, startExporting] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  function download(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadTemplate() {
    download(toCsv(modelFileRows(t)), "modele-eleves.csv");
  }

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsReading(true);
    setPlan(null);
    setFileName(file.name);

    try {
      const text = await readSpreadsheetText(file);
      setCsvText(text);

      const result = await previewImportAction(text);
      if (result.status === "error") {
        toast.error(result.message);
        setPlan(null);
        return;
      }
      setPlan(result.plan);
    } catch {
      toast.error(t.imports.errors.notCsv);
    } finally {
      setIsReading(false);
    }
  }

  function confirmImport() {
    if (!csvText) return;
    startImporting(async () => {
      const result = await runImportAction(csvText);
      if (result.status === "success") {
        toast.success(result.message ?? "");
        // Cleared on success: leaving the file loaded invites a second click,
        // and the second run would report every pupil as a duplicate.
        setPlan(null);
        setCsvText(null);
        setFileName(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  function exportAll() {
    startExporting(async () => {
      const result = await exportStudentsAction();
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      download(result.csv, result.filename);
    });
  }

  return (
    <div className="grid gap-4">
      {/* ── Export ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t.imports.exportTitle}</CardTitle>
          <CardDescription>{t.imports.exportHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={exportAll} disabled={isExporting}>
            <DownloadIcon />
            {isExporting ? t.imports.exporting : t.imports.exportAction}
          </Button>
        </CardContent>
      </Card>

      {canImport ? (
        <>
          {/* ── 1. The model file ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>{t.imports.stepTemplate}</CardTitle>
              <CardDescription>{t.imports.stepTemplateHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={downloadTemplate}>
                <FileSpreadsheetIcon />
                {t.imports.downloadTemplate}
              </Button>
            </CardContent>
          </Card>

          {/* ── 2. The file ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>{t.imports.stepUpload}</CardTitle>
              <CardDescription>{t.imports.stepUploadHint}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={onFileChosen}
              />
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={isReading || isImporting}
              >
                <UploadIcon />
                {isReading ? t.imports.reading : t.imports.chooseFile}
              </Button>
              {fileName ? (
                <span className="text-muted-foreground text-sm">{fileName}</span>
              ) : null}
            </CardContent>
          </Card>

          {/* ── 3. The preview ────────────────────────────────────────────── */}
          {plan ? <PreviewCard plan={plan} onConfirm={confirmImport} busy={isImporting} /> : null}
        </>
      ) : null}
    </div>
  );
}

function PreviewCard({
  plan,
  onConfirm,
  busy,
}: {
  plan: ImportPlan;
  onConfirm: () => void;
  busy: boolean;
}) {
  const t = useT();
  const blocked = plan.missingColumns.length > 0;
  const shown = plan.rows.slice(0, PREVIEW_LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.imports.stepReview}</CardTitle>
        <CardDescription>{t.imports.stepReviewHint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {blocked ? (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            {interpolate(t.imports.missingColumns, {
              columns: plan.missingColumns.join(", "),
            })}
          </p>
        ) : (
          <>
            {/* The three numbers, before any table. This is the whole answer
                for a secretary whose file is clean. */}
            <div className="flex flex-wrap gap-2">
              <Tally
                tone="ok"
                icon={<CheckCircle2Icon className="size-3.5" />}
                text={interpolate(t.imports.willCreate, { count: plan.counts.create })}
              />
              {plan.counts.skip > 0 ? (
                <Tally
                  tone="warn"
                  icon={<AlertTriangleIcon className="size-3.5" />}
                  text={interpolate(t.imports.willSkip, { count: plan.counts.skip })}
                />
              ) : null}
              {plan.counts.reject > 0 ? (
                <Tally
                  tone="bad"
                  icon={<XCircleIcon className="size-3.5" />}
                  text={interpolate(t.imports.willReject, { count: plan.counts.reject })}
                />
              ) : null}
              <Tally
                tone="muted"
                text={interpolate(t.imports.newFamilies, {
                  count: plan.counts.newFamilies,
                })}
              />
              {/* The count that answers "will the échéancier be there?", which
                  is the question a bursar actually has about this screen. */}
              {plan.counts.enrol > 0 ? (
                <Tally
                  tone="muted"
                  text={interpolate(t.imports.willEnrol, {
                    count: plan.counts.enrol,
                  })}
                />
              ) : null}
            </div>

            {plan.unknownHeaders.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {interpolate(t.imports.ignoredColumns, {
                  columns: plan.unknownHeaders.join(", "),
                })}
              </p>
            ) : null}

            {/* Only the lines that need a decision. A clean file shows none of
                this — scrolling four hundred green rows proves nothing. */}
            {plan.counts.skip + plan.counts.reject > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-xs">
                      <th className="py-2 text-start font-medium">{t.imports.line}</th>
                      <th className="py-2 text-start font-medium">{t.imports.outcome}</th>
                      <th className="py-2 text-start font-medium">{t.imports.pupil}</th>
                      <th className="py-2 text-start font-medium">
                        {t.imports.columns.className}
                      </th>
                      <th className="py-2 text-start font-medium">{t.imports.problem}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown
                      .filter((row) => row.outcome !== "CREATE")
                      .map((row) => (
                        <tr key={row.line} className="border-b last:border-0">
                          <td className="py-2 tabular-nums">{row.line}</td>
                          <td className="py-2">
                            <Badge
                              variant={row.outcome === "REJECT" ? "destructive" : "secondary"}
                            >
                              {row.outcome === "REJECT"
                                ? t.imports.outcomeReject
                                : t.imports.outcomeSkip}
                            </Badge>
                          </td>
                          <td className="py-2">
                            {[row.values.lastName, row.values.firstName]
                              .filter(Boolean)
                              .join(" ") || "—"}
                          </td>
                          {/* What the level and class names resolved to, so a
                              row rejected for something else still shows the
                              seat was understood. */}
                          <td className="text-muted-foreground py-2 whitespace-nowrap">
                            {[row.refs.levelLabel, row.refs.classLabel]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td className="text-muted-foreground py-2">
                            {row.issues.map((issue) => issue.message).join(" · ")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {plan.rows.length > PREVIEW_LIMIT ? (
                  <p className="text-muted-foreground pt-2 text-xs">
                    {interpolate(t.imports.showingFirst, {
                      count: PREVIEW_LIMIT,
                      total: plan.rows.length,
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t.imports.allGood}</p>
            )}

            <div>
              <Button onClick={onConfirm} disabled={busy || plan.counts.create === 0}>
                {busy
                  ? t.imports.importing
                  : interpolate(t.imports.confirm, { count: plan.counts.create })}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Tally({
  tone,
  icon,
  text,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  icon?: React.ReactNode;
  text: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
        tone === "ok" && "bg-success/10 text-success",
        tone === "warn" && "bg-warning/10 text-warning",
        tone === "bad" && "bg-destructive/10 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {icon}
      {text}
    </span>
  );
}

/**
 * Reads a spreadsheet export as text, in whichever encoding Excel used.
 *
 * "Save as CSV" on a French or Arabic Windows writes Windows-1252 or
 * Windows-1256, not UTF-8 — only "CSV UTF-8" does, and it is not the default.
 * Decoding those as UTF-8 turns every accent and every Arabic letter into U+FFFD,
 * which is the single most common way a correct file looks corrupt to the person
 * who prepared it.
 *
 * So: a BOM is trusted outright, and otherwise the UTF-8 reading is checked for
 * replacement characters and the legacy encodings tried in turn. Whichever
 * decoding produces none wins.
 */
async function readSpreadsheetText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // UTF-8 BOM: the file says what it is, and it is right.
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;

  for (const encoding of ["windows-1256", "windows-1252"]) {
    try {
      const decoded = new TextDecoder(encoding).decode(bytes);
      if (!decoded.includes("�")) return decoded;
    } catch {
      // A browser without that legacy decoder; fall through to UTF-8.
    }
  }

  return utf8;
}
