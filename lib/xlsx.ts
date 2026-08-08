import "server-only";

import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * Just enough of the OOXML spreadsheet format to read a MASSAR export and hand
 * the same workbook back.
 *
 * ── Why this is hand-rolled ─────────────────────────────────────────────────
 * MASSAR only accepts its own template on re-upload. Every general-purpose
 * library rebuilds the workbook from its own object model on save, which drops
 * exactly the parts the ministry's parser looks for: `workbookProtection`, the
 * printer settings blob, the hidden marker rows, the defined print area. A file
 * that opens perfectly in Excel is then rejected by the portal, and the school
 * has no way to tell why.
 *
 * So nothing here rebuilds anything. The zip is unpacked, one sheet's
 * `<sheetData>` is re-serialised from the rows and cells actually found in it,
 * and every other part is copied through byte for byte. What we did not touch,
 * we did not change.
 *
 * ── What it deliberately does not do ────────────────────────────────────────
 * No formulas, no styles authoring, no ZIP64, no encryption. A NotesCC export is
 * 30 KB of text and this is not a spreadsheet engine.
 *
 * Server-only: `node:zlib` has no browser equivalent, and a workbook has no
 * business in a page bundle.
 */

// ── Zip ──────────────────────────────────────────────────────────────────────

export type ZipEntry = { name: string; data: Buffer };

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const EOCD_HEADER = 0x06054b50;

/** Where the central directory says it ends. Scanned backwards — the record is last. */
function findEndOfCentralDirectory(buffer: Buffer): number {
  // 22 bytes minimum, plus up to 64 KB of zip comment we have to scan past.
  const earliest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_HEADER) return offset;
  }
  throw new Error("Not a zip file: no end-of-central-directory record.");
}

export function readZip(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_HEADER) {
      throw new Error("Corrupt zip: central directory entry expected.");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    // 0xffffffff is the ZIP64 escape. An xlsx that needs it is not a mark sheet.
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error("ZIP64 archives are not supported.");
    }
    if (buffer.readUInt32LE(localOffset) !== LOCAL_HEADER) {
      throw new Error("Corrupt zip: local file header expected.");
    }

    // The local header's own name/extra lengths, not the central one's — they
    // are allowed to differ, and using the wrong pair lands mid-payload.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);

    if (method !== 0 && method !== 8) {
      throw new Error(`Unsupported zip compression method ${method}.`);
    }
    entries.push({
      name,
      data: method === 0 ? Buffer.from(raw) : inflateRawSync(raw),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export function writeZip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(20, 4); // version needed: 2.0, deflate
    local.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    local.writeUInt16LE(8, 8); // deflate
    // No timestamp: a byte-identical input must produce a byte-identical file,
    // otherwise "did the export change?" is unanswerable.
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(CENTRAL_HEADER, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_HEADER, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, directory, eocd]);
}

// ── Cell references ──────────────────────────────────────────────────────────

/** `"G"` → 7, `"AA"` → 27. 1-based, as the A1 notation is. */
export function columnIndex(letters: string): number {
  let index = 0;
  for (const character of letters.toUpperCase()) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index;
}

/** 7 → `"G"`. */
export function columnLetters(index: number): string {
  let letters = "";
  let remaining = index;
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

/** `"G18"` → `{ column: "G", row: 18 }`. */
export function splitRef(ref: string): { column: string; row: number } {
  const match = /^([A-Za-z]+)(\d+)$/.exec(ref);
  if (!match) throw new Error(`Not a cell reference: ${ref}`);
  return { column: match[1].toUpperCase(), row: Number(match[2]) };
}

// ── XML ──────────────────────────────────────────────────────────────────────

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // `_x000D_` is how Excel writes a carriage return inside a shared string.
    .replace(/_x000D_/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function attribute(source: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(source);
  return match ? match[1] : null;
}

// ── Workbook ─────────────────────────────────────────────────────────────────

export type SheetInfo = {
  name: string;
  /** MASSAR hides its `Data` sheet; the metadata sheets matter as much as the visible one. */
  hidden: boolean;
  /** Path inside the zip, e.g. `xl/worksheets/sheet1.xml`. */
  path: string;
};

export type Workbook = {
  entries: ZipEntry[];
  sheets: SheetInfo[];
  /** Resolved shared strings, in index order. */
  sharedStrings: string[];
};

function entryOf(entries: readonly ZipEntry[], name: string): ZipEntry | null {
  return entries.find((entry) => entry.name === name) ?? null;
}

function textOf(entries: readonly ZipEntry[], name: string): string {
  const entry = entryOf(entries, name);
  return entry ? entry.data.toString("utf8") : "";
}

/**
 * Shared strings, flattened.
 *
 * A `<si>` may be one `<t>` or a run of them (`<r><t>…</t></r>` per formatting
 * change). A MASSAR header cell that somebody part-bolded arrives as three runs
 * of one string, so the runs are concatenated rather than the first one taken —
 * otherwise the class code reads as "2AP" and matches nothing.
 */
function parseSharedStrings(xml: string): string[] {
  if (xml === "") return [];
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\s*\/>/g)) {
    const inner = match[1] ?? "";
    let text = "";
    for (const run of inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) {
      text += unescapeXml(run[1]);
    }
    strings.push(text);
  }
  return strings;
}

