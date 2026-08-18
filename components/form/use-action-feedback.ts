"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ActionState } from "@/lib/action-state";
import { toastError } from "@/components/form/toast-error";

/**
 * Turns a Server Action result into a toast, and fires `onSuccess` (used to
 * close dialogs). Keyed on `state.key` so submitting the same form twice with
 * the same outcome still notifies.
 */
export function useActionFeedback(
  state: ActionState,
  { onSuccess }: { onSuccess?: () => void } = {},
) {
  const onSuccessRef = React.useRef(onSuccess);

  // Kept in an effect rather than assigned during render: refs must not be
  // written while rendering. Declared first so it lands before the effect below.
  React.useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  React.useEffect(() => {
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      onSuccessRef.current?.();
    } else if (state.status === "error" && state.message) {
      toastError(state.message);
    }
    // `key` changes on every result; the rest of `state` is read fresh above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.key]);
}
