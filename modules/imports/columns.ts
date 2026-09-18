import { normaliseHeader } from "@/lib/csv";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * The shape of the pupil import file, declared once.
 *
 * Pure data — no `server-only`, no `db`, no React. The browser builds the model
 * file from this and the server matches an upload's headers against it, so the
 * file the app hands out is by construction the file it accepts back.
 *
 * ── One row is one child ─────────────────────────────────────────────────────
 * A school's list lives in Excel as one line per pupil carrying the parents'
 * details alongside, because that is the shape a secretary can read and sort.
 * It is not the shape of the database — a Family and two Guardians sit behind
 * every row — and reconciling the two is the importer's job, not the school's.
 * Rows sharing a household are grouped on the `famille` column; see
 * `modules/imports/service.ts`.
 */

export type ImportColumnKind =
  | "text"
  /** Parsed by `parseImportDate` — Moroccan Excel writes 15/09/2010. */
  | "date"
  /** Parsed by `parseGender` — accepts M/F, masculin, ذكر, and the rest. */
  | "gender"
  /** Digits kept, spaces and dashes dropped. */
  | "phone"
  | "email"
  /** Parsed by `parseBoolean` — oui / x / 1 / نعم. A blank means no. */
  | "boolean";

export type ImportColumn = {
  /** Stable id. Never shown; the header comes from the dictionary. */
  key: string;
  /** Key under `imports.columns`, used for the header we *write*. */
  labelKey: keyof Dictionary["imports"]["columns"];
  kind: ImportColumnKind;
  /**
   * Headers accepted on the way in, beyond the three translated labels. Written
   * as a reader would type them; matching is done on `normaliseHeader`, so case,
   * accents, spaces and underscores need no variants here.
   */
  aliases: readonly string[];
  required?: boolean;
  /** Filled into the model file's example row, so the format is self-evident. */
  example: string;
};

/**
 * ── Why the parents are columns and not a second file ────────────────────────
 * A separate guardians.csv keyed by family code is the faithful modelling, and
 * it is also two files a secretary must keep in step by hand. Père and mère are
 * the only two adults nearly every dossier has, so they are flattened here and
 * anything more unusual — a tuteur, a grandmother — is added afterwards on the
 * family's own screen, where the form already handles it.
 */