export function readWorkbook(buffer: Buffer): Workbook {
  const entries = readZip(buffer);
  const workbookXml = textOf(entries, "xl/workbook.xml");
  if (workbookXml === "") throw new Error("Not an xlsx file: xl/workbook.xml is missing.");

  // rId → target, so a sheet's declared order never has to match its file name.
  const relationships = new Map<string, string>();
  for (const match of textOf(entries, "xl/_rels/workbook.xml.rels").matchAll(
    /<Relationship\b([^>]*)\/>/g,
  )) {
    const id = attribute(match[1], "Id");
    const target = attribute(match[1], "Target");
    if (id && target) {
      relationships.set(id, target.replace(/^\/?(xl\/)?/, ""));
    }
  }

  const sheets: SheetInfo[] = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*?)\/>/g)) {
    const name = attribute(match[1], "name");
    const relationshipId = attribute(match[1], "r:id");
    if (!name || !relationshipId) continue;
    const target = relationships.get(relationshipId);
    if (!target) continue;
    sheets.push({
      name: unescapeXml(name),
      hidden: attribute(match[1], "state") !== null,
      path: `xl/${target}`,
    });
  }

  return {
    entries,
    sheets,
    sharedStrings: parseSharedStrings(textOf(entries, "xl/sharedStrings.xml")),
  };
}

// ── Sheets ───────────────────────────────────────────────────────────────────

type ParsedCell = {
  ref: string;
  column: string;
  /** Everything inside `<c …>`, kept verbatim so the style survives a rewrite. */
  attributes: string;
  /** Everything between `<c>` and `</c>`, likewise. */
  body: string;
};

type ParsedRow = {
  index: number;
  attributes: string;
  cells: Map<string, ParsedCell>;
};

type ParsedSheet = {
  /** The sheet XML with `<sheetData>` replaced by a placeholder. */
  shell: string;
  rows: ParsedRow[];
};

const SHEET_DATA_PLACEHOLDER = " SHEETDATA ";

function parseCells(inner: string): Map<string, ParsedCell> {
  const cells = new Map<string, ParsedCell>();
  for (const match of inner.matchAll(/<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g)) {
    const attributes = match[1] ?? match[2] ?? "";
    const ref = attribute(attributes, "r");
    if (!ref) continue;
    cells.set(splitRef(ref).column, {
      ref,
      column: splitRef(ref).column,
      attributes,
      body: match[3] ?? "",
    });
  }
  return cells;
}

function parseSheet(xml: string): ParsedSheet {
  const open = xml.indexOf("<sheetData");
  if (open === -1) return { shell: xml, rows: [] };

  // `<sheetData/>` — an empty sheet, which a freshly downloaded template is not,
  // but a caller should not get a crash for it either.
  const selfClosing = /^<sheetData\s*\/>/.exec(xml.slice(open));
  if (selfClosing) {
    return {
      shell:
        xml.slice(0, open) +
        SHEET_DATA_PLACEHOLDER +
        xml.slice(open + selfClosing[0].length),
      rows: [],
    };
  }

  const close = xml.indexOf("</sheetData>", open);
  const bodyStart = xml.indexOf(">", open) + 1;
  const inner = xml.slice(bodyStart, close);
  const shell =
    xml.slice(0, open) + SHEET_DATA_PLACEHOLDER + xml.slice(close + "</sheetData>".length);

  const rows: ParsedRow[] = [];
  for (const match of inner.matchAll(/<row\b([^>]*?)\/>|<row\b([^>]*?)>([\s\S]*?)<\/row>/g)) {
    const attributes = match[1] ?? match[2] ?? "";
    const reference = attribute(attributes, "r");
    if (!reference) continue;
    rows.push({
      index: Number(reference),
      attributes,
      cells: parseCells(match[3] ?? ""),
    });
  }

  return { shell, rows };
}

function serialiseSheet(sheet: ParsedSheet): string {
  const rows = [...sheet.rows].sort((left, right) => left.index - right.index);
  const body = rows
    .map((row) => {
      const cells = [...row.cells.values()].sort(
        (left, right) => columnIndex(left.column) - columnIndex(right.column),
      );
      if (cells.length === 0) return `<row${row.attributes}/>`;
      const inner = cells
        .map((cell) =>
          cell.body === "" ? `<c${cell.attributes}/>` : `<c${cell.attributes}>${cell.body}</c>`,
        )
        .join("");
      return `<row${row.attributes}>${inner}</row>`;
    })
    .join("");

  return sheet.shell.replace(
    SHEET_DATA_PLACEHOLDER,
    body === "" ? "<sheetData/>" : `<sheetData>${body}</sheetData>`,
  );
}

/**
 * Every non-empty cell of one sheet, as text, keyed by reference (`"G18"`).
 *
 * Hidden rows and hidden columns are read like any other: on a MASSAR export
 * that is where the identifying metadata lives, and skipping them would leave
 * the file unidentifiable.
 */
