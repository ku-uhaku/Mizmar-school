import "server-only";

import { recordEvent } from "@/lib/audit";
import { failure, type ActionState } from "@/lib/action-state";
import { ForbiddenError } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/types";
import { ACCESS_ENTITY } from "@/modules/audit/enums";

/**
 * Wraps a Server Action body so authorization failures become a localised
 * message instead of a stack trace, while letting genuine bugs and Next's own
 * control-flow throws (redirect, notFound) propagate untouched.
 *
 * Generic in the result so an action that carries something back — see
 * `ActionStateWith` — keeps its payload type through the wrapper. Every failure
 * this produces is a plain `ActionState`, which is assignable to it: the payload
 * is optional precisely because a refusal has none.
 */
export async function withActionErrors<S extends ActionState>(
  run: () => Promise<S>,
): Promise<S | ActionState> {
  try {
    return await run();
  } catch (error) {
    // `redirect()` and `notFound()` work by throwing — never swallow those.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string"
    ) {
      throw error;
    }

    const t = await getDictionary();

    if (error instanceof ForbiddenError) {
      // A refusal is the one kind of failure the trail has to hear about: it is
      // either somebody who needs a permission they have not been given, or
      // somebody reaching for a Server Function they were never shown. Recorded
      // where the refusal is caught, so every action gets it for free.
      await recordEvent({
        action: "DENIED",
        entity: ACCESS_ENTITY,
        metadata: error.permission ? { permission: error.permission } : null,
      });

      return failure(t.errors.forbidden);
    }

    console.error("Server action failed:", error);
    return failure(unexpectedMessage(t, error));
  }
}

/**
 * What a genuine bug says on screen: the reason itself while developing, the
 * localised apology in production.
 *
 * A toast reading only "something went wrong" sends whoever is building the app
 * to the terminal for every failure, and the terminal is not always the window
 * they are looking at — a missing column, a unique clash and a dropped
 * connection all look identical from the browser. In production the text is
 * never shown: a Prisma or driver message names tables, columns and
 * constraints, which is not something a school is told, and it is in the server
 * log either way.
 *
 * ── Why the last line, and not the first ────────────────────────────────────
 * A Prisma failure opens with the call site and a dump of every argument it was
 * given — thirty lines of it for an upsert — and puts the sentence that says
 * what actually went wrong at the very end. Printing the first 300 characters
 * therefore shows the dump and truncates the answer, which is a toast that
 * looks informative and tells you nothing. The code (`P2028`, `P2002`) goes in
 * front of it, because it is the half worth searching for.
 */
function unexpectedMessage(t: Dictionary, error: unknown): string {
  if (process.env.NODE_ENV === "production") return t.errors.unexpected;

  const detail = error instanceof Error ? error.message : String(error);
  const lines = detail
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const reason = lines[lines.length - 1] ?? "";
  const code =
    typeof (error as { code?: unknown })?.code === "string"
      ? `${(error as { code: string }).code} · `
      : "";

  return reason
    ? `${t.errors.unexpected} — ${code}${reason.slice(0, 500)}`
    : t.errors.unexpected;
}

/** Reads a trimmed string field out of FormData. */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Reads a checkbox: present means checked. */
export function boolField(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

/** Reads a repeated field (multi-select, checkbox group). */
export function listField(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
}
