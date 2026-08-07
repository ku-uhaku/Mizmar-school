import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { RegistersManager } from "@/modules/treasury/components/registers-manager";
import { SessionBar } from "@/modules/treasury/components/session-bar";
import { SessionsHistory } from "@/modules/treasury/components/sessions-history";
import {
  listCashierChoices,
  listRegisters,
  listSessions,
} from "@/modules/treasury/queries";
import { SectionHeading } from "@/components/shell/section-heading";

export const metadata: Metadata = { title: "Caisses" };

/**
 * The tills themselves: what exists, which is open, and how to add one.
 *
 * Managing them sits behind TREASURY_SESSION rather than a code of its own —
 * whoever may open and close a drawer is whoever is answerable for how many
 * drawers there are. A cashier who may only collect sees the list and cannot
 * invent a second till to post into.
 */
export default async function CashRegistersPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_VIEW)) {
    return <ForbiddenState />;
  }

  const [registers, cashiers, sessions] = await Promise.all([
    listRegisters(context),
    listCashierChoices(context),
    listSessions(context),
  ]);
  const canManage = context.can(PERMISSIONS.TREASURY_SESSION);

  return (
    <>
      <PageHeader
        title={t.treasury.registers}
        description={t.treasury.registersHint}
        backHref="/caisse"
        backLabel={t.treasury.title}
      />

      <div className="grid gap-5">
        <RegistersManager
          registers={registers}
          cashiers={cashiers}
          canManage={canManage}
        />

        {/* Opening and closing lives here too: the list is where somebody
            looking at the tills already is, so making them go elsewhere to
            open one would be a detour for the commonest action of the day. */}
        {registers.length > 0 ? (
          <section className="grid gap-3">
            <SectionHeading label={t.treasury.sessions} />
            <SessionBar registers={registers} canManage={canManage} />
          </section>
        ) : null}

        {/* Every opening, closed or still open — `listSessions` has always
            read this, nothing rendered it until now. */}
        <section className="grid gap-3">
          <SectionHeading label={t.treasury.sessionHistory} />
          <SessionsHistory sessions={sessions} />
        </section>
      </div>
    </>
  );
}
