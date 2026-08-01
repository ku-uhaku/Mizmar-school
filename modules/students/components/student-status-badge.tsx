"use client";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";

/**
 * A pupil's status, coloured by what it means for the school.
 *
 * In one component because the list, the profile and the dashboard all show it,
 * and a status that reads as neutral in one place and alarming in another is a
 * status nobody trusts.
 */
const VARIANTS: Record<string, React.ComponentProps<typeof Badge>["variant"]> =
  {
    ENROLLED: "default",
    PRE_REGISTERED: "secondary",
    GRADUATED: "secondary",
    TRANSFERRED: "outline",
    WITHDRAWN: "outline",
  };

export function StudentStatusBadge({ status }: { status: string }) {
  const t = useT();
  const label =
    t.studentOptions.statuses[
      status as keyof typeof t.studentOptions.statuses
    ] ?? status;

  return <Badge variant={VARIANTS[status] ?? "outline"}>{label}</Badge>;
}
