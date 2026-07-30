"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BuildingIcon,
  CalendarRangeIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  SchoolIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import type { NavIcon, NavSection } from "@/components/shell/nav-items";
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

const ICONS: Record<NavIcon, typeof LayoutDashboardIcon> = {
  dashboard: LayoutDashboardIcon,
  organization: BuildingIcon,
  schools: SchoolIcon,
  schoolYears: CalendarRangeIcon,
  users: UsersIcon,
  roles: ShieldCheckIcon,
  profile: UserIcon,
  appearance: PaletteIcon,
};

export function AppSidebar({
  sections,
  organizationName,
}: {
  sections: NavSection[];
  organizationName: string;
}) {
  const t = useT();
  const pathname = usePathname();

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
        {sections.map((section) => (
          <SidebarGroup key={section.titleKey}>
            <SidebarGroupLabel>{t.nav[section.titleKey]}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  // "/" must match exactly, or it would light up everywhere.
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={t.nav[item.labelKey]}
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
