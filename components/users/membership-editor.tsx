"use client";

import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SchoolChoice = { id: string; name: string; code: string };
export type RoleChoice = { id: string; name: string };

const NO_ACCESS = "none";

/**
 * One row per school, each with a "no access" option or a school-scoped role.
 * Selected pairs are submitted as `schoolId:roleId` under the `memberships`
 * name, which the action re-validates before writing.
 */
export function MembershipEditor({
  schools,
  roles,
  defaultValue,
  disabled,
}: {
  schools: SchoolChoice[];
  roles: RoleChoice[];
  /** schoolId -> roleId */
  defaultValue: Record<string, string>;
  disabled?: boolean;
}) {
  const t = useT();
  const [assignments, setAssignments] =
    React.useState<Record<string, string>>(defaultValue);

  function setRole(schoolId: string, roleId: string) {
    setAssignments((current) => {
      const next = { ...current };
      if (roleId === NO_ACCESS) delete next[schoolId];
      else next[schoolId] = roleId;
      return next;
    });
  }

  const assignedCount = Object.keys(assignments).length;

  if (schools.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t.context.noSchoolsAvailable}
      </p>
    );
  }

  if (roles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t.role.noRoles}</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {t.user.schoolAccessHint}
        </p>
        <Badge variant="secondary">
          {assignedCount === 0 ? t.user.noAccess : `${assignedCount}`}
        </Badge>
      </div>

      <div className="divide-y rounded-lg border">
        {schools.map((school) => {
          const value = assignments[school.id] ?? NO_ACCESS;
          const selectId = `membership-${school.id}`;

          return (
            <div
              key={school.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <Label htmlFor={selectId} className="text-sm font-medium">
                  {school.name}
                </Label>
                <p className="text-muted-foreground text-xs" dir="ltr">
                  {school.code}
                </p>
              </div>

              <Select
                value={value}
                onValueChange={(next) => setRole(school.id, next)}
                disabled={disabled}
              >
                <SelectTrigger id={selectId} className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCESS}>{t.user.noAccess}</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {value !== NO_ACCESS ? (
                <input
                  type="hidden"
                  name="memberships"
                  value={`${school.id}:${value}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
