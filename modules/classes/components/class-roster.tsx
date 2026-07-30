"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRightIcon, ListIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { TransferList, type TransferItem } from "@/components/shared/transfer-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { interpolate } from "@/lib/i18n/format";
import { ageFrom, cn } from "@/lib/utils";
import { assignClassAction } from "@/modules/enrolment/actions";
import type { ClassDetail, RosterEntry } from "@/modules/classes/queries";

/**
 * Who sits in this class, in two views of the same thing.
 *
 *   Assign — two boxes and the arrows between them, for filling a class
 *   List   — the roster as a list, for reading it and setting groups
 *
 * "Adding a student" is really a write to their *enrolment*, which is why it
 * calls the enrolment module's own action rather than reimplementing the rule.
 * The candidates offered are exactly the pupils enrolled at this class's level
 * and seated nowhere yet: a child cannot be put in a class for a level they
 * were not admitted to, so the list, not a validation message, is what stops it.
 */
export function ClassRoster({
  schoolClass,
  candidates,
  canManage,
}: {
  schoolClass: ClassDetail;
  candidates: { id: string; enrollmentId: string; label: string }[];
  canManage: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = React.useTransition();

  const available: TransferItem[] = candidates.map((candidate) => ({
    id: candidate.enrollmentId,
    label: candidate.label.split(" — ")[0],
    detail: candidate.label.split(" — ")[1],
  }));

  const assigned: TransferItem[] = schoolClass.roster.map((pupil) => ({
    id: pupil.enrollmentId,
    label: `${pupil.lastName} ${pupil.firstName}`,
    detail: pupil.code,
    badge: pupil.groupLabel ?? undefined,
  }));

  /**
   * One action per pupil rather than a batch endpoint: seating is idempotent
   * and independent per child, so a failure on one leaves the rest seated.
   */
  function move(ids: string[], to: "assigned" | "available") {
    startTransition(async () => {
      const results = await Promise.all(
        ids.map((enrollmentId) =>
          assignClassAction(
            enrollmentId,
            to === "assigned" ? schoolClass.id : null,
          ),
        ),
      );

      const moved = results.filter((result) => result.status === "success").length;
      const failed = results.length - moved;

      if (moved > 0) {
        toast.success(
          interpolate(
            to === "assigned"
              ? t.schoolClass.studentsAdded
              : t.schoolClass.studentsRemoved,
            { count: moved },
          ),
        );
      }
      if (failed > 0) toast.error(t.errors.unexpected);
    });
  }

  const over =
    schoolClass.capacity !== null && schoolClass.enrolled > schoolClass.capacity;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t.schoolClass.roster}</CardTitle>
        <CardDescription>
          {canManage ? t.schoolClass.rosterAssignHint : t.schoolClass.rosterHint}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!canManage ? (
          <RosterList
            roster={schoolClass.roster}
            groups={schoolClass.groups}
            schoolClassId={schoolClass.id}
            canManage={false}
          />
        ) : (
          <Tabs defaultValue="assign">
            <TabsList className="mb-4">
              <TabsTrigger value="assign">
                <ArrowLeftRightIcon />
                {t.schoolClass.tabAssign}
              </TabsTrigger>
              <TabsTrigger value="list">
                <ListIcon />
                {t.schoolClass.tabList}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assign">
              <TransferList
                available={available}
                assigned={assigned}
                availableTitle={t.schoolClass.availableTitle}
                assignedTitle={interpolate(t.schoolClass.assignedTitle, {
                  class: schoolClass.code,
                })}
                availableEmpty={t.schoolClass.noCandidates}
                assignedEmpty={t.schoolClass.emptyRoster}
                onMove={move}
                disabled={pending}
                footer={
                  <p
                    className={cn(
                      "text-xs",
                      over ? "text-destructive font-medium" : "text-muted-foreground",
                    )}
                  >
                    {schoolClass.capacity === null
                      ? t.schoolClass.noCapacity
                      : over
                        ? `${t.schoolClass.overCapacity} — ${interpolate(
                            t.schoolClass.fill,
                            {
                              enrolled: schoolClass.enrolled,
                              capacity: schoolClass.capacity,
                            },
                          )}`
                        : interpolate(t.schoolClass.seatsLeftHint, {
                            count: schoolClass.capacity - schoolClass.enrolled,
                          })}
                  </p>
                }
              />
            </TabsContent>

            <TabsContent value="list">
              <RosterList
                roster={schoolClass.roster}
                groups={schoolClass.groups}
                schoolClassId={schoolClass.id}
                canManage
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

/** The roster as a numbered list — how a class list is actually read out. */
function RosterList({
  roster,
  groups,
  schoolClassId,
  canManage,
}: {
  roster: RosterEntry[];
  groups: { id: string; label: string }[];
  schoolClassId: string;
  canManage: boolean;
}) {
  const t = useT();

  if (roster.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon className="size-5" />}
        title={t.schoolClass.emptyRoster}
        description={t.schoolClass.emptyRosterHint}
      />
    );
  }

  return (
    <ul className="divide-y">
      {roster.map((pupil, index) => (
        <RosterRow
          key={pupil.enrollmentId}
          pupil={pupil}
          index={index + 1}
          groups={groups}
          schoolClassId={schoolClassId}
          canManage={canManage}
        />
      ))}
    </ul>
  );
}

function RosterRow({
  pupil,
  index,
  groups,
  schoolClassId,
  canManage,
}: {
  pupil: RosterEntry;
  index: number;
  groups: { id: string; label: string }[];
  schoolClassId: string;
  canManage: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = React.useTransition();

  const age = ageFrom(pupil.birthDate);
  const initials = `${pupil.firstName[0] ?? ""}${pupil.lastName[0] ?? ""}`
    .toUpperCase()
    .trim();

  function moveToGroup(groupId: string) {
    startTransition(async () => {
      const result = await assignClassAction(
        pupil.enrollmentId,
        schoolClassId,
        groupId === "__none__" ? null : groupId,
      );
      if (result.status === "success") {
        toast.success(result.message ?? t.enrolment.classAssigned);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="text-muted-foreground w-6 shrink-0 text-xs tabular-nums">
        {index}
      </span>

      <Avatar className="size-8 shrink-0">
        {pupil.photoUrl ? <AvatarImage src={pupil.photoUrl} alt="" /> : null}
        <AvatarFallback className="text-[10px]">
          {initials || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <Link
          href={`/students/${pupil.studentId}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {pupil.lastName} {pupil.firstName}
        </Link>
        <p className="text-muted-foreground flex flex-wrap gap-x-2 truncate text-xs">
          <span dir="ltr">{pupil.code}</span>
          <span>
            {
              t.studentOptions.genders[
                pupil.gender as keyof typeof t.studentOptions.genders
              ]
            }
          </span>
          {age === null ? null : <span className="tabular-nums">{age}</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {pupil.isRepeating ? (
          <Badge variant="outline">{t.enrolment.isRepeating}</Badge>
        ) : null}

        {canManage && groups.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={pending}>
                {pupil.groupLabel ?? t.schoolClass.noGroup}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t.schoolClass.setGroup}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={pupil.classGroupId ?? "__none__"}
                onValueChange={moveToGroup}
              >
                <DropdownMenuRadioItem value="__none__">
                  {t.schoolClass.noGroup}
                </DropdownMenuRadioItem>
                {groups.map((group) => (
                  <DropdownMenuRadioItem key={group.id} value={group.id}>
                    {group.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : pupil.groupLabel ? (
          <Badge variant="secondary">{pupil.groupLabel}</Badge>
        ) : null}
      </div>
    </li>
  );
}
