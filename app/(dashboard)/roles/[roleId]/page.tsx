import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoleForm } from "@/modules/access/components/role-form";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { findRole } from "@/modules/access/queries";

export const metadata: Metadata = { title: "Rôle" };

export default async function EditRolePage(props: PageProps<"/roles/[roleId]">) {
  const { roleId } = await props.params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.canOrg(PERMISSIONS.ROLE_VIEW)) {
    return <ForbiddenState />;
  }

  const role = await findRole(context, roleId);
  if (!role) notFound();

  // Viewers without edit rights still get the page, in read-only mode.
  const readOnly = !context.canOrg(PERMISSIONS.ROLE_UPDATE);

  return (
    <>
      <PageHeader
        title={role.name}
        description={readOnly ? t.role.permissions : t.role.editRole}
        backHref="/roles"
        backLabel={t.nav.roles}
      />
      <RoleForm readOnly={readOnly} role={role} />
    </>
  );
}
