"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  DownloadIcon,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { arrayBufferToBase64, downloadXlsx } from "@/modules/massar/components/xlsx-transfer";
import type { CheckSeverity } from "@/modules/massar/checks";
import {
  adoptMappingsAction,
  exportNotesAction,
  generateControleAction,
  importNotesAction,
  reconcileMassarAction,
} from "@/modules/massar/actions";
import type { MassarPreview } from "@/modules/massar/queries";

/** Beyond this the pupil table stops being something anybody reads. */
const ROW_LIMIT = 60;

export type MassarConsoleProps = {
  assessmentTypes: { id: string; code: string; name: string; maxScore: number }[];
  canImport: boolean;
  canExport: boolean;
  canMap: boolean;
};

/**
 * The MASSAR screen: pick the kind of paper, choose the file, read the checks,
 * choose a direction.
 *
 * ── Why the directions come last and all at once ────────────────────────────
 * The school does not know which way the marks are going until it has seen the
 * file. A sheet that came back from a marking session in MASSAR goes one way; a
 * blank template downloaded to be filled in here goes the other, and they are
 * the same file until you look inside. So the reconciliation is the screen, and
 * the four buttons underneath are what it earns.
 *
 * The workbook is held as base64 in component state and sent again with every
 * action. That is deliberate — see `modules/massar/actions.ts`: the server never
 * takes the browser's word for what matched.
 */
