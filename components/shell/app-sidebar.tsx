"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { GraduationCapIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { NAV_ICONS } from "@/components/shell/nav-icon";
import type { NavGroup } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

/**
 * `sections` is built on the server by `visibleSections` (lib/nav.ts) from the
 * module registry, already filtered to what this user may reach.
 */
export function AppSidebar({
  sections,
  organizationName,
}: {
  sections: NavGroup[];
  organizationName: string;
}) {
  const t = useT();
  const pathname = usePathname();

  /**
   * The single entry the current URL belongs to, decided by longest match.
   *
   * Sections now open on a dashboard and list their screens beneath it, so a
   * plain `startsWith` would light `/transport` and `/transport/routes` at the
   * same time. Picking the longest matching href instead keeps exactly one row
   * highlighted, and needs no special-casing for `/`.
   */
  const activeHref = React.useMemo(() => {
    let best: string | null = null;
    for (const group of sections) {
      for (const item of group.items) {
        const matches =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));
        if (matches && (best === null || item.href.length > best.length)) {
          best = item.href;
        }
      }
    }
    return best;
  }, [sections, pathname]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <GraduationCapIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-start leading-tight">
                  <span className="truncate font-semibold">
                    {organizationName}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {t.nav.administration}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((group) => (
          <SidebarGroup key={group.section}>
            <SidebarGroupLabel>{t.nav[group.titleKey]}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const isActive = item.href === activeHref;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        // Four sections open on an entry labelled "Overview",
                        // and collapsed to icons the label is all there is —
                        // so the tooltip names the section instead.
                        tooltip={
                          item.labelKey === "overview"
                            ? t.nav[group.titleKey]
                            : t.nav[item.labelKey]
                        }
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{t.nav[item.labelKey]}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
