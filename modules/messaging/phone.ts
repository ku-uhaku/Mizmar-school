/**
 * Turns whatever was typed into a number WhatsApp can be addressed with.
 *
 * Phones are free text in the dossier ("06 12-34-56-78", "+212 6…", "0022…"),
 * so the digits are recovered rather than the format trusted. A bare national
 * number starting with 0 is read as Moroccan, which is the school's country; an
 * international number is kept as given. Anything that cannot be a mobile
 * number returns null, so it is flagged on screen instead of failing in the
 * background after a credit has been taken.
 */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `212${digits.slice(1)}`;

  digits = digits.replace(/\D/g, "");

  // Moroccan mobiles: 212 6/7 + eight digits. Landlines cannot receive WhatsApp.
  if (digits.startsWith("212")) {
    return /^212[67]\d{8}$/.test(digits) ? digits : null;
  }

  // Any other country: E.164 allows 8–15 digits.
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
