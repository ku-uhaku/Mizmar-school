import type { Metadata } from "next";

import { AppearanceSettings } from "@/components/appearance/appearance-settings";
import { PageHeader } from "@/components/shell/page-header";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Apparence" };

export default async function AppearancePage() {
  // Own-preferences page: no permission gate.
  await requireAuth();
  const t = await getDictionary();

  return (
    <>
      <PageHeader
        title={t.appearance.title}
        description={t.appearance.subtitle}
      />
      <AppearanceSettings />
    </>
  );
}