export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  // ── The child ──────────────────────────────────────────────────────────────
  {
    key: "code",
    labelKey: "code",
    kind: "text",
    aliases: ["matricule", "codeeleve", "matriculeinterne", "رمز", "الرقم"],
    example: "",
  },
  {
    key: "massarCode",
    labelKey: "massarCode",
    kind: "text",
    aliases: ["massar", "codemassar", "gresa", "مسار", "رمزمسار"],
    example: "J130045782",
  },
  {
    key: "lastName",
    labelKey: "lastName",
    kind: "text",
    aliases: ["nom", "nomdefamille", "lastname", "nomfr"],
    required: true,
    example: "Bennis",
  },
  {
    key: "firstName",
    labelKey: "firstName",
    kind: "text",
    aliases: ["prenom", "firstname", "prenomfr"],
    required: true,
    example: "Yasmine",
  },
  {
    key: "lastNameAr",
    labelKey: "lastNameAr",
    kind: "text",
    aliases: ["نسب", "النسب", "nomar", "nomarabe"],
    example: "بنيس",
  },
  {
    key: "firstNameAr",
    labelKey: "firstNameAr",
    kind: "text",
    aliases: ["اسم", "الاسم", "prenomar", "prenomarabe"],
    example: "ياسمين",
  },
  {
    key: "gender",
    labelKey: "gender",
    kind: "gender",
    aliases: ["sexe", "genre", "الجنس", "جنس"],
    required: true,
    example: "F",
  },
  {
    key: "birthDate",
    labelKey: "birthDate",
    kind: "date",
    aliases: [
      "naissance",
      "datedenaissance",
      "datenaissance",
      "ddn",
      "birthdate",
      "تاريخالازدياد",
      "الازدياد",
    ],
    required: true,
    example: "15/09/2012",
  },
  {
    key: "nationality",
    labelKey: "nationality",
    kind: "text",
    aliases: ["nationalite", "الجنسية"],
    example: "MA",
  },
  {
    // The town, from the school's own list — matched on either spelling and
    // opened when it is new, as a parent's occupation is. MASSAR's class list
    // carries it in Arabic, which is why that spelling is an alias.
    key: "birthCity",
    labelKey: "birthCity",
    kind: "text",
    aliases: ["lieudenaissance", "lieunaissance", "birthplace", "birthcity", "مكان الازدياد"],
    example: "Casablanca",
  },
  {
    key: "neighbourhood",
    labelKey: "neighbourhood",
    kind: "text",
    aliases: ["quartier", "secteur", "الحي", "حي"],
    example: "Maârif",
  },

  // ── The household ──────────────────────────────────────────────────────────
  {
    key: "familyName",
    labelKey: "familyName",
    kind: "text",
    aliases: ["famille", "nomfamille", "dossier", "foyer", "الأسرة", "العائلة"],
    /*
      Not required, because `Student.familyId` is nullable and says why: a file
      is often opened from a phone call with only the child's name, and the
      dossier familial is completed after. Demanding it here would also break the
      round trip — such a pupil exports with an empty cell and would come back in
      as a rejected row.
    */
    example: "Famille Bennis",
  },
  {
    key: "familyPhone",
    labelKey: "familyPhone",
    kind: "phone",
    aliases: ["telfamille", "telephonefamille", "telephone", "tel", "الهاتف"],
    example: "0661234567",
  },
  {
    key: "familyEmail",
    labelKey: "familyEmail",
    kind: "email",
    aliases: ["emailfamille", "mail", "courriel", "البريد"],
    example: "bennis@example.ma",
  },
  {
    key: "addressLine",
    labelKey: "addressLine",
    kind: "text",
    aliases: ["adresse", "adresselignes", "العنوان"],
    example: "12 rue des Écoles",
  },
  {
    key: "city",
    labelKey: "city",
    kind: "text",
    aliases: ["ville", "المدينة"],
    example: "Casablanca",
  },

  // ── Le père ────────────────────────────────────────────────────────────────
  {
    key: "fatherLastName",
    labelKey: "fatherLastName",
    kind: "text",
    aliases: ["perenom", "nompere", "نسبالأب", "الأب"],
    example: "Bennis",
  },
  {
    key: "fatherFirstName",
    labelKey: "fatherFirstName",
    kind: "text",
    aliases: ["pereprenom", "prenompere", "اسمالأب"],
    example: "Karim",
  },
  {
    key: "fatherNationalId",
    labelKey: "fatherNationalId",
    kind: "text",
    aliases: ["perecin", "cinpere", "cnie pere", "بطاقةالأب"],
    example: "BE123456",
  },
  {
    key: "fatherPhone",
    labelKey: "fatherPhone",
    kind: "phone",
    aliases: ["peretel", "telpere", "gsmpere", "هاتفالأب"],
    example: "0661234567",
  },
  {
    key: "fatherProfession",
    labelKey: "fatherProfession",
    kind: "text",
    aliases: ["pereprofession", "professionpere", "مهنةالأب"],
    example: "Ingénieur",
  },

  // ── La mère ────────────────────────────────────────────────────────────────
  {
    key: "motherLastName",
    labelKey: "motherLastName",
    kind: "text",
    aliases: ["merenom", "nommere", "نسبالأم", "الأم"],
    example: "Alaoui",
  },
  {
    key: "motherFirstName",
    labelKey: "motherFirstName",
    kind: "text",
    aliases: ["mereprenom", "prenommere", "اسمالأم"],
    example: "Salma",
  },
  {
    key: "motherNationalId",
    labelKey: "motherNationalId",
    kind: "text",
    aliases: ["merecin", "cinmere", "بطاقةالأم"],
    example: "BK654321",
  },
  {
    key: "motherPhone",
    labelKey: "motherPhone",
    kind: "phone",
    aliases: ["meretel", "telmere", "gsmmere", "هاتفالأم"],
    example: "0662345678",
  },
  {
    key: "motherProfession",
    labelKey: "motherProfession",
    kind: "text",
    aliases: ["mereprofession", "professionmere", "مهنةالأم"],
    example: "Médecin",
  },

  /*
    ── L'inscription ──────────────────────────────────────────────────────────
    Everything below is true of one school *year*, and together these columns
    are what turn an imported file into an enrolled pupil with an échéancier.

    They are matched by the name the school already uses on its own screens — a
    level's code, a class's code, a line's name — and never by an id. Nobody has
    a cuid to hand in Excel, and asking for one would mean the school exporting a
    reference file first just to be allowed to type a list it already has.

    Leave `Niveau` blank and the row still imports: it opens the pupil's file
    without seating them, which is exactly what `Student` without `Enrollment`
    means and what a school pre-registering for next year wants.
  */
  {
    key: "levelCode",
    labelKey: "levelCode",
    kind: "text",
    aliases: ["niveau", "level", "classeniveau", "المستوى"],
    example: "3AP",
  },
  {
    key: "trackCode",
    labelKey: "trackCode",
    kind: "text",
    aliases: ["filiere", "track", "serie", "الشعبة", "المسلك"],
    example: "",
  },
  {
    key: "className",
    labelKey: "className",
    kind: "text",
    aliases: ["classe", "class", "groupe", "القسم"],
    example: "3AP-A",
  },
  {
    key: "enrolledOn",
    labelKey: "enrolledOn",
    kind: "date",
    aliases: [
      "dateinscription",
      "datedinscription",
      "inscription",
      "تاريخالتسجيل",
    ],
    example: "01/09/2026",
  },
  {
    key: "isRepeating",
    labelKey: "isRepeating",
    kind: "boolean",
    aliases: ["redoublant", "redoublement", "معيد"],
    example: "non",
  },
  {
    key: "usesTransport",
    labelKey: "usesTransport",
    kind: "boolean",
    aliases: ["transport", "bus", "ramassage", "النقل", "الحافلة"],
    example: "oui",
  },
  {
    key: "routeName",
    labelKey: "routeName",
    kind: "text",
    aliases: ["ligne", "circuit", "route", "الخط", "المسار"],
    example: "Ligne 2 — Maârif",
  },
  {
    key: "stopName",
    labelKey: "stopName",
    kind: "text",
    aliases: ["arret", "station", "pointdarret", "المحطة", "الموقف"],
    example: "Place Zerktouni",
  },
  {
    key: "usesCanteen",
    labelKey: "usesCanteen",
    kind: "boolean",
    aliases: ["cantine", "restauration", "المطعم", "الإطعام"],
    example: "non",
  },
] as const;

