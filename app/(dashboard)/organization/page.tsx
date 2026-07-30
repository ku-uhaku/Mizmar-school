import type { Metadata } from "next";

import { OrganizationForm } from "@/components/organization/organization-form";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Organisation" };

export default async function OrganizationPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  // Viewing is satisfied by a school-scoped grant too (a director may read the
  // organisation's details); only editing is organisation-wide.
  if (!context.can(PERMISSIONS.ORGANIZATION_VIEW)) {
    return <ForbiddenState />;
  }

  const organization = context.organization;

  return (
    <>
      <PageHeader
        title={t.organization.title}
        description={t.organization.subtitle}
      />

      <OrganizationForm
        canEdit={context.canOrg(PERMISSIONS.ORGANIZATION_UPDATE)}
        organization={{
          name: organization.name,
          legalName: organization.legalName,
          ice: organization.ice,
          taxId: organization.taxId,
          email: organization.email,
          phone: organization.phone,
          website: organization.website,
          addressLine: organization.addressLine,
          city: organization.city,
          region: organization.region,
          postalCode: organization.postalCode,
          country: organization.country,
          logoUrl: organization.logoUrl,
          defaultLocale: organization.defaultLocale,
        }}
      />
    </>
  );
}
