/**
 * A unique key for a row a form has just added in the browser.
 *
 * ── Why not `crypto.randomUUID()` ────────────────────────────────────────────
 * That function exists only in a **secure context**. Served over plain http on
 * anything but `localhost` — the LAN address a secretary opens the app on from
 * the front desk, a tablet, the school's other machine — `crypto.randomUUID` is
 * simply not there, and the screen that called it dies on mount with "…is not a
 * function" rather than degrading. The encaissement console called it while
 * building its first tender, so the whole payment panel went down with it.
 *
 * A counter is enough, and is the honest description of what these are: React
 * list keys, unique within one list for as long as the component is mounted.
 * Nothing is stored under them, nothing reads them back, and no two rows of one
 * form can collide because they are all handed out from here in order.
 *
 * Server-side identifiers are a different thing and keep using `randomUUID` —
 * see `recordTransfer`, which runs in Node where it is always available.
 */
let counter = 0;

export function localKey(prefix = "row"): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
