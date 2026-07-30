import { AppSidebar } from "@/components/shell/app-sidebar";
import { ContextSwitcher } from "@/modules/context/components/context-switcher";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
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

  return (
    <SidebarProvider>
      <AppSidebar
        sections={sections}
        organizationName={context.organization.name}
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

        <div className="mx-auto w-full min-w-0 max-w-[100rem] flex-1 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
