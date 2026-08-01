"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeOrg } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { organizationSchema } from "@/modules/organization/validation";

export async function updateOrganizationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeOrg(PERMISSIONS.ORGANIZATION_UPDATE);

    const parsed = organizationSchema(t).safeParse({
      name: field(formData, "name"),
      legalName: field(formData, "legalName"),
      ice: field(formData, "ice"),
      taxId: field(formData, "taxId"),
      email: field(formData, "email"),
      phone: field(formData, "phone"),
      website: field(formData, "website"),
      addressLine: field(formData, "addressLine"),
      city: field(formData, "city"),
      region: field(formData, "region"),
      postalCode: field(formData, "postalCode"),
      country: field(formData, "country"),
      logoUrl: field(formData, "logoUrl"),
      defaultLocale: field(formData, "defaultLocale"),
    });

    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The id comes from the session, never from the form — this deployment has
    // exactly one organisation and the user belongs to it.
    await db.organization.update({
      where: { id: context.organization.id },
      data: parsed.data,
    });

    refresh();
    return success(t.organization.updated);
  });
}
