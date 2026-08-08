import { describe, expect, it } from "vitest";

import {
  parseBoolean,
  parseEmail,
  parseGender,
  parseImportDate,
  parsePhone,
  parseText,
} from "@/modules/imports/parse";

/**
 * Reading a file a school assembled by hand.
 *
 * These functions are deliberately forgiving on the way in and strict on the
 * way out, because a spreadsheet built over a fortnight is inconsistent by
 * nature — three date formats, "M" in one row and "Masculin" in the next — and
 * refusing it row by row means the school never finishes the import.
 *
 * The line they must not cross is guessing. A birth date read wrong is worse
 * than a birth date rejected: nobody checks four hundred of them afterwards, and
 * the error surfaces years later on a certificate.
 */

// ── Dates ────────────────────────────────────────────────────────────────────

describe("parseImportDate", () => {
  const iso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

  it("reads the ISO form our own export writes", () => {
    expect(iso(parseImportDate("2012-09-15"))).toBe("2012-09-15");
    expect(iso(parseImportDate("2012-9-5"))).toBe("2012-09-05");
  });

  it("reads a French file day-first, whatever the separator", () => {
    // `new Date("15/09/2012")` is invalid and `new Date("09/15/2012")` is
    // September — so a French file would import silently wrong on every row
    // where the day is 12 or less.
    for (const written of ["15/09/2012", "15.09.2012", "15-09-2012"]) {
      expect(iso(parseImportDate(written)), written).toBe("2012-09-15");
    }
  });

  it("reads an ambiguous date day-first rather than guessing", () => {
    // 05/09 is the fifth of September in every file a Moroccan school produces.
    expect(iso(parseImportDate("05/09/2012"))).toBe("2012-09-05");
  });

  it("expands a two-digit year into a birth date, never a future one", () => {
    expect(iso(parseImportDate("15/09/12"))).toBe("2012-09-15");
    expect(iso(parseImportDate("15/09/85"))).toBe("1985-09-15");
  });

  it("reads the Excel serial a converter leaves behind", () => {
    // Day 1 is 1900-01-01, and Excel's deliberate 1900 leap-year bug means
    // counting from 1899-12-30.
    expect(iso(parseImportDate("41167"))).toBe("2012-09-15");
    expect(iso(parseImportDate("40909"))).toBe("2012-01-01");
  });

  it("reads a serial and the same date written out to the same day", () => {
    // The two forms turn up in one file, because a converter only mangles the
    // cells that were formatted as dates.
    expect(iso(parseImportDate("41167"))).toBe(iso(parseImportDate("15/09/2012")));
  });

  it("does not read a stray small number as a date in 1900", () => {
    expect(parseImportDate("42")).toBeNull();
    expect(parseImportDate("7")).toBeNull();
  });

  it("does not read a large number as a date far in the future", () => {
    expect(parseImportDate("999999")).toBeNull();
  });

  it("refuses a date that does not exist rather than rolling it over", () => {
    // `new Date(2012, 1, 31)` is 3 March. A pupil born on 31 February is a
    // typing error and has to come back as one.
    expect(parseImportDate("31/02/2012")).toBeNull();
    expect(parseImportDate("2012-02-31")).toBeNull();
    expect(parseImportDate("32/01/2012")).toBeNull();
    expect(parseImportDate("15/13/2012")).toBeNull();
    expect(parseImportDate("00/09/2012")).toBeNull();
    expect(parseImportDate("15/00/2012")).toBeNull();
  });

  it("accepts the leap day of a leap year and refuses it otherwise", () => {
    expect(iso(parseImportDate("29/02/2012"))).toBe("2012-02-29");
    expect(parseImportDate("29/02/2013")).toBeNull();
  });

  it("answers null for a blank or unreadable cell", () => {
    expect(parseImportDate("")).toBeNull();
    expect(parseImportDate("   ")).toBeNull();
    expect(parseImportDate("le 15 septembre")).toBeNull();
    expect(parseImportDate("15/09")).toBeNull();
  });

  it("puts every date at UTC midnight, wherever it came from", () => {
    // A typed date arrives at UTC midnight through `z.coerce.date()`, so an
    // imported one has to land in the same place or the two render differently.
    for (const written of ["2012-09-15", "15/09/2012", "41167"]) {
      const date = parseImportDate(written)!;
      expect(date.getUTCHours(), written).toBe(0);
      expect(date.getUTCMinutes(), written).toBe(0);
      expect(date.getUTCSeconds(), written).toBe(0);
      expect(date.getUTCMilliseconds(), written).toBe(0);
    }
  });
});

