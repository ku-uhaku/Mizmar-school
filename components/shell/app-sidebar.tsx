"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { GraduationCapIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { NAV_ICONS } from "@/components/shell/nav-icon";
import { isDisplayableImage } from "@/lib/images";
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
  logoUrl,
  subtitle,
}: {
  sections: NavGroup[];
  organizationName: string;
  /** The school's crest, else the organisation's. Null falls back to the mark. */
  logoUrl?: string | null;
  /** The school in context, so the header says where you are working. */
  subtitle?: string | null;
}) {
  const t = useT();
  const pathname = usePathname();
  const [logoBroken, setLogoBroken] = React.useState(false);

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
                {/*
                  `object-contain` on a fixed square, not `cover`: a school crest
                  is rarely square and cropping one is how you cut the name off
                  its own badge. The mark behind it is the fallback for an
                  organisation that has not uploaded anything — and for a link
                  that turns out to be dead.
                */}
                {isDisplayableImage(logoUrl) && !logoBroken ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl as string}
                    alt=""
                    className="bg-background size-8 shrink-0 rounded-lg object-contain"
                    onError={() => setLogoBroken(true)}
                  />
                ) : (
                  // Inverted against the rail rather than painted with
                  // --primary: --primary is near-black in light mode and
                  // near-white in dark, so on one of the two it would paint the
                  // mark in the rail's own colour. Off the rail's foreground it
                  // is legible in both by construction.
                  <div className="bg-sidebar-foreground text-sidebar flex aspect-square size-8 items-center justify-center rounded-lg">
                    <GraduationCapIcon className="size-4" />
                  </div>
                )}
                <div className="grid flex-1 text-start leading-tight">
                  <span className="truncate font-semibold">
                    {organizationName}
                  </span>
                  {/* Off the rail's own foreground, not --muted-foreground:
                    the rail has its own surface in both modes, and a token
                    mixed for the page behind it is not guaranteed to read on
                    it. */}
                  <span className="text-sidebar-foreground/70 truncate text-xs">
                    {subtitle ?? t.nav.administration}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/*
          The sidebar is where the colour mapping is taught: every section is on
          screen at once here, and nowhere else. The tint is on the label and the
          icons rather than on the row text — a full row of coloured labels would
          fight the active state, which is the only thing in the list that has to
          win.
        */}
        {sections.map((group) => (
          <SidebarGroup key={group.section} data-section={group.section}>
            <SidebarGroupLabel className="text-section/90">
              {t.nav[group.titleKey]}
            </SidebarGroupLabel>
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
                        // The active row and its start bar wear the section's
                        // hue instead of the app accent, so "where am I" and
                        // "which part of the app is this" are one signal rather
                        // than two competing ones. Idle icons are held back to
                        // 70% so thirty of them down the rail stay quieter than
                        // the one row that is actually active.
                        //
                        // The `dark:` pair is not redundant: the base component
                        // carries its own `dark:data-active:bg-sidebar-primary`
                        // rules, and tailwind-merge keys those separately from
                        // the unprefixed ones, so they survive unless matched
                        // variant for variant.
                        className="data-active:bg-section/15 data-active:text-section data-active:before:bg-section data-active:hover:bg-section/20 data-active:hover:text-section dark:data-active:bg-section/15 dark:data-active:hover:bg-section/20 [&_svg]:text-section/70 data-active:[&_svg]:text-section"
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
                          {/* The icon carries the hue (tinted from the button
                            above); collapsed to icons it is the only thing left,
                            and it still says which section the row belongs to. */}
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
