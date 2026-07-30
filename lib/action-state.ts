/**
 * Shared shape for every Server Action result.
 *
 * Expected failures (validation, permissions, conflicts) come back as values so
 * `useActionState` can render them; only genuinely unexpected errors are left
 * to throw and reach error.tsx.
 */
export type ActionState = {
  status: "idle" | "success" | "error";
  /** Message shown in a toast or an inline banner. */
  message?: string;
  /** Keyed by form field name. */
  fieldErrors?: Record<string, string>;
  /** Bumped on every result so effects can react to repeat submissions. */
  key?: number;
};

export const IDLE: ActionState = { status: "idle" };

export function success(message?: string): ActionState {
  return { status: "success", message, key: Date.now() };
}

export function failure(
  message?: string,
  fieldErrors?: Record<string, string>,
): ActionState {
  return { status: "error", message, fieldErrors, key: Date.now() };
}
