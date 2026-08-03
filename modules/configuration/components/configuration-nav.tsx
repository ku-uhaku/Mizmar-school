"use client";

import Link from "next/link";

import { useT } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import {
  SCOPE_GROUPS,
  groupOfSection,
  resourcesInSection,
  sectionsInGroup,
} from "@/modules/configuration/resources";

/**
 * Group tabs across the top, section headings and resource links down the
 * side.
 *
 * Both are links rather than Radix Tabs state: every screen is its own URL, so
 * it can be linked to, bookmarked and reached with the back button, and the
 * table below is server-rendered for exactly that resource. The horizontal
 * tabs are styled to match `components/ui/tabs`; the vertical list groups the
 * old section tabs into headings, one rule between each cluster.
 */

/**
 * The two tabs above the section list — "Configuration générale" and "Année
 * scolaire". Each links to its own first section's first resource, so picking
 * one always lands on a real screen.
 */
export function GroupTabs({ activeSection }: { activeSection: string }) {
  const t = useT();
  const labels = t.configuration.scopeGroups as Record<string, string>;
  const activeGroup = groupOfSection(activeSection);

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto border-b"
      aria-label={t.configuration.title}
    >
      {SCOPE_GROUPS.map((group) => {
        const firstSection = sectionsInGroup(group.id)[0];
        const firstResource = firstSection
          ? resourcesInSection(firstSection.id)[0]
          : undefined;
        if (!firstSection || !firstResource) return null;
        const isActive = group.id === activeGroup.id;

        return (
          <Link
            key={group.id}
            href={`/configuration/${firstSection.id}/${firstResource.id}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {labels[group.labelKey] ?? group.labelKey}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The vertical nav for the active group: its sections as plain headings, each
 * followed by its resources as links, with a rule between one section's
 * cluster and the next — the categories the horizontal section tabs used to
 * be, now read top to bottom instead of clicked through one at a time.
 */
export function ResourceTabs({
  sectionId,
  activeResource,
}: {
  sectionId: string;
  activeResource: string;
}) {
  const t = useT();
  const sectionLabels = t.configuration.sections as Record<string, string>;
  const resourceLabels = t.configuration.resources as Record<string, string>;
  const group = groupOfSection(sectionId);
  const sections = sectionsInGroup(group.id);

  return (
    <nav
      className="flex shrink-0 flex-col gap-4 md:w-56"
      aria-label={t.configuration.subtitle}
    >
      {sections.map((section, index) => {
        const resources = resourcesInSection(section.id);
        if (resources.length === 0) return null;

        return (
          <div
            key={section.id}
            className={cn("flex flex-col gap-1", index > 0 && "border-t pt-4")}
          >
            <span className="text-muted-foreground px-3 text-xs font-semibold tracking-wide uppercase">
              {sectionLabels[section.labelKey] ?? section.labelKey}
            </span>
            {resources.map((resource) => {
              const isActive =
                section.id === sectionId && resource.id === activeResource;

              return (
                <Link
                  key={resource.id}
                  href={`/configuration/${section.id}/${resource.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-start text-sm font-medium whitespace-nowrap transition-colors md:whitespace-normal",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {resourceLabels[resource.labelKey] ?? resource.labelKey}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
