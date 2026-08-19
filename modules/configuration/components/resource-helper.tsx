import { requireAuth } from "@/lib/dal";
import { PERMISSIONS } from "@/lib/permissions";
import { ProgrammeCarryForward } from "@/modules/academics/components/programme-carry-forward";
import { listProgrammeSourceYears } from "@/modules/academics/queries";
import type { ResourceHelper as ResourceHelperName } from "@/modules/configuration/types";

/**
 * The one place that knows what a `ResourceDef.helper` actually renders.
 *
 * Named in the descriptor and resolved here, exactly as a nav icon is: the
 * descriptors cross to the client, and a component reference in `resources.ts`
 * would drag a module's server code into the dialog's bundle. This file stays on
 * the server, so a helper may load its own data through its module's `queries`.
 */
export async function ResourceHelper({
  name,
}: {
  name: ResourceHelperName;
}) {
  const context = await requireAuth();

  switch (name) {
    case "programme-carry-forward":
      return (
        <ProgrammeCarryForward
          years={await listProgrammeSourceYears(context)}
          canManage={context.can(PERMISSIONS.CONFIGURATION_MANAGE)}
        />
      );
  }
}
