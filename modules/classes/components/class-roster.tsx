"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRightIcon,
  LayoutGridIcon,
  ListIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import {
  TransferList,
  type TransferItem,
} from "@/components/shared/transfer-list";
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

      const moved = results.filter(
        (result) => result.status === "success",
      ).length;
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
    schoolClass.capacity !== null &&
    schoolClass.enrolled > schoolClass.capacity;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t.schoolClass.roster}</CardTitle>
        <CardDescription>
          {canManage
            ? t.schoolClass.rosterAssignHint
            : t.schoolClass.rosterHint}
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
                      over
                        ? "text-destructive font-medium"
                        : "text-muted-foreground",
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

type RosterView = "LIST" | "CARDS";

const ROSTER_VIEW_KEY = "roster-view";

/**
 * The remembered choice of list or cards.
 *
 * `useSyncExternalStore` rather than state seeded in an effect: localStorage is
 * a store outside React, the server has no access to it, and reading it in an
 * effect means one render as a list before it flips — which is a visible jump
 * and the thing the lint rule is there to prevent. The server snapshot is the
 * list, so the markup matches on hydration and only then follows the store.
 */
function useRosterView(): RosterView {
  return React.useSyncExternalStore(
    (onChange) => {
      // `storage` covers the other tabs; the custom event covers this one.
      window.addEventListener("storage", onChange);
      window.addEventListener(ROSTER_VIEW_KEY, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(ROSTER_VIEW_KEY, onChange);
      };
    },
    () =>
      window.localStorage.getItem(ROSTER_VIEW_KEY) === "CARDS"
        ? "CARDS"
        : "LIST",
    // Rendered on the server, where there is no preference to read.
    () => "LIST",
  );
}

/**
 * The roster, as a list or as cards.
 *
 * ── Why both, rather than one or the other ──────────────────────────────────
 * They answer different questions. The numbered list is a *class list*: it is
 * read out at the rentrée, printed, counted down — which is why it is numbered
 * and why every pupil is one line. The cards are for *recognising* somebody:
 * the photograph is large enough to match a face at the counter, which is what
 * a secretary handed a name actually needs.
 *
 * The choice is remembered per browser rather than per class, because it is a
 * preference about how somebody reads and not a fact about 3AP-B.
 */
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
  const view = useRosterView();

  function choose(next: RosterView) {
    window.localStorage.setItem(ROSTER_VIEW_KEY, next);
    // Same-document writes do not raise `storage`, so the subscribers are
    // nudged by hand — that is what keeps two rosters on one page in step.
    window.dispatchEvent(new Event(ROSTER_VIEW_KEY));
  }

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
    <div className="grid gap-3">
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant={view === "LIST" ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={t.schoolClass.viewList}
          aria-pressed={view === "LIST"}
          onClick={() => choose("LIST")}
        >
          <ListIcon />
        </Button>
        <Button
          type="button"
          variant={view === "CARDS" ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={t.schoolClass.viewCards}
          aria-pressed={view === "CARDS"}
          onClick={() => choose("CARDS")}
        >
          <LayoutGridIcon />
        </Button>
      </div>

      {view === "CARDS" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {roster.map((pupil, index) => (
            <RosterCard
              key={pupil.enrollmentId}
              pupil={pupil}
              index={index + 1}
              groups={groups}
              schoolClassId={schoolClassId}
              canManage={canManage}
            />
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}

/**
 * One pupil, big enough to recognise.
 *
 * The photograph leads and the name sits under it, which is the opposite of the
 * list and deliberately so — a card is looked *at*, a list is read *down*. The
 * group control is the same one the row carries, so a class can be split from
 * either view without learning two interfaces.
 */
function RosterCard({
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
    <div className="bg-card ring-foreground/10 relative flex flex-col items-center gap-2 rounded-xl p-4 text-center ring-1">
      {/* The number is kept: a card view still has to agree with the printed
        class list somebody is holding. */}
      <span className="text-muted-foreground absolute start-2 top-2 text-[10px] tabular-nums">
        {index}
      </span>
      {pupil.isRepeating ? (
        <Badge variant="outline" className="absolute end-2 top-2 text-[10px]">
          {t.enrolment.isRepeating}
        </Badge>
      ) : null}

      <Avatar className="size-16">
        {pupil.photoUrl ? <AvatarImage src={pupil.photoUrl} alt="" /> : null}
        <AvatarFallback className="text-sm">{initials || "?"}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 w-full">
        <Link
          href={`/students/${pupil.studentId}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {pupil.lastName} {pupil.firstName}
        </Link>
        <p className="text-muted-foreground truncate text-xs" dir="ltr">
          {pupil.code}
        </p>
        <p className="text-muted-foreground text-xs">
          {
            t.studentOptions.genders[
              pupil.gender as keyof typeof t.studentOptions.genders
            ]
          }
          {age === null ? null : ` · ${age}`}
        </p>
      </div>

      {canManage && groups.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              className="w-full"
            >
              {pupil.groupLabel ?? t.schoolClass.noGroup}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
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
