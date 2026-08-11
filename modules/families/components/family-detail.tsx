"use client";

import Link from "next/link";
import { CakeIcon, GraduationCapIcon, UsersIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/i18n/format";
import { FamilyForm } from "@/modules/families/components/family-form";
import { GuardiansPanel } from "@/modules/families/components/guardians-panel";
import { FamilyReceipts } from "@/modules/treasury/components/family-receipts";
import type { PaymentRow } from "@/modules/treasury/queries";
import type { FamilyDetail as FamilyDetailData } from "@/modules/families/queries";
import { ageFrom } from "@/lib/utils";

/**
 * One dossier, in four tabs: the household's own details, the adults on it, the
 * children attached to it, and what it has paid. Tabs rather than one long page
 * because they are read by different people at different times — a secretary
 * fixes a phone number, a director checks who may collect a child, a bursar
 * answers "j'ai payé en novembre" with the receipt in front of them.
 */
export function FamilyDetail({
  family,
  receipts,
  canManage,
  canManagePortal,
}: {
  family: FamilyDetailData;
  /**
   * The household's receipts for the year. Null when the reader may not see
   * money — the tab is absent rather than empty, like the pupil's own.
   */
  receipts: PaymentRow[] | null;
  canManage: boolean;
  canManagePortal: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <Tabs defaultValue="details">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="details">{t.family.household}</TabsTrigger>
        <TabsTrigger value="guardians">
          {t.family.guardians}
          <Badge variant="secondary" className="ms-1.5 tabular-nums">
            {family.guardianCount}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="children">
          {t.family.children}
          <Badge variant="secondary" className="ms-1.5 tabular-nums">
            {family.childCount}
          </Badge>
        </TabsTrigger>
        {receipts ? (
          <TabsTrigger value="payments">
            {t.treasury.payments}
            <Badge variant="secondary" className="ms-1.5 tabular-nums">
              {receipts.length}
            </Badge>
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="details">
        <FamilyForm family={family} />
      </TabsContent>

      {receipts ? (
        <TabsContent value="payments">
          <FamilyReceipts receipts={receipts} />
        </TabsContent>
      ) : null}

      <TabsContent value="guardians">
        <GuardiansPanel
          familyId={family.id}
          guardians={family.guardians}
          canManage={canManage}
          canManagePortal={canManagePortal}
        />
      </TabsContent>

      <TabsContent value="children">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t.family.children}</CardTitle>
            <CardDescription>{t.family.childrenHint}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {family.children.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="size-5" />}
                title={t.family.noChildren}
                description={t.student.attachHint}
              />
            ) : (
              <ul className="divide-y">
                {family.children.map((child) => {
                  const age = ageFrom(child.birthDate);
                  const initials = `${child.firstName[0] ?? ""}${
                    child.lastName[0] ?? ""
                  }`.toUpperCase();

                  return (
                    <li
                      key={child.id}
                      className="flex items-center gap-3 px-6 py-3"
                    >
                      <Avatar className="size-9 shrink-0">
                        {child.photoUrl ? (
                          <AvatarImage src={child.photoUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {initials || "?"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/students/${child.id}`}
                          className="truncate font-medium hover:underline"
                        >
                          {child.firstName} {child.lastName}
                        </Link>
                        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
                          <span dir="ltr">{child.code}</span>
                          <span className="flex items-center gap-1">
                            <CakeIcon className="size-3" />
                            {formatDate(child.birthDate, locale)}
                            {age === null ? "" : ` · ${age}`}
                          </span>
                        </p>
                      </div>

                      <Badge variant="outline" className="shrink-0 gap-1">
                        <GraduationCapIcon className="size-3" />
                        {
                          t.studentOptions.statuses[
                            child.status as keyof typeof t.studentOptions.statuses
                          ]
                        }
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