export function MassarConsole({
  assessmentTypes,
  canImport,
  canExport,
  canMap,
}: MassarConsoleProps) {
  const t = useT();
  const [typeId, setTypeId] = React.useState<string>(
    // A NotesCC sheet is contrôle continu; preselecting it is right far more
    // often than not, and it is a select, so being wrong costs one click.
    () => assessmentTypes.find((type) => type.code === "CC")?.id ?? assessmentTypes[0]?.id ?? "",
  );
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileBase64, setFileBase64] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<MassarPreview | null>(null);
  const [isReading, setIsReading] = React.useState(false);
  const [isBusy, startBusy] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  /*
    Reconciling reports expected failures as values, but a Server Action can
    still *throw* — a stale Prisma client after a migration, a workbook that
    trips the parser. A rejected promise here used to leave the screen exactly as
    it was: no preview, no buttons, no message, and nothing to click. An
    unexplained dead end is worse than an error, so the throw is caught and said
    out loud.
  */
  const reconcile = React.useCallback(
    async (base64: string, assessmentTypeId: string) => {
      setIsReading(true);
      try {
        const result = await reconcileMassarAction(base64, assessmentTypeId);
        if (result.status === "error") {
          setPreview(null);
          toast.error(result.message);
          return;
        }
        setPreview(result.preview);
      } catch (error) {
        setPreview(null);
        console.error("MASSAR reconciliation failed:", error);
        toast.error(t.errors.unexpected);
      } finally {
        setIsReading(false);
      }
    },
    [t],
  );

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPreview(null);

    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    setFileBase64(base64);
    await reconcile(base64, typeId);
  }

  // Changing the kind of paper changes which contrôle the file resolves to, so
  // the reconciliation is redone rather than left showing a stale answer.
  function onTypeChanged(next: string) {
    setTypeId(next);
    if (fileBase64) void reconcile(fileBase64, next);
  }

  function run(action: () => Promise<{ status: string; message?: string }>) {
    startBusy(async () => {
      try {
        const state = await action();
        if (state.status === "error") toast.error(state.message ?? "");
        else toast.success(state.message ?? "");
      } catch (error) {
        console.error("MASSAR action failed:", error);
        toast.error(t.errors.unexpected);
      }
      // Re-check afterwards: adopting codes or creating the paper changes what
      // the next reconciliation says, and leaving the old report on screen would
      // invite the same button being pressed twice.
      if (fileBase64) void reconcile(fileBase64, typeId);
    });
  }

  function onExport() {
    if (!fileBase64) return;
    startBusy(async () => {
      try {
        const result = await exportNotesAction(fileBase64, typeId);
        if (result.status === "error") {
          toast.error(result.message);
          return;
        }
        downloadXlsx(result.fileBase64, result.filename);
        toast.success(interpolate(t.massar.exported, { count: result.count }));
      } catch (error) {
        console.error("MASSAR export failed:", error);
        toast.error(t.errors.unexpected);
      }
    });
  }

  const matched = preview?.matched.length ?? 0;
  const rejected = preview
    ? new Set(preview.rows.filter((row) => row.severity === "ERROR").map((row) => row.line)).size
    : 0;
  const ready = preview?.canProceed === true;

  return (
    <div className="space-y-6">
      {/* ── 1. The kind of paper ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t.massar.stepType}</CardTitle>
          <CardDescription>{t.massar.stepTypeHint}</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm space-y-2">
          <Label htmlFor="massar-type">{t.massar.assessmentType}</Label>
          <Select value={typeId} onValueChange={onTypeChanged}>
            <SelectTrigger id="massar-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assessmentTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ── 2. The file ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t.massar.stepUpload}</CardTitle>
          <CardDescription>{t.massar.stepUploadHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onFileChosen}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isReading || isBusy}
          >
            <UploadIcon />
            {t.massar.chooseFile}
          </Button>
          <span className="text-muted-foreground text-sm">
            {isReading ? t.massar.reading : (fileName ?? t.massar.noFile)}
          </span>
        </CardContent>
      </Card>

      {preview && (
        <>
          {/* ── What it is ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>{t.massar.stepReview}</CardTitle>
              <CardDescription>{t.massar.stepReviewHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <Facts
                  title={t.massar.fileSays}
                  rows={[
                    [t.massar.schoolCode, preview.file.schoolCode],
                    [t.massar.className, preview.file.classLabel],
                    [t.massar.level, preview.file.levelLabel],
                    [t.massar.subject, preview.file.subjectLabel],
                    [t.massar.term, preview.file.termLabel],
                    [t.massar.controle, preview.file.assessmentLabel],
                    [t.massar.schoolYear, preview.file.schoolYearLabel],
                    [t.massar.teacher, preview.file.teacherLabel],
                    [t.massar.scale, preview.file.maxScore === null ? null : String(preview.file.maxScore)],
                    [t.massar.pupilCount, String(preview.file.pupilCount)],
                    [t.massar.massarId, preview.file.exportId],
                  ]}
                  empty={t.massar.notOnFile}
                />
                <Facts
                  title={t.massar.youHold}
                  rows={[
                    [t.massar.className, preview.resolved.className],
                    [t.massar.level, preview.resolved.levelName],
                    [t.massar.subject, preview.resolved.subjectName],
                    [t.massar.term, preview.resolved.termName],
                    [t.massar.controle, preview.resolved.assessmentTitle],
                    [
                      t.massar.scale,
                      preview.resolved.assessmentMaxScore === null
                        ? null
                        : String(preview.resolved.assessmentMaxScore),
                    ],
                    [t.massar.pupilCount, String(preview.resolved.rosterSize)],
                  ]}
                  empty={t.massar.notMapped}
                />
              </div>

              {preview.file.unmappedKeys.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {interpolate(t.massar.unmappedKeys, {
                    keys: preview.file.unmappedKeys.join(", "),
                  })}{" "}
                  {t.massar.unmappedHint}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── The checks ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>{t.massar.checksTitle}</CardTitle>
              <CardDescription>
                {preview.blocking.length === 0
                  ? t.massar.allChecksPassed
                  : interpolate(t.massar.blockedBy, { count: preview.blocking.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 text-start font-medium">{t.massar.check}</th>
                    <th className="py-2 text-start font-medium">{t.massar.severity}</th>
                    <th className="py-2 text-start font-medium">{t.massar.expected}</th>
                    <th className="py-2 text-start font-medium">{t.massar.found}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.header.map((check) => (
                    <tr key={check.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{t.massar.checks[check.id]}</td>
                      <td className="py-2">
                        <SeverityBadge severity={check.severity} label={t.massar.severities[check.severity]} />
                      </td>
                      <td className="text-muted-foreground py-2">{check.expected ?? "—"}</td>
                      <td className="py-2">{check.found ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* ── The pupils ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>{t.massar.rowsTitle}</CardTitle>
              <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{interpolate(t.massar.matchedCount, { count: matched })}</span>
                {rejected > 0 && (
                  <span className="text-destructive">
                    {interpolate(t.massar.rejectedCount, { count: rejected })}
                  </span>
                )}
                {preview.missingFromFile.length > 0 && (
                  <span>
                    {interpolate(t.massar.missingCount, {
                      count: preview.missingFromFile.length,
                    })}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 text-start font-medium">{t.massar.line}</th>
                    <th className="py-2 text-start font-medium">{t.massar.massarCode}</th>
                    <th className="py-2 text-start font-medium">{t.massar.pupil}</th>
                    <th className="py-2 text-start font-medium">{t.massar.score}</th>
                    <th className="py-2 text-start font-medium">{t.massar.comment}</th>
                    <th className="py-2 text-start font-medium">{t.massar.problem}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.matched.slice(0, ROW_LIMIT).map((row) => (
                    <tr key={`m-${row.line}`} className="border-b last:border-0">
                      <td className="text-muted-foreground py-2 tabular-nums">{row.line}</td>
                      <td className="py-2 font-mono text-xs">{row.massarCode}</td>
                      <td className="py-2">
                        {row.displayName}
                        {row.adoptsNumber && (
                          <span className="text-muted-foreground ms-2 text-xs">
                            {t.massar.willAdoptNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2 tabular-nums">
                        {row.isAbsent ? t.massar.absent : (row.score ?? "—")}
                      </td>
                      <td className="text-muted-foreground py-2">{row.comment ?? "—"}</td>
                      <td className="py-2" />
                    </tr>
                  ))}
                  {preview.rows
                    .filter((row) => row.severity === "ERROR")
                    .slice(0, ROW_LIMIT)
                    .map((row) => (
                      <tr key={`e-${row.id}-${row.line}-${row.massarCode}`} className="border-b last:border-0">
                        <td className="text-muted-foreground py-2 tabular-nums">
                          {row.line > 0 ? row.line : "—"}
                        </td>
                        <td className="py-2 font-mono text-xs">{row.massarCode || "—"}</td>
                        <td className="py-2">{row.found ?? "—"}</td>
                        <td className="py-2" />
                        <td className="py-2" />
                        <td className="text-destructive py-2">
                          {t.massar.checks[row.id]}
                          {row.expected && (
                            <span className="text-muted-foreground ms-2 text-xs">
                              → {row.expected}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {preview.file.pupilCount > ROW_LIMIT && (
                <p className="text-muted-foreground mt-3 text-xs">
                  {interpolate(t.massar.showingFirst, {
                    count: ROW_LIMIT,
                    total: preview.file.pupilCount,
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── The directions ────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>{t.massar.directionsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Direction
                title={t.massar.generateTitle}
                hint={t.massar.generateHint}
                label={t.massar.generate}
                disabled={!ready || !canImport || isBusy || isReading}
                busy={isBusy}
                busyLabel={t.massar.working}
                onClick={() => run(() => generateControleAction(fileBase64!, typeId))}
              />
              <Direction
                title={t.massar.importTitle}
                hint={t.massar.importHint}
                label={interpolate(t.massar.import, { count: matched })}
                disabled={!ready || !canImport || isBusy || isReading}
                busy={isBusy}
                busyLabel={t.massar.working}
                onClick={() => run(() => importNotesAction(fileBase64!, typeId))}
              />
              <Direction
                title={t.massar.exportTitle}
                hint={t.massar.exportHint}
                label={t.massar.export}
                icon={<DownloadIcon />}
                // Filling the sheet needs a paper to read marks off; blocking
                // checks aside, there is nothing to write until one exists.
                disabled={
                  preview.blocking.length > 0 ||
                  preview.resolved.assessmentId === null ||
                  !canExport ||
                  isBusy ||
                  isReading
                }
                busy={isBusy}
                busyLabel={t.massar.working}
                onClick={onExport}
              />
              <Direction
                title={t.massar.adoptTitle}
                hint={t.massar.adoptHint}
                label={t.massar.adopt}
                disabled={
                  preview.blocking.length > 0 ||
                  (preview.adoptable.length === 0 &&
                    !preview.matched.some((row) => row.adoptsNumber)) ||
                  !canMap ||
                  isBusy ||
                  isReading
                }
                busy={isBusy}
                busyLabel={t.massar.working}
                onClick={() => run(() => adoptMappingsAction(fileBase64!, typeId))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Facts({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: [string, string | null][];
  empty: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <dl className="space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="text-muted-foreground w-32 shrink-0">{label}</dt>
            <dd className={cn("min-w-0 break-words", value === null && "text-muted-foreground italic")}>
              {value ?? empty}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const SEVERITY_STYLES: Record<CheckSeverity, { className: string; Icon: typeof CheckCircle2Icon }> = {
  OK: { className: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", Icon: CheckCircle2Icon },
  ADOPTABLE: { className: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400", Icon: CircleDashedIcon },
  WARNING: { className: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-500", Icon: AlertTriangleIcon },
  ERROR: { className: "border-transparent bg-destructive/10 text-destructive", Icon: XCircleIcon },
};

function SeverityBadge({ severity, label }: { severity: CheckSeverity; label: string }) {
  const { className, Icon } = SEVERITY_STYLES[severity];
  return (
    <Badge variant="outline" className={className}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

function Direction({
  title,
  hint,
  label,
  onClick,
  disabled,
  busy,
  busyLabel,
  icon,
}: {
  title: string;
  hint: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  busyLabel: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground flex-1 text-xs">{hint}</p>
      <Button type="button" onClick={onClick} disabled={disabled} className="w-full">
        {icon}
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}
