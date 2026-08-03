/**
 * Turning what a school typed into what the database stores.
 *
 * Pure — no `server-only`, no `db`. The preview screen and the writer both run
 * these, so what the secretary is shown is exactly what will be saved.
 *
 * Every function here is forgiving on the way in and strict on the way out. A
 * file assembled by hand in Excel over a fortnight is inconsistent by nature —
 * three date formats, "M" in one row and "Masculin" in the next — and refusing
 * it row by row would mean the school never finishes the import. Anything
 * genuinely ambiguous still fails, because a birth date guessed wrong is worse
 * than a birth date rejected.
 */

/**
 * A date as a Moroccan school writes it.
 *
 * `new Date(value)` is not usable here: it reads "15/09/2012" as invalid and
 * "09/15/2012" as September, so a French file would import silently wrong on
 * every row where the day is 12 or less. Day-first is therefore assumed for
 * slashed and dotted forms — that is what Excel writes in fr-MA and ar-MA — and
 * ISO is recognised by its shape.
 *
 * Returns UTC midnight, which is where `z.coerce.date()` puts a date submitted
 * by a form. Storing it any other way would make an imported birth date and a
 * typed one render differently.
 */
export function parseImportDate(raw: string): Date | null {
  const value = raw.trim();
  if (value === "") return null;

  // ISO first: unambiguous, and what our own export writes.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) {
    return buildUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // Day-first, the separator being whatever the keyboard offered.
  const dmy = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(value);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    // A two-digit year in a school's file is a birth date, never a future one.
    if (year < 100) year += year > 30 ? 1900 : 2000;
    return buildUtcDate(year, month, day);
  }

  /*
    An Excel serial number, which is what a cell formatted as a date becomes if
    the file is saved through certain converters. Day 1 is 1900-01-01, and
    Excel's deliberate 1900 leap-year bug means the epoch to count from is
    1899-12-30. Bounded to a plausible range so a stray "42" in a text column is
    not read as a date in 1900.
  */
  if (/^\d{4,6}$/.test(value)) {
    const serial = Number(value);
    if (serial >= 10_000 && serial <= 60_000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    }
  }

  return null;
}

/** Rejects the impossible dates a lenient constructor would roll over. */
function buildUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // 31/02 becomes 3 March unless this is checked.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Sex, however the school writes it.
 *
 * Arabic, French and English are all in circulation in one building, and a
 * MASSAR extract uses single letters. "F" is unambiguous in all three; "M" means
 * masculin and mâle but never `مؤنث`, which is why the Arabic words are matched
 * whole rather than by first letter.
 */
export function parseGender(raw: string): "MALE" | "FEMALE" | null {
  const value = raw.trim().toLowerCase();
  if (value === "") return null;

  const male = ["m", "h", "male", "masculin", "homme", "garcon", "garçon", "ذكر", "ذ"];
  const female = ["f", "female", "feminin", "féminin", "femme", "fille", "أنثى", "انثى", "ث"];

  if (male.includes(value)) return "MALE";
  if (female.includes(value)) return "FEMALE";
  return null;
}

/**
 * A Moroccan phone number, in the one shape the rest of the app stores.
 *
 * Schools hold the same number written five ways — `+212 6 61 23 45 67`,
 * `0661-234567`, `00212661234567` — and a family whose number matches nothing is
 * a family nobody can ring. The national form (`0` + nine digits) is what is
 * kept, since that is what a receptionist dials.
 *
 * A number that is not recognisably Moroccan is passed through with its spacing
 * stripped rather than rejected: a French grandmother's number is still worth
 * having on the file.
 */
export function parsePhone(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;

  const digits = value.replace(/[^\d+]/g, "");

  const national = /^(?:\+212|00212|212)(\d{9})$/.exec(digits);
  if (national) return `0${national[1]}`;

  if (/^0\d{9}$/.test(digits)) return digits;

  return digits === "" ? null : digits;
}

/**
 * Yes or no, however the school marks it.
 *
 * A column like "Transport" comes back as "oui", "OUI", "x", "1", "نعم" or an
 * empty cell, and all of them mean something definite. A blank is *not* an
 * error here — it is "no", which is what an unticked box means on paper — so
 * this returns false rather than null for anything it does not recognise as
 * yes, and the caller never has to distinguish "absent" from "declined".
 */
export function parseBoolean(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return ["oui", "o", "yes", "y", "x", "1", "true", "vrai", "نعم", "ن"].includes(
    value,
  );
}

/** Blank becomes null, so an empty cell never writes an empty string. */
export function parseText(raw: string): string | null {
  const value = raw.trim();
  return value === "" ? null : value;
}

/** Lower-cased, like every other email column in the app. */
export function parseEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return value === "" ? null : value;
}
