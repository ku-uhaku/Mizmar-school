"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { useT } from "@/components/providers/i18n-provider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { interpolate } from "@/lib/i18n/format";
import { SCHEDULE_KINDS } from "@/modules/timetable/enums";
import type { TeacherOption } from "@/modules/timetable/queries";

/**
 * Whose horaire is on screen, and under which bell schedule.
 *
 * Both in the URL for the reason the class picker keeps them there: this is a
 * screen people send each other a link to, and one that reset to the first
 * teacher on reload is one nobody bookmarks.
 *
 * The blocked count rides in the label so the list itself answers "who has an
 * arrangement" without opening each name.
 */
export function TeacherPicker({
  teachers,
  teacherId,
  scheduleKind,
}: {
  teachers: TeacherOption[];
  teacherId: string;
  scheduleKind: string;
}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/timetable/availability?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="grid min-w-64 gap-2">
        <Label htmlFor="availability-teacher">{t.timetable.pickTeacher}</Label>
        <Select
          value={teacherId}
          onValueChange={(value) => navigate("teacherId", value)}
        >
          <SelectTrigger id="availability-teacher" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>
                {teacher.label}
                {teacher.blockedCount > 0
                  ? ` · ${interpolate(t.timetable.periodsOff, {
                      count: teacher.blockedCount,
                    })}`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-w-40 gap-2">
        <Label htmlFor="availability-schedule">
          {t.timetable.scheduleKind}
        </Label>
        <Select
          value={scheduleKind}
          onValueChange={(value) => navigate("schedule", value)}
        >
          <SelectTrigger id="availability-schedule" className="w-full">
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
