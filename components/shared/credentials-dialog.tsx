"use client";

import * as React from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/**
 * A username and a password, shown once.
 *
 * Only the hash is stored, so nothing can reissue what is on screen — whoever
 * opened the account either writes it down now or resets it later. The dialog
 * says so plainly rather than letting the office assume they can come back
 * for it.
 *
 * Domain-free on purpose: a parent's access and a member of staff's are the
 * same two lines and the same one chance, and the two screens that hand them
 * over should not drift apart. What differs — the wording, who it belongs to,
 * whether there is a slip to print — is passed in.
 */
export function CredentialsDialog({
  open,
  onOpenChange,
  title,
  description,
  usernameLabel,
  passwordLabel,
  username,
  password,
  /** Who this belongs to, printed above the two lines. */
  subject,
  /** Extra footer actions, placed before Close — a print button, typically. */
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  usernameLabel: string;
  passwordLabel: string;
  username: string;
  password: string;
  subject?: string;
  children?: React.ReactNode;
}) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {subject ? (
            <p className="text-muted-foreground text-sm">{subject}</p>
          ) : null}
          <CredentialRow label={usernameLabel} value={username} />
          <CredentialRow label={passwordLabel} value={password} />
        </div>

        <DialogFooter>
          {children}
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const t = useT();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    // Unavailable over plain http, which is how a school on a local network may
    // well be running this — so the value stays selectable either way.
    await navigator.clipboard?.writeText(value);
    setCopied(true);
  }

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <code
          className="bg-muted flex-1 overflow-x-auto rounded-md px-3 py-2 font-mono text-sm select-all"
          dir="ltr"
        >
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={copied ? t.common.copied : t.common.copy}
          onClick={copy}
        >
          {copied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