// ── Sex ──────────────────────────────────────────────────────────────────────

describe("parseGender", () => {
  it.each(["M", "m", "H", "Male", "MASCULIN", "homme", "garçon", "garcon", "ذكر", "ذ"])(
    "reads %o as male",
    (value) => {
      expect(parseGender(value)).toBe("MALE");
    },
  );

  it.each(["F", "f", "Female", "FÉMININ", "feminin", "femme", "fille", "أنثى", "انثى", "ث"])(
    "reads %o as female",
    (value) => {
      expect(parseGender(value)).toBe("FEMALE");
    },
  );

  it("matches the Arabic words whole rather than by first letter", () => {
    // `مؤنث` (feminine) starts with a letter that is not `ذ`, and matching by
    // first letter across three alphabets is how a class list comes out inverted.
    expect(parseGender("مؤنث")).toBeNull();
  });

  it("answers null rather than guessing", () => {
    for (const value of ["", "  ", "?", "N/A", "autre", "1", "x"]) {
      expect(parseGender(value), value).toBeNull();
    }
  });

  it("ignores surrounding spaces and case", () => {
    expect(parseGender("  Masculin  ")).toBe("MALE");
  });
});

// ── Telephone ────────────────────────────────────────────────────────────────

describe("parsePhone", () => {
  it("keeps the national form a receptionist dials", () => {
    expect(parsePhone("0661234567")).toBe("0661234567");
  });

  it("normalises the five ways a school writes the same number", () => {
    for (const written of [
      "+212 6 61 23 45 67",
      "+212661234567",
      "00212661234567",
      "212661234567",
      "0661-234567",
      "06 61 23 45 67",
      "(0661) 23 45 67",
    ]) {
      expect(parsePhone(written), written).toBe("0661234567");
    }
  });

  it("keeps a foreign number rather than dropping it", () => {
    // A French grandmother's number is still worth having on the file.
    expect(parsePhone("+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("answers null for a blank cell", () => {
    expect(parsePhone("")).toBeNull();
    expect(parsePhone("   ")).toBeNull();
  });

  it("answers null when nothing dialable is left", () => {
    expect(parsePhone("néant")).toBeNull();
    expect(parsePhone("-")).toBeNull();
  });

  it("does not turn a too-short number into a Moroccan one", () => {
    expect(parsePhone("0661234")).toBe("0661234");
  });
});

// ── Yes and no ───────────────────────────────────────────────────────────────

describe("parseBoolean", () => {
  it.each(["oui", "OUI", "o", "yes", "y", "x", "X", "1", "true", "vrai", "نعم", "ن"])(
    "reads %o as yes",
    (value) => {
      expect(parseBoolean(value)).toBe(true);
    },
  );

  it("reads a blank cell as no, which is what an unticked box means", () => {
    expect(parseBoolean("")).toBe(false);
    expect(parseBoolean("   ")).toBe(false);
  });

  it.each(["non", "no", "0", "false", "n/a", "peut-être"])(
    "reads %o as no",
    (value) => {
      expect(parseBoolean(value)).toBe(false);
    },
  );

  it("never answers null, so no caller has to tell absent from declined", () => {
    for (const value of ["", "oui", "rubbish"]) {
      expect(typeof parseBoolean(value)).toBe("boolean");
    }
  });
});

// ── Text and email ───────────────────────────────────────────────────────────

describe("parseText", () => {
  it("turns a blank cell into null rather than an empty string", () => {
    // An empty string in a nullable column reads as "we asked and they said
    // nothing", which is not the same as never having asked.
    expect(parseText("")).toBeNull();
    expect(parseText("    ")).toBeNull();
  });

  it("trims what it keeps", () => {
    expect(parseText("  Alami  ")).toBe("Alami");
  });

  it("keeps Arabic text intact", () => {
    expect(parseText(" محمد بناني ")).toBe("محمد بناني");
  });
});

describe("parseEmail", () => {
  it("lower-cases, like every other email column in the app", () => {
    expect(parseEmail("  Parent@École.MA ")).toBe("parent@école.ma");
  });

  it("answers null for a blank cell", () => {
    expect(parseEmail("")).toBeNull();
    expect(parseEmail("  ")).toBeNull();
  });
});
