import "server-only";

import { failure, type ActionState } from "@/lib/action-state";
import { ForbiddenError } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";

/**
 * Wraps a Server Action body so authorization failures become a localised
 * message instead of a stack trace, while letting genuine bugs and Next's own
 * control-flow throws (redirect, notFound) propagate untouched.
 */
export async function withActionErrors(
  run: () => Promise<ActionState>,
): Promise<ActionState> {
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
