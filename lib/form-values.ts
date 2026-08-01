import type { ActionState } from "@/lib/action-state";

/**
 * Reading a form's defaults back off a rejected submission.
 *
 * Isomorphic on purpose: `formValues` runs in the action to capture what was
 * sent, `valueOf` runs in the component to redraw it, and keeping them in one
 * file is what stops the two disagreeing about how a checkbox is spelled.
 *
 * See the note on `ActionState.values` for why this exists at all.
 */

/**
 * Flattens a `FormData` into plain strings.
 *
 * Files are dropped: their content cannot survive a round trip through the
 * action state, and a data URI from the image picker arrives as a string field
 * anyway. Repeated keys keep the *last* value, which matches how a plain
 * `formData.get` reads them — the parallel-array forms (mark sheets, registers)
 * do not use this, since a half-restored roster would be worse than a cleared
 * one.
 */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

/**
 * The default for a field: what was just submitted, or the stored value.
 *
 * `undefined` rather than `""` is the test — a field cleared on purpose sends
 * an empty string, and treating that as "nothing was sent" would put the old
 * value back into a box the user had deliberately emptied.
 */
export function valueOf(
  state: ActionState,
  name: string,
  fallback: string | null | undefined,
): string {
  return state.values?.[name] ?? fallback ?? "";
}

/**
 * The same, for a checkbox or switch.
 *
 * An unchecked box sends nothing at all, so its absence from a submission that
 * *did* happen means false — which is why this keys off whether `values` exists
 * rather than whether the field does.
 */
export function checkedOf(
  state: ActionState,
  name: string,
  fallback: boolean,
): boolean {
  if (!state.values) return fallback;
  const value = state.values[name];
  return value === "on" || value === "true" || value === "1";
}
