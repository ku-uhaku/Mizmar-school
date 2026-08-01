"use client";

import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { interpolate } from "@/lib/i18n/format";
import { ALL_PERMISSION_CODES, PERMISSION_GROUPS } from "@/lib/permissions";

/**
 * The permission grid. Each checkbox submits its code under the `permissions`
 * name, so the whole desired set arrives in one FormData field.
 */
export function PermissionMatrix({
  defaultSelected,
  disabled,
}: {
  defaultSelected: string[];
  disabled?: boolean;
}) {
  const t = useT();
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(defaultSelected),
  );

  function toggle(code: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  function setAll(codes: readonly string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const code of codes) {
        if (checked) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  }

  const allSelected = selected.size === ALL_PERMISSION_CODES.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary">
          {interpolate(t.role.permissionsSelected, {
            count: selected.size,
            total: ALL_PERMISSION_CODES.length,
          })}
        </Badge>
        {!disabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAll(ALL_PERMISSION_CODES, !allSelected)}
          >
            {allSelected ? t.role.clearAll : t.role.selectAll}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => {
          const groupAllSelected = group.codes.every((code) =>
            selected.has(code),
          );

          return (
            <div key={group.group} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {
                    t.permissions.groups[
                      group.group as keyof typeof t.permissions.groups
                    ]
                  }
                </p>
                {!disabled ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAll(group.codes, !groupAllSelected)}
                  >
                    {groupAllSelected ? t.role.clearAll : t.role.selectAll}
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                {group.codes.map((code) => {
                  const id = `permission-${code}`;
                  const checked = selected.has(code);

                  return (
                    <div key={code} className="flex items-start gap-2.5">
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          toggle(code, value === true)
                        }
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={id}
                        className="text-muted-foreground text-sm leading-snug font-normal"
                      >
                        {
                          t.permissions.codes[
                            code as keyof typeof t.permissions.codes
                          ]
                        }
                      </Label>
                      {/* Radix Checkbox is not a native input, so the value is
                          carried by a hidden field for form submission. */}
                      {checked ? (
                        <input type="hidden" name="permissions" value={code} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
