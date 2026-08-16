"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/i18n-provider";

/**
 * Submit button that reflects the enclosing form's pending state. Must be a
 * child of the <form> it submits — that is how useFormStatus finds it.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  className,
  disabled,
  pending: pendingProp,
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
  /**
   * Pending state, for the forms that drive the submission themselves.
   *
   * `useFormStatus` only reports for a form given React the `action` prop —
   * and a form that must not be reset afterwards cannot use it, since the
   * reset comes with it. Those forms submit inside a transition and pass
   * `useActionState`'s own pending flag here instead. See `EnrolmentPanel`.
   */
  pending?: boolean;
}) {
  const t = useT();
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
    >
      {pending ? (
        <>
          <Loader2Icon className="animate-spin" />
          {pendingLabel ?? t.common.saving}
        </>
      ) : (
        (children ?? t.common.save)
      )}
    </Button>
  );
}
