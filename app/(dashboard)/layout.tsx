import { AppSidebar } from "@/components/shell/app-sidebar";
import { FullscreenToggle } from "@/components/shell/fullscreen-toggle";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { ContextSwitcher } from "@/modules/context/components/context-switcher";
import { GlobalSearch } from "@/modules/school-life/components/global-search";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { SectionScope } from "@/components/shell/section-scope";
import { visibleSections } from "@/lib/nav";
import { ThemeModeToggle } from "@/modules/appearance/components/theme-mode-toggle";
import { UserMenu } from "@/components/shell/user-menu";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { displayName, requireAuth } from "@/lib/dal";
import { PERMISSIONS } from "@/lib/permissions";

function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? email[0] ?? "?").toUpperCase();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The real gate. proxy.ts only does an optimistic cookie check, and pages
  // re-check their own permissions on top of this.
  const context = await requireAuth();

  const sections = visibleSections(context.canOrg, context.can);
  const name = displayName(context.user);

  // The box searches pupils, dossiers and classes, and each kind is filtered by
  // its own permission inside the action. A reader holding none of the three
  // would get a control that can only ever answer "nothing found", so they get
  // no control at all.
  const canSearch =
    context.can(PERMISSIONS.STUDENT_VIEW) ||
    context.can(PERMISSIONS.FAMILY_VIEW) ||
    context.can(PERMISSIONS.CLASS_VIEW);

  return (
    // The working school's policies, for the screens that need them where there
    // is no server to ask — see components/providers/settings-provider.tsx.
    <SettingsProvider settings={context.settings}>
      <SidebarProvider>
        <AppSidebar
          sections={sections}
          organizationName={context.organization.name}
          // The school's crest when one is selected, the organisation's
          // otherwise — the shell should look like wherever you are actually
          // working, and a group with one brand simply never sets the school one.
          logoUrl={
            context.currentSchool?.logoUrl ?? context.organization.logoUrl
          }
          subtitle={context.currentSchool?.name ?? null}
        />

        <SidebarInset className="min-w-0">
          <header className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5 backdrop-blur">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="me-1 h-5" />

            <ContextSwitcher
              schools={context.schools.map((school) => ({
                id: school.id,
                name: school.name,
                code: school.code,
                city: school.city,
                logoUrl: school.logoUrl,
              }))}
              years={context.schoolYears.map((year) => ({
                id: year.id,
                name: year.name,
                status: year.status,
                isDefault: year.isDefault,
              }))}
              currentSchoolId={context.currentSchool?.id ?? null}
              currentYearId={context.currentSchoolYear?.id ?? null}
            />

            <div className="ms-auto flex items-center gap-1">
              {/* Scoped to the working context and filtered by permission inside
                the action — see modules/school-life/actions.ts. */}
              {canSearch ? <GlobalSearch /> : null}
              <FullscreenToggle />
              <LocaleSwitcher />
              <ThemeModeToggle />
              <UserMenu
                name={name}
                email={context.user.email}
                avatarUrl={context.user.profile?.avatarUrl ?? null}
                initials={initialsOf(name, context.user.email)}
              />
            </div>
          </header>

          {/* Binds the section colour for everything on the page — see
            components/shell/section-scope.tsx. */}
          <SectionScope className="mx-auto w-full min-w-0 max-w-[100rem] flex-1 p-4 md:p-6">
            {children}
          </SectionScope>
        </SidebarInset>
      </SidebarProvider>
    </SettingsProvider>
  );
}
