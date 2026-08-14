"use client";

import * as React from "react";
import Link from "next/link";
import { HomeIcon, LinkIcon, PhoneIcon, UnlinkIcon } from "lucide-react";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
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
import { Combobox } from "@/components/form/combobox";
import { Label } from "@/components/ui/label";
import { GuardiansPanel } from "@/modules/families/components/guardians-panel";
import type { GuardianRow } from "@/modules/families/queries";
import { attachStudentToFamilyAction } from "@/modules/students/actions";

/**
 * The pupil's household, from the pupil's side.
 *
 * Reuses the families module's own `GuardiansPanel`, so a phone number fixed
 * here is fixed on the dossier and vice versa — there is one guardian editor in
 * the app, not one per screen that happens to show guardians.
 */
export function StudentFamilyPanel({
  studentId,
  family,
  guardians,
  families,
  parentJobs,
  canManage,
  canManagePortal,
}: {
  studentId: string;
  family: {
    id: string;
    name: string;
    code: string;
    situation: string;
    phone: string | null;
  } | null;
  guardians: GuardianRow[];
  /** Dossiers to attach to, when the pupil has none. */
  families: { id: string; label: string }[];
  /** The school's own professions, active ones only — see ParentJob. */
  parentJobs: { id: string; name: string }[];
  canManage: boolean;
  canManagePortal: boolean;
}) {
  const t = useT();
  const [choice, setChoice] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function attach(familyId: string | null) {
    startTransition(async () => {
      const result = await attachStudentToFamilyAction(studentId, familyId);
      if (result.status === "success") {
        toast.success(result.message ?? t.student.updated);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  if (!family) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<HomeIcon className="size-5" />}
            title={t.student.noFamily}
            description={t.student.attachHint}
            action={
              canManage ? (
                <div className="flex w-full max-w-sm flex-col gap-3">
                  <div className="grid gap-2 text-start">
                    <Label htmlFor="attach-family">
                      {t.student.attachFamily}
                    </Label>
                    <Combobox
                      id="attach-family"
                      value={choice}
                      onValueChange={setChoice}
                      placeholder={t.family.attachTitle}
                      options={families.map((entry) => ({
                        value: entry.id,
                        label: entry.label,
                      }))}
                    />
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => attach(choice)}
                      disabled={pending || choice === ""}
                    >
                      <LinkIcon />
                      {t.student.attachFamily}
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/families/new">{t.family.newFamily}</Link>
                    </Button>
                  </div>
                </div>
              ) : undefined
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {family.name}
              <Badge variant="secondary">
                {
                  t.familyOptions.situations[
                    family.situation as keyof typeof t.familyOptions.situations
                  ]
                }
              </Badge>
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3">
              <span dir="ltr">{family.code}</span>
              {family.phone ? (
                <span className="flex items-center gap-1" dir="ltr">
                  <PhoneIcon className="size-3" />
                  {family.phone}
                </span>
              ) : null}
            </CardDescription>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/families/${family.id}`}>
                {t.student.viewFamily}
              </Link>
            </Button>
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => attach(null)}
                disabled={pending}
              >
                <UnlinkIcon />
                {t.student.detachFamily}
              </Button>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <GuardiansPanel
        familyId={family.id}
        guardians={guardians}
        parentJobs={parentJobs}
        canManage={canManage}
        canManagePortal={canManagePortal}
      />
    </div>
  );
}
