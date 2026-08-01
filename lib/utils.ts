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

  /*
    Read in local time, not UTC.

    This used to be `toISOString().slice(0, 10)`, which reads the *UTC* date and
    is off by one for every date-only value in a timezone ahead of UTC — which
    Morocco is. A birth date written as 15 September came back out of the form
    as the 14th, and saving the row then made the 14th true: a date that moved a
    day every time somebody opened the record and pressed Save.

    A birth date, a due date and a holiday are wall-calendar dates, not instants
    — "15 September" means the same thing in Casablanca and in Nairobi — so the
    right frame to read them in is the one they were written in, which for
    everything here is local. `modules/timetable/weeks.ts` does the same, for
    the same reason.
  */
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
