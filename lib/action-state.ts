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
  /**
   * What was submitted, echoed back so a rejected form can be redrawn with the
   * user's own text still in it.
   *
   * React resets an uncontrolled form as soon as its action returns — that is
   * the documented behaviour of passing a function to `<form action>`, and it
   * is right for the success case, where the next thing you want is an empty
   * form. On a validation failure it is exactly wrong: `defaultValue` snaps
   * back to whatever the row held and fifteen fields of typing are gone, which
   * is worse than no validation at all.
   *
   * So `failure()` carries the submitted values and the forms read their
   * defaults through `valueOf` in lib/form-values.ts. Only failures carry them:
   * echoing them on success would re-fill a form that is meant to clear.
   */
  values?: Record<string, string>;
  /** Bumped on every result so effects can react to repeat submissions. */
  key?: number;
};

/**
 * A result that carries something back beyond a message.
 *
 * Kept generic and domain-free so `lib/` stays that way: the one case it exists
 * for is a secret the server generates and the screen may show exactly once — a
 * password nobody can look up again — which has nowhere else to live, since the
 * whole point is that it is never stored.
 */
export type ActionStateWith<T> = ActionState & { data?: T };

export const IDLE: ActionState = { status: "idle" };

export function success(message?: string): ActionState {
  return { status: "success", message, key: Date.now() };
}

export function successWith<T>(
  data: T,
  message?: string,
): ActionStateWith<T> {
  return { status: "success", message, data, key: Date.now() };
}

export function failure(
  message?: string,
  fieldErrors?: Record<string, string>,
  values?: Record<string, string>,
): ActionState {
  return { status: "error", message, fieldErrors, values, key: Date.now() };
}
