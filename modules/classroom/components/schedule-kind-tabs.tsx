"use client";

import { useRouter } from "next/navigation";

import { useT } from "@/components/providers/i18n-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SCHEDULE_KINDS } from "@/modules/timetable/enums";

/**
 * Standard week or Ramadan week.
 *
 * In the URL rather than in component state, like every other choice that
 * changes what the server read: a teacher checking next month's Ramadan grid
 * can send the link to a colleague.
 */
export function ScheduleKindTabs({ scheduleKind }: { scheduleKind: string }) {
  const t = useT();
  const router = useRouter();

  return (
    <Tabs
      value={scheduleKind}
      onValueChange={(value) => router.push(`/teacher/timetable?schedule=${value}`)}
    >
      <TabsList>
        {SCHEDULE_KINDS.map((kind) => (
          <TabsTrigger key={kind} value={kind}>
            {t.timetable.scheduleKinds[kind]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
