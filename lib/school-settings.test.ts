import { describe, expect, it } from "vitest";

import {
  CURRENCY_CODES,
  DEFAULT_SETTINGS,
  WEEKDAYS,
  codeFormatHasSequence,
  codePrefixOf,
  dueDayOf,
  formatEntityCode,
  isPassingScore,
  isTeachingDayIn,
  parseTeachingDays,
  passMarkOf,
  sequenceFromCode,
  settingsOf,
  teachingDaysOf,
  type SchoolSettingsValues,
} from "@/lib/school-settings";

/**
 * A school's own policies — the most widely read file in the app.
 *
 * Eight modules pull values out of it and `lib/dal.ts` puts it on every
 * `AuthContext`, so a wrong answer here is wrong on the mark sheet, the
 * timetable, the payslip and the échéancier at once. Three things make it work,
 * and each is tested below.
 *
 * **The defaults are the old constants.** Every value in `DEFAULT_SETTINGS` is
 * exactly what was hardcoded before the table existed, which is what lets a
 * school with no settings row, a request with no school in context, and a seed
 * that has not run behave the way the app behaved yesterday. Nothing has to
 * check whether settings are "there".
 *
 * **A stored value is not a trusted value.** The row is edited through a
 * generic CRUD and seeded by scripts, so every reader either clamps what it
 * finds or falls back to something that works.
 *
 * **The school supplies the ratio, the paper supplies the scale.** A mark is
 * judged against the paper it was earned on; the school only says what fraction
 * of it passes.
 */

const settings = (extra: Partial<SchoolSettingsValues> = {}) => ({
  ...DEFAULT_SETTINGS,
  ...extra,
});

// ── The defaults ─────────────────────────────────────────────────────────────

