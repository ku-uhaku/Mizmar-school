"use client";

import Link from "next/link";

import { useT } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import {
  SECTIONS,
  resourcesInSection,
} from "@/modules/configuration/resources";

/**
 * Section tabs across the top, resource tabs down the side.
 *
 * Both are links rather than Radix Tabs state: every screen is its own URL, so
 * it can be linked to, bookmarked and reached with the back button, and the
 * table below is server-rendered for exactly that resource. The tabs are styled
 * to match `components/ui/tabs` — horizontal underlined, vertical filled.
 */

export function SectionTabs({ activeSection }: { activeSection: string }) {
  const t = useT();
  const labels = t.configuration.sections as Record<string, string>;

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto border-b"
      aria-label={t.configuration.title}
    >
      {SECTIONS.map((section) => {
        const first = resourcesInSection(section.id)[0];
        if (!first) return null;
        const isActive = section.id === activeSection;

        return (
          <Link
            key={section.id}
            href={`/configuration/${section.id}/${first.id}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {labels[section.labelKey] ?? section.labelKey}
          </Link>
        );
      })}
    </nav>
  );
}

export function ResourceTabs({
  sectionId,
  activeResource,
}: {
  sectionId: string;
  activeResource: string;
}) {
  const t = useT();
  const labels = t.configuration.resources as Record<string, string>;
  const resources = resourcesInSection(sectionId);

  return (
    <nav
      className="bg-muted flex shrink-0 gap-1 overflow-x-auto rounded-lg p-1 md:w-56 md:flex-col md:overflow-visible"
      aria-label={t.configuration.subtitle}
    >
      {resources.map((resource) => {
        const isActive = resource.id === activeResource;

        return (
          <Link
            key={resource.id}
            href={`/configuration/${sectionId}/${resource.id}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-start text-sm font-medium whitespace-nowrap transition-colors md:whitespace-normal",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[resource.labelKey] ?? resource.labelKey}
          </Link>
        );
      })}
    </nav>
  );
}
