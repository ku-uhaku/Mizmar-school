"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { clusterByGroup } from "@/components/form/option-groups";
import { useT } from "@/components/providers/i18n-provider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCHEDULE_KINDS } from "@/modules/timetable/enums";

/**
 * Which class's week is on screen, and under which bell schedule.
 *
 * Both live in the URL rather than in component state: a timetable is
 * something people send each other a link to, and a grid that resets to the
 * first class when the page reloads is a grid nobody bookmarks.
 */
export function ClassPicker({
  classes,
  classId,
  scheduleKind,
}: {
  classes: {
    id: string;
    code: string;
    levelLabel: string;
    /** The niveau in both languages — the code is already on the class. */
    levelNameLabel: string;
    /** The cycle the option is listed under. */
    cycleName: string;
    entryCount: number;
  }[];
  classId: string;
  scheduleKind: string;
}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/timetable?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="grid min-w-56 gap-2">
        <Label htmlFor="timetable-class">{t.timetable.pickClass}</Label>
        <Select
          value={classId}
          onValueChange={(value) => navigate("classId", value)}
        >
          <SelectTrigger id="timetable-class" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Headed by cycle and named in both languages, like every other
              niveau picker — see modules/academics/labels.ts. */}
            {clusterByGroup(
              classes.map((schoolClass) => ({
                ...schoolClass,
                group: schoolClass.cycleName,
              })),
            ).map((cluster) => (
              <SelectGroup key={cluster.heading}>
                <SelectLabel>{cluster.heading}</SelectLabel>
                {cluster.options.map((schoolClass) => (
                  <SelectItem key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.code} — {schoolClass.levelNameLabel}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-w-40 gap-2">
        <Label htmlFor="timetable-schedule">{t.timetable.scheduleKind}</Label>
        <Select
          value={scheduleKind}
          onValueChange={(value) => navigate("schedule", value)}
        >
          <SelectTrigger id="timetable-schedule" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t.timetable.scheduleKinds[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
