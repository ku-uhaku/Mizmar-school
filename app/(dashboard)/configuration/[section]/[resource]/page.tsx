import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarRangeIcon, SchoolIcon } from "lucide-react";

import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import {
  GroupTabs,
  ResourceTabs,
} from "@/modules/configuration/components/configuration-nav";
import { ResourceManager } from "@/modules/configuration/components/resource-manager";
import { SettingsForm } from "@/modules/configuration/components/settings-form";
import { findSingleton, listResource } from "@/modules/configuration/queries";
import { findResource, findSection } from "@/modules/configuration/resources";

export const metadata: Metadata = { title: "Configuration" };

/**
 * One configuration screen.
 *
 * Thin, like every route: authorize, confirm the working context the resource
 * needs is actually set, then hand off to the module's own query and manager.
 * The scoping itself lives in modules/configuration/resource-schema.ts.
 */
export default async function ConfigurationResourcePage(
  props: PageProps<"/configuration/[section]/[resource]">,
) {
  const { section: sectionId, resource: resourceId } = await props.params;
  const context = await requireAuth();
  const t = await getDictionary();

  const section = findSection(sectionId);
  const resource = findResource(resourceId);
  if (!section || !resource || resource.section !== sectionId) notFound();

  if (!context.can(PERMISSIONS.CONFIGURATION_VIEW)) {
    return <ForbiddenState />;
  }

  const resourceName = (t.configuration.resources as Record<string, string>)[
    resource.labelKey
  ];

  // The whole section is configuration *of a school*, so without one in context
  // there is nothing to show — and nothing the actions would accept either.
  const school = context.currentSchool;
  const year = context.currentSchoolYear;

  const scopeNote = school
    ? resource.scope === "SCHOOL"
      ? interpolate(t.configuration.scopeSchool, { school: school.name })
      : year
        ? interpolate(t.configuration.scopeYear, {
            school: school.name,
            year: year.name,
          })
        : undefined
    : undefined;

  const missingContext =
    !school || (resource.scope === "YEAR" && !year) ? (
      <div className="rounded-xl border">
        <EmptyState
          icon={
            !school ? (
              <SchoolIcon className="size-5" />
            ) : (
              <CalendarRangeIcon className="size-5" />
            )
          }
          title={
            !school ? t.context.noSchoolSelected : t.context.noYearSelected
          }
          description={
            !school ? t.errors.noSchoolContext : t.errors.noSchoolYearContext
          }
        />
      </div>
    ) : null;

  const body = missingContext ?? (
    <ResourceBody
      resourceId={resource.id}
      canManage={context.can(PERMISSIONS.CONFIGURATION_MANAGE)}
    />
  );

  return (
    <>
      <PageHeader
        title={t.configuration.title}
        description={scopeNote ?? t.configuration.subtitle}
      />

      <div className="space-y-4">
        <GroupTabs activeScope={resource.scope} />

        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <ResourceTabs
            sectionId={sectionId}
            activeResource={resource.id}
            activeScope={resource.scope}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {resourceName}
              </h2>
              {scopeNote ? (
                <p className="text-muted-foreground text-sm">{scopeNote}</p>
              ) : null}
            </div>
            {body}
          </div>
        </div>
      </div>
    </>
  );
}

/** Split out so the query only runs once the context checks have passed. */
async function ResourceBody({
  resourceId,
  canManage,
}: {
  resourceId: string;
  canManage: boolean;
}) {
  const context = await requireAuth();
  const resource = findResource(resourceId)!;

  // A singleton is one row of policy, not a list — a page of grouped fields
  // with one save, rather than a table and an edit dialog.
  if (resource.kind === "singleton") {
    const row = await findSingleton(context, resource);
    return <SettingsForm resource={resource} row={row} canManage={canManage} />;
  }

  const { rows, choices } = await listResource(context, resource);

  return (
    <ResourceManager
      resource={resource}
      rows={rows}
      choices={choices}
      canManage={canManage}
    />
  );
}
