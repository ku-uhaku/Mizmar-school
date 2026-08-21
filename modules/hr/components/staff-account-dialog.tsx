"use client";

import { useT } from "@/components/providers/i18n-provider";
import { CredentialsDialog } from "@/components/shared/credentials-dialog";
import type { IssuedStaffCredentials } from "@/modules/hr/actions";

/**
 * The login a school hands a new employee, shown once.
 *
 * The same two lines a parent gets — see `CredentialsDialog` — with the role
 * named beside them, because the whole point of opening the account with the
 * hire is that nobody chose it deliberately: the director should see what the
 * job turned out to grant before the employee walks off with it.
 */
export function StaffAccountDialog({
  credentials,
  onOpenChange,
}: {
  credentials: IssuedStaffCredentials | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();

  return (
    <CredentialsDialog
      open={Boolean(credentials)}
      onOpenChange={onOpenChange}
      title={t.hr.accountCredentialsTitle}
      description={t.hr.accountCredentialsBody}
      usernameLabel={t.hr.accountUsername}
      passwordLabel={t.hr.accountPassword}
      username={credentials?.username ?? ""}
      password={credentials?.password ?? ""}
      subject={
        credentials
          ? `${credentials.staffName} · ${credentials.roleName ?? t.hr.accountNoRole}`
          : undefined
      }
    />
  );
}
