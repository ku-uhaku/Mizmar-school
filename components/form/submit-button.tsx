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
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const { pending } = useFormStatus();

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
