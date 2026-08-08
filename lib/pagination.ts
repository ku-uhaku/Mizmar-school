/**
 * Which page numbers to draw under a table.
 *
 * A table with sixty pages cannot offer sixty buttons, and "‹ ›" alone makes
 * page 40 forty clicks away. So the control shows the two ends, a run around
 * where the reader is, and an ellipsis for everything it skips — the reader can
 * always reach the first page, the last page, and their neighbours in one move.
 *
 * Pure and domain-free: the client-side `DataTable` and the server-paged
 * screens both draw from it, and a table that numbered its pages differently
 * from the one above it would read as a different control.
 */

/** A page number, or the gap standing in for the ones left out. */
export type PageSlot = number | "gap";

/**
 * @param page       the current page, 1-based
 * @param pageCount  how many there are
 * @param span       how many neighbours to show either side of the current page
 */
export function pageWindow(
  page: number,
  pageCount: number,
  span = 1,
): PageSlot[] {
  if (pageCount <= 0) return [];

  const current = Math.min(Math.max(1, Math.trunc(page)), pageCount);

  const shown = new Set<number>([1, pageCount]);
  for (let n = current - span; n <= current + span; n += 1) {
    if (n >= 1 && n <= pageCount) shown.add(n);
  }

  const slots: PageSlot[] = [];
  let previous = 0;
  for (const n of [...shown].sort((a, b) => a - b)) {
    // A gap of exactly one page is drawn as the page itself: an ellipsis hiding
    // a single number is both longer and less useful than the number.
    if (previous && n - previous === 2) slots.push(previous + 1);
    else if (previous && n - previous > 2) slots.push("gap");
    slots.push(n);
    previous = n;
  }

  return slots;
}