/**
 * Matches an uploaded file's header row to columns, by position.
 *
 * Returns one entry per physical column so the preview can point at the cell a
 * problem is in. An unrecognised header maps to `null` and is carried through
 * as an ignored column rather than refused: a school's own file usually has
 * extra columns the app has no home for, and rejecting the upload over "Groupe
 * sanguin" would be the app being difficult about data it was not asked to read.
 */
export function matchHeaders(
  headerRow: readonly string[],
  t: Dictionary,
): (ImportColumn | null)[] {
  const byAlias = new Map<string, ImportColumn>();

  for (const column of IMPORT_COLUMNS) {
    // The three translated labels are always accepted, so a file exported in
    // Arabic imports into a French session and the other way round.
    for (const label of Object.values(headerLabels(column, t))) {
      byAlias.set(normaliseHeader(label), column);
    }
    for (const alias of column.aliases) {
      byAlias.set(normaliseHeader(alias), column);
    }
    byAlias.set(normaliseHeader(column.key), column);
  }

  const used = new Set<string>();
  return headerRow.map((header) => {
    const match = byAlias.get(normaliseHeader(header));
    // A file with "Nom" twice must not fill the same field from both; the first
    // wins and the second is treated as an extra column.
    if (!match || used.has(match.key)) return null;
    used.add(match.key);
    return match;
  });
}

/**
 * The header this column is written with, in the reader's language.
 *
 * Kept as a function of the dictionary rather than a constant so the model file
 * a secretary downloads is in the language they are working in — a French
 * header row is what makes the file legible in the Excel they already have open.
 */
function headerLabels(
  column: ImportColumn,
  t: Dictionary,
): Record<string, string> {
  return { current: t.imports.columns[column.labelKey] };
}

/** The header row and the example row of the model file. */
export function modelFileRows(t: Dictionary): string[][] {
  return [
    IMPORT_COLUMNS.map((column) => t.imports.columns[column.labelKey]),
    IMPORT_COLUMNS.map((column) => column.example),
  ];
}
