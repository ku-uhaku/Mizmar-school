"use client";

import type { Locale } from "@/lib/i18n/config";
import { dirOf } from "@/lib/i18n/config";
import { formatDate, interpolate } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";
import type { IssuedPortalCredentials } from "@/modules/families/service";

/**
 * The slip a secretary hands across the counter.
 *
 * Printed from a string written into a hidden iframe rather than through
 * `PrintDocument` and the `(print)` route group, and the reason is the password:
 * only the hash is stored, so the plaintext exists for as long as the dialog is
 * open and nowhere else. A printable *page* would mean putting it in a URL — in
 * the browser's history, in the server's access log, in whatever proxy sits in
 * front of the school's server. Kept in the tab that issued it, it goes to the
 * printer and then it is gone.
 *
 * The iframe also buys the layout: `@media print` in globals.css assumes the
 * page *is* the document, so printing from the dossier would print the dossier.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slipHtml(
  credentials: IssuedPortalCredentials,
  t: Dictionary,
  locale: Locale,
): string {
  const dir = dirOf(locale);
  const e = escapeHtml;

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${e(t.family.portalSlipTitle)}</title>
<style>
  @page { size: A5; margin: 14mm; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif;
    color: #111827;
    margin: 0;
    line-height: 1.5;
  }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  .school { font-size: 11pt; font-weight: 600; letter-spacing: .02em; }
  .rule { border: 0; border-top: 1px solid #111827; margin: 3mm 0 5mm; }
  .meta { font-size: 10pt; color: #4b5563; margin: 0 0 6mm; }
  .box { border: 1px solid #111827; border-radius: 3mm; padding: 5mm; margin-bottom: 5mm; }
  .field { display: flex; gap: 4mm; align-items: baseline; margin-bottom: 3mm; }
  .field:last-child { margin-bottom: 0; }
  .label { font-size: 9pt; color: #4b5563; min-width: 30mm; }
  /* The two values that get typed into a phone: monospace and LTR, whatever
     the language of the slip, because a username is never Arabic script. */
  .value { font-family: ui-monospace, "Courier New", monospace; font-size: 13pt; font-weight: 700; direction: ltr; unicode-bidi: isolate; }
  .note { font-size: 9.5pt; color: #374151; margin: 0 0 2mm; }
  .warn { font-size: 9.5pt; font-weight: 600; }
</style>
</head>
<body>
  <div class="school">${e(credentials.schoolName)}</div>
  <h1>${e(t.family.portalSlipTitle)}</h1>
  <hr class="rule">

  <p class="meta">
    ${e(credentials.familyName)} · ${e(credentials.familyCode)}<br>
    ${e(credentials.guardianName)} · ${e(formatDate(new Date(), locale))}
  </p>

  <div class="box">
    <div class="field">
      <span class="label">${e(t.family.portalUsername)}</span>
      <span class="value">${e(credentials.username)}</span>
    </div>
    <div class="field">
      <span class="label">${e(t.family.portalPassword)}</span>
      <span class="value">${e(credentials.password)}</span>
    </div>
  </div>

  <p class="note">${e(interpolate(t.family.portalSlipIntro, { app: "Al Manar" }))}</p>
  <p class="note">${e(t.family.portalSlipChange)}</p>
  <p class="warn">${e(t.family.portalSlipWarning)}</p>
</body>
</html>`;
}

/**
 * Prints one slip. Resolves as soon as the print dialog has been handed the
 * document — what the user does with it after that is the browser's business.
 */
export function printPortalSlip(
  credentials: IssuedPortalCredentials,
  t: Dictionary,
  locale: Locale,
): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(slipHtml(credentials, t, locale));
  doc.close();

  // Removing the frame before the browser has finished with it cancels the job
  // in Safari, and `onafterprint` never fires in some of them — hence both.
  const cleanup = () => frame.remove();
  win.onafterprint = cleanup;
  setTimeout(cleanup, 60_000);

  win.focus();
  win.print();
}