export function readSheet(workbook: Workbook, sheetName: string): Map<string, string> {
  const info = workbook.sheets.find((sheet) => sheet.name === sheetName);
  if (!info) throw new Error(`No sheet named ${sheetName}.`);

  const { rows } = parseSheet(textOf(workbook.entries, info.path));
  const values = new Map<string, string>();

  for (const row of rows) {
    for (const cell of row.cells.values()) {
      const type = attribute(cell.attributes, "t");
      let text: string | null = null;

      if (type === "inlineStr") {
        let inline = "";
        for (const run of cell.body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) {
          inline += unescapeXml(run[1]);
        }
        text = inline;
      } else {
        // `<f>` may precede `<v>`; take the cached value, never the formula.
        const value = /<v>([\s\S]*?)<\/v>/.exec(cell.body);
        if (value) {
          const raw = unescapeXml(value[1]);
          text = type === "s" ? (workbook.sharedStrings[Number(raw)] ?? "") : raw;
        }
      }

      if (text !== null && text.trim() !== "") values.set(cell.ref, text.trim());
    }
  }

  return values;
}

export type CellEdit = {
  ref: string;
  /** A number writes a numeric cell; a string writes a shared string; null clears it. */
  value: string | number | null;
};

/**
 * Writes cells into one sheet and returns the whole workbook as a new file.
 *
 * ── Why strings go through the shared table ─────────────────────────────────
 * An inline string is valid OOXML and about ten lines less work, but MASSAR's
 * importer is not Excel, and the only string encoding a file it produced has
 * ever contained is `t="s"`. Writing what it already writes is the cheap way to
 * stay inside what it has been tested against. Appreciations repeat across a
 * class, so most edits reuse an index rather than growing the table.
 *
 * A cell missing from the template is inserted in column order, carrying the
 * style of the same column one row above — a mark typed into an unstyled cell
 * prints left-aligned in a right-to-left sheet and looks like a defect.
 */
export function writeSheet(
  workbook: Workbook,
  sheetName: string,
  edits: readonly CellEdit[],
): Buffer {
  const info = workbook.sheets.find((sheet) => sheet.name === sheetName);
  if (!info) throw new Error(`No sheet named ${sheetName}.`);

  const sheet = parseSheet(textOf(workbook.entries, info.path));
  const rowsByIndex = new Map(sheet.rows.map((row) => [row.index, row]));

  const strings = [...workbook.sharedStrings];
  const stringIndex = new Map(strings.map((value, index) => [value, index]));
  let appended = false;
  const intern = (value: string): number => {
    const existing = stringIndex.get(value);
    if (existing !== undefined) return existing;
    strings.push(value);
    stringIndex.set(value, strings.length - 1);
    appended = true;
    return strings.length - 1;
  };

  /** The style of the nearest cell above in the same column, so inserts match. */
  const styleAbove = (column: string, above: number): string => {
    for (let index = above - 1; index > 0; index -= 1) {
      const candidate = rowsByIndex.get(index)?.cells.get(column);
      const style = candidate ? attribute(candidate.attributes, "s") : null;
      if (style) return ` s="${style}"`;
    }
    return "";
  };

  for (const edit of edits) {
    const { column, row: rowIndex } = splitRef(edit.ref);

    let row = rowsByIndex.get(rowIndex);
    if (!row) {
      row = { index: rowIndex, attributes: ` r="${rowIndex}"`, cells: new Map() };
      rowsByIndex.set(rowIndex, row);
      sheet.rows.push(row);
    }

    const existing = row.cells.get(column);
    // Drop any `t` we are about to contradict, and any stale cached formula.
    const base = (existing?.attributes ?? ` r="${edit.ref}"${styleAbove(column, rowIndex)}`)
      .replace(/\st="[^"]*"/, "");

    if (edit.value === null || edit.value === "") {
      row.cells.set(column, { ref: edit.ref, column, attributes: base, body: "" });
      continue;
    }

    if (typeof edit.value === "number") {
      if (!Number.isFinite(edit.value)) throw new Error(`Not a writable number: ${edit.value}`);
      row.cells.set(column, {
        ref: edit.ref,
        column,
        attributes: base,
        body: `<v>${edit.value}</v>`,
      });
      continue;
    }

    row.cells.set(column, {
      ref: edit.ref,
      column,
      attributes: `${base} t="s"`,
      body: `<v>${intern(edit.value)}</v>`,
    });
  }

  const entries = workbook.entries.map((entry) =>
    entry.name === info.path
      ? { name: entry.name, data: Buffer.from(serialiseSheet(sheet), "utf8") }
      : entry,
  );

  if (appended) {
    const xml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">` +
      strings.map((value) => `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`).join("") +
      "</sst>";
    const target = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
    if (target) {
      target.data = Buffer.from(xml, "utf8");
    } else {
      // A template with no strings at all still needs the part declared, or
      // Excel repairs the file on open and MASSAR refuses it outright.
      throw new Error("Workbook has no sharedStrings part to extend.");
    }
  }

  return writeZip(entries);
}
