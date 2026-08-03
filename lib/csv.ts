/**
 * Reading and writing the CSV a school actually has.
 *
 * Pure data — no `server-only`, no React, no `db`. The browser builds the model
 * file with `toCsv` and the server parses the upload with `parseCsv`, and both
 * halves agreeing is what makes a round trip work: a file exported from the app
 * imports back into it unchanged.
 *
 * ── Why not a library ────────────────────────────────────────────────────────
 * The awkward parts of CSV are the quoting rules and the delimiter, and both are
 * about fifty lines. A dependency here would be larger than the problem and
 * would still need the two Moroccan-specific decisions below wrapped around it.
 */

/**
 * Excel writes the delimiter its *locale* uses, not the one the name promises.
 * A French or Moroccan Windows saves "CSV" with semicolons, an English one with
 * commas, and a secretary has no idea which they have — so the delimiter is
 * sniffed from the header line rather than configured. Tab is included because
 * a paste out of MASSAR into Notepad lands tab-separated.
 */
const CANDIDATE_DELIMITERS = [";", ",", "\t"] as const;

export type CsvDelimiter = (typeof CANDIDATE_DELIMITERS)[number];

/** Byte-order mark. Excel writes one; it must never reach the first header. */
const BOM = "﻿";

/**
 * Picks the delimiter by counting candidates outside quotes on the first line.
 *
 * Counting rather than guessing from the locale: the file may have been mailed
 * in from anywhere, and the header row is the one line guaranteed to hold
 * several separators and no free text with commas in it.
 */
export function sniffDelimiter(text: string): CsvDelimiter {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || text.length);

  let best: CsvDelimiter = ";";
  let bestCount = -1;

  for (const candidate of CANDIDATE_DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      const char = firstLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === candidate && !inQuotes) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/**
 * Splits CSV text into rows of raw cells.
 *
 * Handles the three things a hand-made file always contains: quoted cells with
 * the delimiter inside them, doubled quotes standing for a literal one, and
 * newlines inside a quoted address. Blank lines are dropped — a spreadsheet
 * exported with trailing empty rows is the normal case, not an error worth
 * reporting to a secretary.
 */
export function parseCsv(input: string): string[][] {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const delimiter = sniffDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted cell is one literal quote.
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      // CRLF is one break, not two.
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  // Whatever the file ended on, with or without a trailing newline.
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  return rows.map((cells) => cells.map((value) => value.trim()));
}

/** Quotes a cell only when it would otherwise break the row. */
function escapeCell(value: string, delimiter: CsvDelimiter): string {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Serialises rows to CSV text, ready to be downloaded.
 *
 * Semicolons and CRLF by default because the reader is Excel on a French or
 * Arabic Windows, which is what every school here has. The BOM is not optional:
 * without it Excel reads UTF-8 as Latin-1 and every Arabic name and every
 * accented French one arrives mangled — the single most common way a working
 * export looks broken to the person who opened it.
 */
export function toCsv(
  rows: readonly (readonly string[])[],
  { delimiter = ";" as CsvDelimiter, bom = true } = {},
): string {
  const body = rows
    .map((row) => row.map((cell) => escapeCell(cell, delimiter)).join(delimiter))
    .join("\r\n");
  return bom ? `${BOM}${body}` : body;
}

/**
 * Normalises a header cell so a column is recognised however it was typed.
 *
 * Case, accents, spaces and punctuation all vary between one secretary's file
 * and the next — "Prénom", "PRENOM" and "prenom " are the same column, and
 * refusing the file over it would be the app being pedantic about something it
 * can simply resolve. Arabic is left alone beyond trimming: its letters carry
 * no case and stripping its diacritics would merge distinct headers.
 */
export function normaliseHeader(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      // Latin combining accents only, so Arabic text is untouched.
      .replace(/[̀-ͯ]/g, "")
      /*
        Everything that is not a letter or a digit goes, which is wider than it
        looks and deliberately so. An earlier version stripped only spaces, dots
        and ASCII hyphens, and so failed on the app's own French headers —
        "Père — prénom" carries an em dash, which survived and stopped the column
        matching its alias. Non-breaking spaces out of Excel and the Arabic comma
        would each have been the same bug again. `\p{L}` keeps Arabic letters.
      */
      .replace(/[^\p{L}\p{N}]+/gu, "")
  );
}
