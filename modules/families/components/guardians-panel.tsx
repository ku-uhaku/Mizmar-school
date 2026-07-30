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
import type { GuardianRow } from "@/modules/families/queries";

/**
 * The adults on a dossier. Shared by the family screen and the student
 * profile's family tab, so the two cannot drift apart in what they show or in
 * what they let you do.
 */
export function GuardiansPanel({
  familyId,
  guardians,
  canManage,
}: {
  familyId: string;
  guardians: GuardianRow[];
  canManage: boolean;
}) {
  const t = useT();
  const dialog = useGuardianDialog();
  const [deleting, setDeleting] = React.useState<GuardianRow | null>(null);
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
                    {guardian.profession ? (
                      <Detail icon={<BriefcaseIcon className="size-3" />}>
                        {guardian.profession}
                        {guardian.employer ? ` · ${guardian.employer}` : ""}
                      </Detail>
                    ) : null}
                  </div>
                </div>

                {canManage ? (
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
                      <DropdownMenuItem onSelect={() => dialog.openEdit(guardian)}>
                        <PencilIcon />
                        {t.common.edit}
                      </DropdownMenuItem>
                      {!guardian.isPrimaryContact ? (
                        <DropdownMenuItem onSelect={() => promote(guardian)}>
                          <StarIcon />
                          {t.family.makePrimary}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(guardian)}
                      >
                        <Trash2Icon />
                        {t.common.delete}
                      </DropdownMenuItem>
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
        />
      ) : null}

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
