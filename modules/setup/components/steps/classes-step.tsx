"use client";

import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GROUP_PURPOSES } from "@/modules/classes/enums";
import { classCodesFor, trackByCode } from "@/modules/setup/catalogue";
import type { SetupState } from "@/modules/setup/components/use-setup-state";

/**
 * How many classes open in each level this year.
 *
 * Zero is a real answer: the level is configured and its programme written, but
 * no class opens in it this year. The codes are previewed because they are what
 * every register and mark sheet will say — `3AP-A`, `2BAC-2B-SVT-B`.
 */
export function ClassesStep({
  setup,
  error,
}: {
  setup: SetupState;
  error?: string;
}) {
  const t = useT();
  const rows = setup.classes.offerings;

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t.setup.nothingChosen}</p>;
  }

  return (
    <div className="grid gap-5">
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <div className="hidden gap-2 px-2 sm:grid sm:grid-cols-[1fr_6rem_6rem_1fr]">
          <Label className="text-muted-foreground text-xs">{t.setup.classes.level}</Label>
          <Label className="text-muted-foreground text-xs">{t.setup.classes.classCount}</Label>
          <Label className="text-muted-foreground text-xs">{t.setup.classes.capacity}</Label>
          <Label className="text-muted-foreground text-xs">{t.setup.classes.codePreview}</Label>
        </div>

        {rows.map((row) => {
          const track = row.trackCode ? trackByCode(row.trackCode) : null;
          const codes = classCodesFor(row.levelCode, row.trackCode, Number(row.classCount) || 0);
          return (
            <div
              key={`${row.levelCode}-${row.trackCode ?? "all"}`}
              className="grid items-center gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_6rem_6rem_1fr]"
            >
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">{row.levelCode}</span>
                {track ? (
                  <span className="text-muted-foreground text-xs">{track.name}</span>
                ) : null}
              </div>

              <Input
                aria-label={t.setup.classes.classCount}
                type="number"
                min={0}
                max={26}
                value={row.classCount}
                onChange={(event) =>
                  setup.classes.updateOffering(row.levelCode, row.trackCode, {
                    classCount: event.target.value,
                  })
                }
              />
              <Input
                aria-label={t.setup.classes.capacity}
                type="number"
                min={0}
                value={row.capacity}
                onChange={(event) =>
                  setup.classes.updateOffering(row.levelCode, row.trackCode, {
                    capacity: event.target.value,
                  })
                }
              />

              <div className="flex flex-wrap gap-1">
                {codes.length === 0 ? (
                  <span className="text-muted-foreground text-xs">{t.setup.classes.noClasses}</span>
                ) : (
                  codes.map((code) => (
                    <Badge key={code} variant="secondary" dir="ltr">
                      {code}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="groupsPerClass">{t.setup.classes.groupsPerClass}</Label>
          <Select
            value={setup.classes.groupsPerClass}
            onValueChange={setup.classes.setGroupsPerClass}
          >
            <SelectTrigger id="groupsPerClass" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t.setup.classes.noGroups}</SelectItem>
              {[2, 3, 4].map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">{t.setup.classes.groupsHint}</p>
          <input type="hidden" name="groupsPerClass" value={setup.classes.groupsPerClass} />
        </div>

        {setup.classes.groupsPerClass !== "0" ? (
          <div className="grid gap-2">
            <Label htmlFor="groupPurpose">{t.setup.classes.groupPurpose}</Label>
            <Select value={setup.classes.groupPurpose} onValueChange={setup.classes.setGroupPurpose}>
              <SelectTrigger id="groupPurpose" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_PURPOSES.map((purpose) => (
                  <SelectItem key={purpose} value={purpose}>
                    {t.configOptions.groupPurposes[purpose]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="groupPurpose" value={setup.classes.groupPurpose} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Four parallel arrays, one value per offering in each. */
export function ClassesInputs({ setup }: { setup: SetupState }) {
  return (
    <>
      {setup.classes.offerings.map((row) => (
        <React.Fragment key={`${row.levelCode}-${row.trackCode ?? "all"}`}>
          <input type="hidden" name="offLevelCode" value={row.levelCode} />
          <input type="hidden" name="offTrackCode" value={row.trackCode ?? ""} />
          <input type="hidden" name="offClassCount" value={row.classCount} />
          <input type="hidden" name="offCapacity" value={row.capacity} />
        </React.Fragment>
      ))}
    </>
  );
}