describe("settingsOf", () => {
  it("answers the defaults for a school with no row", () => {
    expect(settingsOf(null)).toEqual(DEFAULT_SETTINGS);
    expect(settingsOf(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("fills in whatever a partial row is missing", () => {
    const merged = settingsOf({ gradingMaxScore: 40 });
    expect(merged.gradingMaxScore).toBe(40);
    expect(merged.passMarkBps).toBe(DEFAULT_SETTINGS.passMarkBps);
  });

  it("treats a null column as unset rather than as a value", () => {
    // Every column on the row is nullable, and a null must not overwrite the
    // default with nothing.
    const merged = settingsOf({
      gradingMaxScore: null as unknown as number,
      currencyCode: undefined,
    });
    expect(merged.gradingMaxScore).toBe(DEFAULT_SETTINGS.gradingMaxScore);
    expect(merged.currencyCode).toBe(DEFAULT_SETTINGS.currencyCode);
  });

  it("keeps a falsy value that is a real answer", () => {
    // Zero instalments means "follow the school year", and false means the
    // parents' chat is off. Neither is "unset".
    const merged = settingsOf({
      defaultInstalmentCount: 0,
      parentChatEnabled: false,
    });
    expect(merged.defaultInstalmentCount).toBe(0);
    expect(merged.parentChatEnabled).toBe(false);
  });

  it("opens no parents' group by default", () => {
    // A group is opened, never discovered.
    expect(DEFAULT_SETTINGS.parentChatEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.parentClassChatEnabled).toBe(false);
  });

  it("follows the school year's own length by default", () => {
    // Zero, not nine: nine is true of a September–June year and silently wrong
    // of any other.
    expect(DEFAULT_SETTINGS.defaultInstalmentCount).toBe(0);
  });

  it("leaves the income-tax rate blank", () => {
    // A flat rate would be wrong for everybody — the Moroccan barème is
    // progressive.
    expect(DEFAULT_SETTINGS.irRateBps).toBe(0);
  });
});

// ── A matricule format that cannot number anybody ────────────────────────────

describe("the code formats", () => {
  it("falls back when the stored format has no sequence", () => {
    // The bug this closes. Such a format renders the same string for every
    // pupil of a year; the unique index then refuses them one at a time, so the
    // school stops being able to enrol anybody and the message says "code
    // taken" — sending a secretary after a duplicate that does not exist.
    const merged = settingsOf({ studentCodeFormat: "E-{year}" });
    expect(merged.studentCodeFormat).toBe(DEFAULT_SETTINGS.studentCodeFormat);
  });

  it("guards all three of them", () => {
    const merged = settingsOf({
      studentCodeFormat: "E",
      familyCodeFormat: "",
      staffCodeFormat: "{year}/{yy}",
    });
    expect(merged.studentCodeFormat).toBe(DEFAULT_SETTINGS.studentCodeFormat);
    expect(merged.familyCodeFormat).toBe(DEFAULT_SETTINGS.familyCodeFormat);
    expect(merged.staffCodeFormat).toBe(DEFAULT_SETTINGS.staffCodeFormat);
  });

  it("leaves a format that can number a cohort alone", () => {
    for (const format of ["E-{year}-{seq:4}", "{yy}{seq}", "{seq:2}"]) {
      expect(settingsOf({ studentCodeFormat: format }).studentCodeFormat, format)
        .toBe(format);
    }
  });

  it("recognises a sequence in either shape", () => {
    expect(codeFormatHasSequence("{seq}")).toBe(true);
    expect(codeFormatHasSequence("{seq:4}")).toBe(true);
    expect(codeFormatHasSequence("E-{year}")).toBe(false);
    expect(codeFormatHasSequence("")).toBe(false);
  });

  it("ships defaults that can number a cohort", () => {
    for (const format of [
      DEFAULT_SETTINGS.studentCodeFormat,
      DEFAULT_SETTINGS.familyCodeFormat,
      DEFAULT_SETTINGS.staffCodeFormat,
    ]) {
      expect(codeFormatHasSequence(format), format).toBe(true);
    }
  });
});

describe("formatEntityCode", () => {
  it("renders the placeholders and copies everything else through", () => {
    // A school writing "2025/0431" just writes that.
    expect(formatEntityCode("E-{year}-{seq:4}", 2025, 431)).toBe("E-2025-0431");
    expect(formatEntityCode("{yy}/{seq}", 2025, 431)).toBe("25/431");
  });

  it("pads a two-digit year", () => {
    expect(formatEntityCode("{yy}", 2005, 1)).toBe("05");
  });

  it("caps the padding, so a hand-typed width cannot produce a long code", () => {
    expect(formatEntityCode("{seq:99}", 2025, 1)).toHaveLength(12);
  });

  it("does not truncate a sequence wider than its padding", () => {
    // The ten-thousandth pupil of a year still gets a code, and it is still
    // theirs alone.
    expect(formatEntityCode("E-{seq:4}", 2025, 12345)).toBe("E-12345");
  });

  it("renders every occurrence of a placeholder", () => {
    expect(formatEntityCode("{year}-{year}", 2025, 1)).toBe("2025-2025");
  });
});

describe("codePrefixOf", () => {
  it("gives the allocator what to scan on", () => {
    // Taken from the format rather than by slicing a fixed number of characters
    // off the end: a school numbering "2025/431" has a three-character prefix
    // and no padding at all.
    expect(codePrefixOf("E-{year}-{seq:4}", 2025)).toBe("E-2025-");
    expect(codePrefixOf("{yy}/{seq}", 2025)).toBe("25/");
  });

  it("renders the whole format when it holds no sequence", () => {
    expect(codePrefixOf("E-{year}", 2025)).toBe("E-2025");
  });

  it("scopes a scan to one year", () => {
    expect(codePrefixOf("E-{year}-{seq:4}", 2025)).not.toBe(
      codePrefixOf("E-{year}-{seq:4}", 2026),
    );
  });
});

describe("sequenceFromCode", () => {
  const format = "E-{year}-{seq:4}";

  it("reads back what it wrote", () => {
    for (const sequence of [1, 42, 431, 9999, 12345]) {
      const code = formatEntityCode(format, 2025, sequence);
      expect(sequenceFromCode(format, 2025, code), code).toBe(sequence);
    }
  });

  it("answers nothing for a code in another year's format", () => {
    expect(sequenceFromCode(format, 2025, "E-2024-0431")).toBeNull();
  });

  it("answers nothing rather than zero for a code it does not recognise", () => {
    // The allocator takes the highest sequence it can *recognise*. Reading an
    // older format as zero would hand the next pupil a number already in use.
    for (const code of ["", "431", "E-2025-", "hand-typed", "X-2025-0431"]) {
      expect(sequenceFromCode(format, 2025, code), code).toBeNull();
    }
  });

  it("does not let a format's punctuation become a wildcard", () => {
    // A format containing "." or "+" is escaped before it becomes a regex, so
    // it cannot match codes it did not produce.
    expect(sequenceFromCode("E.{seq}", 2025, "EX431")).toBeNull();
    expect(sequenceFromCode("E.{seq}", 2025, "E.431")).toBe(431);
    expect(sequenceFromCode("E+{seq}", 2025, "EEE431")).toBeNull();
  });

  it("anchors at both ends", () => {
    // So a code with something appended is not read as a smaller one.
    expect(sequenceFromCode(format, 2025, "E-2025-0431-bis")).toBeNull();
    expect(sequenceFromCode(format, 2025, "old-E-2025-0431")).toBeNull();
  });

  it("refuses a sequence too large to be an integer", () => {
    expect(
      sequenceFromCode("E-{seq}", 2025, `E-${"9".repeat(25)}`),
    ).toBeNull();
  });
});

// ── Notation ─────────────────────────────────────────────────────────────────

describe("passMarkOf", () => {
  it("works the pass mark out on the school's own scale", () => {
    expect(passMarkOf(settings())).toBe(10);
    expect(passMarkOf(settings({ gradingMaxScore: 40 }))).toBe(20);
    expect(passMarkOf(settings({ passMarkBps: 6000 }))).toBe(12);
  });

  it("rounds to two decimals rather than leaving a float", () => {
    // It is shown to teachers, and comparing against 9.999999 would fail a mark
    // of 10.
    const mark = passMarkOf(settings({ gradingMaxScore: 20, passMarkBps: 3333 }));
    expect(mark).toBe(6.67);
    expect(Number.isFinite(mark)).toBe(true);
  });
});

describe("isPassingScore", () => {
  it("judges a mark against the paper it was earned on", () => {
    // A school marking out of 20 may still set one paper out of 40; the setting
    // supplies the ratio, not the scale.
    expect(isPassingScore(20, 40, settings())).toBe(true);
    expect(isPassingScore(19.99, 40, settings())).toBe(false);
    expect(isPassingScore(10, 20, settings())).toBe(true);
  });

  it("follows the school's own threshold", () => {
    expect(isPassingScore(11, 20, settings({ passMarkBps: 6000 }))).toBe(false);
    expect(isPassingScore(12, 20, settings({ passMarkBps: 6000 }))).toBe(true);
  });

  it("passes nothing on a paper marked out of nothing", () => {
    // Rather than dividing by zero and answering by accident.
    expect(isPassingScore(0, 0, settings())).toBe(false);
    expect(isPassingScore(10, 0, settings())).toBe(false);
  });

  it("agrees with the pass mark it publishes", () => {
    // The number on screen and the verdict beside it must be the same rule.
    const configured = settings({ gradingMaxScore: 20, passMarkBps: 5500 });
    const mark = passMarkOf(configured);
    expect(isPassingScore(mark, 20, configured)).toBe(true);
    expect(isPassingScore(mark - 0.01, 20, configured)).toBe(false);
  });
});

// ── The teaching week ────────────────────────────────────────────────────────

describe("parseTeachingDays", () => {
  it("reads the week a school declares", () => {
    expect(parseTeachingDays("1,2,3,4,5")).toEqual([1, 2, 3, 4, 5]);
  });

  it("sorts and de-duplicates", () => {
    expect(parseTeachingDays("3,1,3,2")).toEqual([1, 2, 3]);
  });

  it("tolerates the spacing somebody typed", () => {
    expect(parseTeachingDays(" 1 , 2 ,3 ")).toEqual([1, 2, 3]);
  });

  it("drops anything that is not a weekday", () => {
    expect(parseTeachingDays("1,8,0,-3,x,2")).toEqual([1, 2]);
  });

  it("never leaves the timetable with no columns", () => {
    // A settings row edited by hand must not be able to do that.
    for (const value of ["", "   ", "0", "8,9", "nonsense", ","]) {
      expect(parseTeachingDays(value), value).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it("answers only days the week has", () => {
    for (const day of parseTeachingDays("1,2,3,4,5,6,7")) {
      expect(WEEKDAYS).toContain(day);
    }
  });

  it("lets a school teach Sunday if it says so", () => {
    expect(parseTeachingDays("1,7")).toEqual([1, 7]);
  });
});

describe("teachingDaysOf and isTeachingDayIn", () => {
  it("runs Monday to Saturday out of the box", () => {
    expect(teachingDaysOf(settings())).toEqual([1, 2, 3, 4, 5, 6]);
    expect(isTeachingDayIn(7, settings())).toBe(false);
  });

  it("follows a school that closes on Saturday", () => {
    const closed = settings({ teachingDays: "1,2,3,4,5" });
    expect(isTeachingDayIn(6, closed)).toBe(false);
    expect(isTeachingDayIn(5, closed)).toBe(true);
  });

  it("says no to a day that is not one", () => {
    for (const day of [0, 8, -1, 1.5, Number.NaN]) {
      expect(isTeachingDayIn(day, settings()), String(day)).toBe(false);
    }
  });
});

// ── Facturation ──────────────────────────────────────────────────────────────

describe("dueDayOf", () => {
  it("takes the day the school asked for", () => {
    expect(dueDayOf(settings({ feeDueDayOfMonth: 15 }))).toBe(15);
  });

  it("stops at a day every month actually has", () => {
    // 28 rather than 31: a schedule whose February line silently moves to March
    // 3rd is a schedule an accountant cannot reconcile.
    expect(dueDayOf(settings({ feeDueDayOfMonth: 31 }))).toBe(28);
    expect(dueDayOf(settings({ feeDueDayOfMonth: 29 }))).toBe(28);
  });

  it("never answers a day before the first", () => {
    expect(dueDayOf(settings({ feeDueDayOfMonth: 0 }))).toBe(1);
    expect(dueDayOf(settings({ feeDueDayOfMonth: -5 }))).toBe(1);
  });

  it("always answers a day that exists", () => {
    for (const day of [-100, 0, 1, 5, 28, 29, 31, 999]) {
      const resolved = dueDayOf(settings({ feeDueDayOfMonth: day }));
      expect(resolved, String(day)).toBeGreaterThanOrEqual(1);
      expect(resolved, String(day)).toBeLessThanOrEqual(28);
    }
  });
});

describe("the currencies on offer", () => {
  it("lists only currencies with hundredths", () => {
    // Amounts are stored in the minor unit throughout, so the choice changes a
    // label and never the arithmetic — which is why one without hundredths does
    // not belong on the list.
    expect([...CURRENCY_CODES]).toEqual(["MAD", "EUR", "USD"]);
  });

  it("defaults to the dirham", () => {
    expect(DEFAULT_SETTINGS.currencyCode).toBe("MAD");
    expect(CURRENCY_CODES).toContain(DEFAULT_SETTINGS.currencyCode);
  });
});
