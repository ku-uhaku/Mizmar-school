"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ActionState } from "@/lib/action-state";
import { useT } from "@/components/providers/i18n-provider";
import { toastError } from "@/components/form/toast-error";

/**
 * Runs a bound Server Action from a button rather than a form, and reports it.
 *
 * The counterpart to `useActionFeedback`: that one watches a `useActionState`
 * result, this one is for the row actions that carry their argument already
 * bound — approving a leave request, ending a contract — where there is no form
 * and therefore no state to watch.
 *
 * `run` is stable across renders, so a screen building its table columns in a
 * `useMemo` can name it as a dependency honestly.
 */
export function useToastedTransition(): {
  isPending: boolean;
  run: (action: () => Promise<ActionState>) => void;
} {
  const t = useT();
  const [isPending, startTransition] = React.useTransition();

  const run = React.useCallback(
    (action: () => Promise<ActionState>) => {
      startTransition(async () => {
        const result = await action();
        if (result.status === "success") toast.success(result.message ?? "");
        else if (result.status === "error") {
          toastError(result.message ?? t.errors.unexpected);
        }
      });
    },
    [startTransition, t],
  );

  return { isPending, run };
}
