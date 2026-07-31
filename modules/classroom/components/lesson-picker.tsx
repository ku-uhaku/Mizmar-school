"use client";

import { useRouter } from "next/navigation";

import { useT } from "@/components/providers/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LessonSlot, TeachingSlot } from "@/modules/classroom/queries";

/**
 * Which lesson is being marked: one of the teacher's own class/subject pairs,
 * a date, and the period.
 *
 * Everything travels in the URL rather than in component state, exactly as on
 * the encaissement and contrôles screens: the roster is a permission-scoped
 * server read, so keeping the choice in the address means a reload — or a link
 * to a colleague — lands on the same register.
 */
export function LessonPicker({
  teaching,
  lessons,
  selected,
}: {
  teaching: TeachingSlot[];
  /** The teacher's periods on the chosen day, for the period dropdown. */
  lessons: LessonSlot[];
  selected: {
    schoolClassId: string | null;
    subjectId: string | null;
    timeSlotId: string | null;
    date: string;
  };
}) {
  const t = useT();
  const router = useRouter();

  /** The class and the subject move together — an assignment is one choice. */
  const currentPair =
    selected.schoolClassId && selected.subjectId
      ? `${selected.schoolClassId}:${selected.subjectId}`
      : "";

  function go(next: Partial<typeof selected> & { pair?: string }) {
    const [pairClass, pairSubject] = (next.pair ?? currentPair).split(":");
    const params = new URLSearchParams();
    if (pairClass) params.set("class", pairClass);
    if (pairSubject) params.set("subject", pairSubject);
    params.set("date", next.date ?? selected.date);

    // Changing class or day invalidates the period — a slot belongs to one day.
    const slot =
      next.pair !== undefined || next.date !== undefined
        ? null
        : (next.timeSlotId ?? selected.timeSlotId);
    if (slot) params.set("slot", slot);

    router.push(`/teacher/attendance?${params.toString()}`);
  }

  // Only the periods that belong to the pair being marked.
  const periods = lessons.filter(
    (lesson) =>
      lesson.schoolClassId === selected.schoolClassId &&
      lesson.subjectId === selected.subjectId,
  );

  return (
    <Card className="gap-0 py-4">
      <CardContent className="grid gap-4 px-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pair">{t.classroom.pickLesson}</Label>
          <Select
            value={currentPair}
            onValueChange={(value) => go({ pair: value })}
          >
            <SelectTrigger id="pair" className="w-full">
              <SelectValue placeholder={t.classroom.pickLesson} />
            </SelectTrigger>
            <SelectContent>
              {teaching.map((slot) => (
                <SelectItem
                  key={slot.assignmentId}
                  value={`${slot.schoolClassId}:${slot.subjectId}`}
                >
                  {slot.classCode} · {slot.subjectName}
                  {slot.groupLabel ? ` · ${slot.groupLabel}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="date">{t.classroom.today}</Label>
          <Input
            id="date"
            type="date"
            value={selected.date}
            onChange={(event) => go({ date: event.target.value })}
            dir="ltr"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="slot">{t.classroom.lesson}</Label>
          <Select
            value={selected.timeSlotId ?? "__day__"}
            onValueChange={(value) =>
              go({ timeSlotId: value === "__day__" ? null : value })
            }
          >
            <SelectTrigger id="slot" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Always offered: a primary teacher who has the class all
                  morning marks the day, not the hour. */}
              <SelectItem value="__day__">{t.classroom.wholeDay}</SelectItem>
              {periods.map((lesson) => (
                <SelectItem key={lesson.timeSlotId} value={lesson.timeSlotId}>
                  {lesson.startTime} — {lesson.endTime}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
