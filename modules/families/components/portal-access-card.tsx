"use client";

import * as React from "react";
import {
  KeyRoundIcon,
  SmartphoneIcon,
  SmartphoneNfcIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { interpolate } from "@/lib/i18n/format";
import {
  resetPortalPasswordAction,
  revokePortalAccountAction,
} from "@/modules/families/actions";
import {
  PortalAccountDialog,
} from "@/modules/families/components/portal-account-dialog";
import { PortalPasswordDialog } from "@/modules/families/components/portal-password-dialog";
import type { GuardianRow } from "@/modules/families/queries";
import type { IssuedPortalCredentials } from "@/modules/families/service";

/**
 * The family's login, on the face of the dossier.
 *
 * It sits above the list of adults rather than inside one adult's menu because
 * the access belongs to the *household* — one login per dossier, opened for
 * whichever parent the school deals with — and a school's real question is
 * "does this family have the app yet", which a menu three clicks down cannot
 * answer. Every dossier should end up with one, so a file without one says so
 * in the place a file with one shows its username.
 *
 * Read-only readers see the same card without the buttons: knowing an access
 * exists is part of reading a dossier, opening one is `family.portal`.
 */
export function PortalAccessCard({
  guardians,
  canManagePortal,
}: {
  guardians: GuardianRow[];
  canManagePortal: boolean;
}) {
  const t = useT();
  const [, startTransition] = React.useTransition();
  const [credentials, setCredentials] =
    React.useState<IssuedPortalCredentials | null>(null);
  const [passwordDialog, setPasswordDialog] = React.useState<
    "open" | "reset" | null
  >(null);
  const [revoking, setRevoking] = React.useState(false);

  const holder = guardians.find((guardian) => guardian.portalAccount) ?? null;
  const account = holder?.portalAccount ?? null;

  function issueRandom() {
    if (!holder) return;
    startTransition(async () => {
      // No password argument: the server generates one, which is the right
      // default when nobody is standing at the counter to be told it.
      const result = await resetPortalPasswordAction(holder.id);
      if (result.status === "success" && result.data) {
        toast.success(result.message ?? t.family.portalPasswordReset);
        setCredentials(result.data);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <SmartphoneIcon className="size-4" />
          {t.family.portalAccess}
        </CardTitle>
        <CardDescription>{t.family.portalAccessHint}</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {holder && account ? (
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <code
                  className="bg-muted rounded-md px-2 py-1 font-mono text-sm"
                  dir="ltr"
                >
                  {account.username ?? "—"}
                </code>
                {/* An account still linked to the dossier is never "revoked" —
                  revoking unlinks it. Switched off here means the rule switched
                  it off: nobody on this file is enrolled for the current year.
                  Saying which is the difference between a secretary reaching
                  for the reset button and understanding there is nothing to
                  fix. */}
                <Badge variant={account.isActive ? "secondary" : "outline"}>
                  {account.isActive ? t.common.active : t.family.portalDormant}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <UserIcon className="size-3" />
                {t.family.portalHeldBy}: {holder.firstName} {holder.lastName}
              </p>
              {!account.isActive ? (
                <p className="text-muted-foreground text-xs">
                  {t.family.portalDormantHint}
                </p>
              ) : null}
            </div>

            {canManagePortal ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPasswordDialog("reset")}>
                  <KeyRoundIcon />
                  {t.family.portalChangePassword}
                </Button>
                <Button size="sm" variant="outline" onClick={issueRandom}>
                  {t.family.portalGeneratePassword}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRevoking(true)}
                >
                  {t.family.revokePortalAccount}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            icon={<SmartphoneNfcIcon className="size-5" />}
            title={t.family.portalNoAccess}
            description={t.family.portalAccountHint}
            action={
              canManagePortal && guardians.length > 0 ? (
                <Button size="sm" onClick={() => setPasswordDialog("open")}>
                  <SmartphoneIcon />
                  {t.family.portalOpenAccess}
                </Button>
              ) : undefined
            }
          />
        )}
      </CardContent>

      {canManagePortal && passwordDialog ? (
        <PortalPasswordDialog
          open
          onOpenChange={(open) => !open && setPasswordDialog(null)}
          mode={passwordDialog}
          guardians={guardians}
          guardianId={passwordDialog === "reset" ? (holder?.id ?? null) : null}
          onIssued={setCredentials}
        />
      ) : null}

      {holder ? (
        <ConfirmDelete
          open={revoking}
          onOpenChange={setRevoking}
          title={t.family.revokePortalTitle}
          description={interpolate(t.family.revokePortalBody, {
            name: `${holder.firstName} ${holder.lastName}`.trim(),
          })}
          action={() => revokePortalAccountAction(holder.id)}
          onDeleted={() => setRevoking(false)}
        />
      ) : null}

      {/* Shown once, whichever door issued it — see the dialog's own note. */}
      <PortalAccountDialog
        credentials={credentials}
        onOpenChange={(open) => !open && setCredentials(null)}
      />
    </Card>
  );
}
