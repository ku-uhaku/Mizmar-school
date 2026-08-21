"use client";

import { PrinterIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { CredentialsDialog } from "@/components/shared/credentials-dialog";
import { Button } from "@/components/ui/button";
import { printPortalSlip } from "@/modules/families/components/portal-slip";
import type { IssuedPortalCredentials } from "@/modules/families/service";

/**
 * The credentials a school hands a parent, shown once.
 *
 * There is no second chance by design: only the hash is stored, so nothing can
 * reissue this password — a school that loses it resets and hands over a new
 * one.
 *
 * Which is why printing lives here and nowhere else: this is the only moment
 * the password exists outside the parent's head, so the slip has to be taken
 * now or reissued later. The two lines themselves are `CredentialsDialog`,
 * shared with the staff account the office opens on the other side of the app.
 */
export function PortalAccountDialog({
  credentials,
  onOpenChange,
}: {
  credentials: IssuedPortalCredentials | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <CredentialsDialog
      open={Boolean(credentials)}
      onOpenChange={onOpenChange}
      title={t.family.portalCredentialsTitle}
      description={t.family.portalCredentialsBody}
      usernameLabel={t.family.portalUsername}
      passwordLabel={t.family.portalPassword}
      username={credentials?.username ?? ""}
      password={credentials?.password ?? ""}
      subject={
        credentials
          ? `${credentials.familyName} · ${credentials.guardianName}`
          : undefined
      }
    >
      {credentials ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => printPortalSlip(credentials, t, locale)}
        >
          <PrinterIcon className="size-4" />
          {t.family.portalPrint}
        </Button>
      ) : null}
    </CredentialsDialog>
  );
}
