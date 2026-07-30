import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Completed years between `birthDate` and `on`. Returns null for a missing or
 * unparseable date, and for a date in the future — a negative age is always a
 * data-entry mistake and rendering "-3 ans" helps nobody.
 */
export function ageFrom(
  birthDate: Date | string | null | undefined,
  on: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const born = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (Number.isNaN(born.getTime())) return null;

  let age = on.getFullYear() - born.getFullYear();
  // Subtract a year when this year's birthday has not come round yet.
  const monthDelta = on.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < born.getDate())) {
    age -= 1;
  }
  return age < 0 ? null : age;
}

/** `YYYY-MM-DD` for `<input type="date">`, which accepts no other format. */
export function toDateInputValue(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
