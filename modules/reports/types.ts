/**
 * The shape of a report, described once and rendered generically.
 *
 * Pure data — no `server-only`, no `db`, no React. The catalogue crosses to the
 * client, where the screen builds its filter bar and its table from these
 * descriptors; the half that touches the database lives in `runners.server.ts`,
 * keyed by the same `id`. Exactly the split `modules/configuration` uses, and
 * for the same reason: one declaration, two consumers that cannot drift.
 */

/** Which filters a report accepts. Every report takes a date range. */
export type ReportFilterKind =
  /** A level offering — 3AP, or 2BAC sciences maths. */
  | "level"
  /** One class of the year. */
  | "class"
  /** A cycle: primaire, collège, qualifiant. */
  | "cycle"
  /** One member of staff. */
  | "staff"
  /** A fee type — scolarité, transport, cantine. */
  | "feeType";

/** How a column is formatted. The runner returns raw values, never strings. */
export type ReportColumnKind =
  | "text"
  | "number"
  /** Integer centimes, rendered in the school's currency. */
  | "money"
  | "date"
  /** A share, 0–100. */
  | "percent";

export type ReportColumn = {
  key: string;
  /** Key under `report.columns` in the dictionary. */
  labelKey: string;
  kind: ReportColumnKind;
  /**
   * Summed into the totals row. Only ever money or a count — averaging an
   * average across rows is the classic way to publish a wrong figure, so a
   * column that would need weighting is deliberately not totalled.
   */
  total?: boolean;
};

export type ReportDef = {
  /** URL segment and lookup key, e.g. "encaissements". */
  id: string;
  /** Which heading it sits under on the index. */
  section: "vieScolaire" | "finance" | "rh" | "academics";
  /** Key under `report.reports`. */
  labelKey: string;
  /** What it answers, in one sentence — shown under the title. */
  hintKey: string;
  /** The permission a reader needs. Reports carry the *data's* permission. */
  permission: string;
  filters: ReportFilterKind[];
  columns: ReportColumn[];
};

/** One run's answer. Rows are plain records keyed by the columns' `key`. */
export type ReportRow = Record<string, string | number | null>;

export type ReportResult = {
  rows: ReportRow[];
  /** Column key → total, for the columns that declared one. */
  totals: Record<string, number>;
  /** How many rows before any cap — so a truncated report says so. */
  rowCount: number;
  truncated: boolean;
};

export type ReportParams = {
  /** `YYYY-MM-DD`. Inclusive at both ends — see `runReport`. */
  from: string;
  to: string;
  levelOfferingId?: string | null;
  schoolClassId?: string | null;
  cycle?: string | null;
  staffId?: string | null;
  feeTypeId?: string | null;
};
