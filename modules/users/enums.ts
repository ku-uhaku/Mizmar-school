/**
 * Allowed values and shapes for this module's columns — the source of truth for
 * `prisma/schema/users/user.prisma`.
 *
 * Pure data: the user form previews the username it is about to suggest while
 * somebody types a name, and the action that saves it validates with the same
 * rules. A form proposing a username the server would then refuse is exactly
 * what one shared file prevents.
 */

/**
 * What a username may look like.
 *
 * Lowercase because a login is not a place for a capital-letter mistake: staff
 * type it on a phone keyboard at eight in the morning, and `K.Bennis` failing
 * where `k.bennis` works is the sort of thing that generates a support call
 * rather than a lesson. Everything is lowercased on the way in — see
 * `normalizeUsername` — so the column only ever holds one spelling of a name
 * and the unique index means what it looks like it means.
 *
 * Dots, hyphens and underscores are allowed inside; the first character must be
 * a letter or a digit, so nothing sorts oddly or reads as a flag.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/** Lowercased and trimmed. The one spelling that ever reaches the column. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  const normalized = normalizeUsername(value);
  return (
    normalized.length >= USERNAME_MIN_LENGTH &&
    normalized.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(normalized)
  );
}

/**
 * Strips a name down to what a username may contain.
 *
 * Accents are folded rather than dropped, so Benîssa becomes `benissa` and not
 * `benssa` — a Moroccan staff list is full of French and Arabic transliteration,
 * and a username missing letters is one nobody can guess or dictate over the
 * phone. Arabic script has no ASCII fold, so a name written in it reduces to
 * nothing here and the caller falls back — see `suggestUsername`.
 */
function slug(value: string): string {
  return value
    .normalize("NFD")
    // Combining marks — the accents NFD just split off. Written as escapes
    // rather than as literal marks, which are invisible in an editor.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * The username a new member of staff is offered: first initial, dot, surname.
 *
 * `Karim Bennis` → `k.bennis`, which is the shape Moroccan schools already use
 * on their internal mail. Only ever a *suggestion* — the form fills it in and
 * the administrator may overwrite it, because no rule survives contact with a
 * staff list. Returns "" when there is nothing usable to build from (a name in
 * Arabic script, say), and the form then asks for one instead of proposing
 * something meaningless.
 */
export function suggestUsername(firstName: string, lastName: string): string {
  const first = slug(firstName);
  const last = slug(lastName);

  const base = last ? (first ? `${first[0]}.${last}` : last) : first;
  if (base.length < USERNAME_MIN_LENGTH) return "";

  return base.slice(0, USERNAME_MAX_LENGTH);
}

/**
 * The first free username in a series: `k.bennis`, then `k.bennis2`, `k.bennis3`.
 *
 * Two people called Karim Bennis is not a corner case in a school of two
 * hundred — it is a Tuesday. Without this the second one hits the unique index
 * and the form reports "already taken" about a name the administrator did not
 * choose and cannot obviously fix.
 *
 * The suffix is trimmed *into* the length limit rather than appended past it,
 * so a long surname still yields something the column accepts.
 */
export function uniqueUsername(
  base: string,
  taken: ReadonlySet<string>,
): string {
  const normalized = normalizeUsername(base);
  if (normalized === "") return "";
  if (!taken.has(normalized)) return normalized;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const tail = String(suffix);
    const candidate =
      normalized.slice(0, USERNAME_MAX_LENGTH - tail.length) + tail;
    if (!taken.has(candidate)) return candidate;
  }

  // A thousand people of the same name. Returning the base lets the unique
  // index refuse it honestly rather than looping for ever.
  return normalized;
}
