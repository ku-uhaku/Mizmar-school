import "server-only";

import { columnLetters, writeZip, type ZipEntry } from "@/lib/xlsx";

/**
 * A one-sheet workbook from rows, for files the app *originates*.
 *
 * `lib/xlsx.ts` only ever edits a workbook somebody else made, because MASSAR
 * rejects anything but its own template. A class list is different: it is
 * downloaded from MASSAR, never uploaded back, so there is no template to
 * protect and nothing to preserve — the smallest valid package is the right
 * thing to write, and it opens in Excel and reads back through `readSheet`.
 *
 * Strings are inline rather than shared: with no other writer to stay
 * compatible with, a string table would be bookkeeping for its own sake.
 */

export type BuiltCell = string | number | null;

export type BuildOptions = {
  /** Right-to-left sheet view, which an Arabic class list needs to read correctly. */
  rightToLeft?: boolean;
  /** Column widths in characters, by position. */
  widths?: readonly number[];
};

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Sheet names may not carry `[]:*?/\` and stop at 31 characters. */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, " ").replace(/"/g, "").trim();
  return (cleaned === "" ? "Sheet1" : cleaned).slice(0, 31);
}

export function buildWorkbook(
  sheetName: string,
  rows: readonly (readonly BuiltCell[])[],
  options: BuildOptions = {},
): Buffer {
  const sheetRows = rows
    .map((cells, rowIndex) => {
      const xml = cells
        .map((value, columnIndex) => {
          if (value === null || value === "") return "";
          const ref = `${columnLetters(columnIndex + 1)}${rowIndex + 1}`;
          if (typeof value === "number") {
            if (!Number.isFinite(value)) throw new Error(`Not a writable number: ${value}`);
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return xml === "" ? "" : `<row r="${rowIndex + 1}">${xml}</row>`;
    })
    .join("");

  const columns = options.widths?.length
    ? `<cols>${options.widths
        .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";

  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"${options.rightToLeft ? ' rightToLeft="1"' : ""}/></sheetViews>` +
    columns +
    `<sheetData>${sheetRows}</sheetData></worksheet>`;

  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `</Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${escapeXml(safeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `</Relationships>`,
      ),
    },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheet) },
  ];

  return writeZip(entries);
}
