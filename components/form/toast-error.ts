"use client";

import { toast } from "sonner";

/**
 * A failed action's message, as a toast that can hold more than one line.
 *
 * Most refusals are a sentence and land in the toast's title, exactly as
 * `toast.error(message)` would. A few have something to enumerate — the tables
 * still pointing at a row somebody tried to delete is the case this exists for
 * — and a sentence with five table names strung through it is unreadable. So
 * the convention is one message, `\n`-separated: the first line is the refusal
 * and everything after it is detail, which goes to the toast's description and
 * wraps line by line (`.cn-toast [data-description]` in app/globals.css keeps
 * the newlines).
 *
 * Detail is worth reading, so a toast carrying any stays up long enough to.
 */
export function toastError(message: string): void {
  const [headline, ...detail] = message.split("\n");

  if (detail.length === 0) {
    toast.error(headline);
    return;
  }

  toast.error(headline, {
    description: detail.join("\n"),
    duration: 10_000,
  });
}
