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

export type PortalCredentials = { username: string; password: string };

/**
 * The credentials a school hands a parent, shown once.
 *
 * There is no second chance by design: only the hash is stored, so nothing can
 * reissue this password — a school that loses it resets and hands over a new
 * one. The dialog therefore says so plainly rather than letting a secretary
 * assume they can come back for it.
 */
export function PortalAccountDialog({
  credentials,
  onOpenChange,
}: {
  credentials: PortalCredentials | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();

  return (
    <Dialog open={Boolean(credentials)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            {t.family.portalCredentialsTitle}
          </DialogTitle>
          <DialogDescription>
            {t.family.portalCredentialsBody}
          </DialogDescription>
        </DialogHeader>

        {credentials ? (
          <div className="grid gap-3">
            <CredentialRow
              label={t.family.portalUsername}
              value={credentials.username}
            />
            <CredentialRow
              label={t.family.portalPassword}
              value={credentials.password}
            />
          </div>
        ) : null}

        <DialogFooter>
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
          aria-label={copied ? t.family.portalCopied : t.family.portalCopy}
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
