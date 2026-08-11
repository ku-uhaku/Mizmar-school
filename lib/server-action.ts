import "server-only";

import { recordEvent } from "@/lib/audit";
import { failure, type ActionState } from "@/lib/action-state";
import { ForbiddenError } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
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
    return failure(t.errors.unexpected);
  }
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
