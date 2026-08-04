import type { AuthContext } from "@/lib/dal";
import { RecordHistory } from "@/modules/audit/components/record-history";
import { canReadTrail, loadRecordHistory } from "@/modules/audit/queries";

/**
 * The history panel, ready to drop at the foot of any detail screen.
 *
 *   <RecordHistoryPanel context={context} entity="Student" entityId={student.id} />
 *
 * A server component rather than four copies of the same three lines in four
 * pages: the read is the audit module's, the permission check is the audit
 * module's, and a page that had to remember both would eventually forget one.
 * Renders nothing at all for a reader without `audit.view` — not an empty card,
 * which would tell them a trail exists.
 *
 * `entity` is the Prisma model name, because that is what the trail records and
 * what the log screen filters on.
 */
export async function RecordHistoryPanel({
  context,
  entity,
  entityId,
}: {
  context: AuthContext;
  entity: string;
  entityId: string;
}) {
  if (!canReadTrail(context)) return null;

  const entries = await loadRecordHistory(context, entity, entityId);

  return (
    <RecordHistory entries={entries} entity={entity} entityId={entityId} />
  );
}
