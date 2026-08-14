"use client";

import * as React from "react";
import {
  BriefcaseIcon,
  IdCardIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SmartphoneIcon,
  StarIcon,
  Trash2Icon,
  UserPlusIcon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { interpolate } from "@/lib/i18n/format";
import {
  deleteGuardianAction,
  setPrimaryContactAction,
} from "@/modules/families/actions";
import {
  GuardianDialog,
  useGuardianDialog,
} from "@/modules/families/components/guardian-dialog";
import { PortalAccessCard } from "@/modules/families/components/portal-access-card";
import { PortalAccountDialog } from "@/modules/families/components/portal-account-dialog";
import type { IssuedPortalCredentials } from "@/modules/families/service";
import type { GuardianRow } from "@/modules/families/queries";

/**
 * The adults on a dossier. Shared by the family screen and the student
 * profile's family tab, so the two cannot drift apart in what they show or in
 * what they let you do.
 */
export function GuardiansPanel({
  familyId,
  guardians,
  parentJobs,
  canManage,
  canManagePortal = false,
}: {
  familyId: string;
  guardians: GuardianRow[];
  /** The school's own professions, active ones only — see ParentJob. */
  parentJobs: { id: string; name: string }[];
  canManage: boolean;
  /** Opening a login is its own authority — see modules/families/permissions.ts. */
  canManagePortal?: boolean;
}) {
  const t = useT();
  const dialog = useGuardianDialog();
  const [deleting, setDeleting] = React.useState<GuardianRow | null>(null);
  /**
   * Set when adding a guardian opened the dossier's access. Held here rather
   * than inside the form, which closes on success — the password is readable
   * for this one moment and must outlive the dialog that produced it.
   */
  const [credentials, setCredentials] =
    React.useState<IssuedPortalCredentials | null>(null);
  const [, startTransition] = React.useTransition();

  function promote(guardian: GuardianRow) {
    startTransition(async () => {
      const result = await setPrimaryContactAction(guardian.id);
      if (result.status === "success") {
        toast.success(result.message ?? t.family.guardianUpdated);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/*
        The household's login, above the adults on it: it belongs to the
        dossier rather than to any one of them, and "has this family got the
        app" is asked far more often than anything in the list below.
      */}
      <PortalAccessCard
        guardians={guardians}
        canManagePortal={canManagePortal}
      />

      <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 border-b">
        <div className="min-w-0">
          <CardTitle>{t.family.guardians}</CardTitle>
          <CardDescription>{t.family.guardiansHint}</CardDescription>
        </div>
        {canManage ? (
          <Button size="sm" onClick={dialog.openCreate} className="shrink-0">
            <PlusIcon />
            {t.family.addGuardian}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {guardians.length === 0 ? (
          <EmptyState
            icon={<UserPlusIcon className="size-5" />}
            title={t.family.noGuardians}
            action={
              canManage ? (
                <Button size="sm" onClick={dialog.openCreate}>
                  <PlusIcon />
                  {t.family.addGuardian}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y">
            {guardians.map((guardian) => (
              <li
                key={guardian.id}
                className="flex flex-wrap items-start gap-3 px-6 py-4"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {guardian.firstName} {guardian.lastName}
                    </span>
                    <Badge variant="secondary">
                      {
                        t.familyOptions.relationships[
                          guardian.relationship as keyof typeof t.familyOptions.relationships
                        ]
                      }
                    </Badge>
                    {guardian.isPrimaryContact ? (
                      <Badge className="gap-1">
                        <StarIcon className="size-3" />
                        {t.family.primaryContact}
                      </Badge>
                    ) : null}
                    {guardian.isEmergencyContact ? (
                      <Badge variant="outline">
                        {t.family.isEmergencyContact}
                      </Badge>
                    ) : null}
                    {guardian.portalAccount ? (
                      <Badge variant="secondary" className="gap-1">
                        <SmartphoneIcon className="size-3" />
                        {guardian.portalAccount.username ??
                          t.family.portalBadge}
                      </Badge>
                    ) : null}
                    {!guardian.isActive ? (
                      <Badge variant="outline">{t.common.inactive}</Badge>
                    ) : null}
                  </div>

                  {guardian.nameAr ? (
                    <p className="text-muted-foreground text-sm" dir="rtl">
                      {guardian.nameAr}
                    </p>
                  ) : null}

                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {guardian.phone ? (
                      <Detail icon={<PhoneIcon className="size-3" />} ltr>
                        {guardian.phone}
                      </Detail>
                    ) : null}
                    {guardian.email ? (
                      <Detail icon={<MailIcon className="size-3" />} ltr>
                        {guardian.email}
                      </Detail>
                    ) : null}
                    {guardian.nationalId ? (
                      <Detail icon={<IdCardIcon className="size-3" />} ltr>
                        {guardian.nationalId}
                      </Detail>
                    ) : null}
                    {guardian.parentJobName ? (
                      <Detail icon={<BriefcaseIcon className="size-3" />}>
                        {guardian.parentJobName}
                        {guardian.employer ? ` · ${guardian.employer}` : ""}
                      </Detail>
                    ) : null}
                  </div>
                </div>

                {canManage || canManagePortal ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.common.openMenu}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canManage ? (
                        <>
                          <DropdownMenuItem
                            onSelect={() => dialog.openEdit(guardian)}
                          >
                            <PencilIcon />
                            {t.common.edit}
                          </DropdownMenuItem>
                          {!guardian.isPrimaryContact ? (
                            <DropdownMenuItem
                              onSelect={() => promote(guardian)}
                            >
                              <StarIcon />
                              {t.family.makePrimary}
                            </DropdownMenuItem>
                          ) : null}
                        </>
                      ) : null}

                      {canManage ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(guardian)}
                          >
                            <Trash2Icon />
                            {t.common.delete}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {canManage ? (
        <GuardianDialog
          open={dialog.open}
          onOpenChange={dialog.setOpen}
          familyId={familyId}
          guardian={dialog.editing}
          parentJobs={parentJobs}
          // The first guardian opens the dossier's access, and this is the one
          // moment its password can be read — into the same dialog the manual
          // flow uses, which is where printing the slip lives.
          onCredentials={setCredentials}
        />
      ) : null}

      {/* The same "shown once" dialog the manual flow uses — see it for why
        printing lives there and nowhere else. */}
      <PortalAccountDialog
        credentials={credentials}
        onOpenChange={(open) => !open && setCredentials(null)}
      />

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.family.deleteGuardianTitle}
          description={interpolate(t.family.deleteGuardianBody, {
            name: `${deleting.firstName} ${deleting.lastName}`,
          })}
          action={() => deleteGuardianAction(deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
      </Card>
    </div>
  );
}

function Detail({
  icon,
  ltr,
  children,
}: {
  icon: React.ReactNode;
  ltr?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1" dir={ltr ? "ltr" : undefined}>
      {icon}
      {children}
    </span>
  );
}
