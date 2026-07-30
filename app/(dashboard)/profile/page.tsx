import type { Metadata } from "next";

import {
  PasswordChangeForm,
  ProfileDetailsForm,
} from "@/modules/profile/components/profile-forms";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { toDateInputValue } from "@/lib/utils";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  // No permission gate: everyone may manage their own account.
  const context = await requireAuth();
  const t = await getDictionary();

  const profile = context.user.profile;

  return (
    <>
      <PageHeader title={t.profile.title} description={t.profile.subtitle} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProfileDetailsForm
            profile={{
              firstName: profile?.firstName ?? "",
              lastName: profile?.lastName ?? "",
              phone: profile?.phone ?? null,
              jobTitle: profile?.jobTitle ?? null,
              bio: profile?.bio ?? null,
              avatarUrl: profile?.avatarUrl ?? null,
              birthDate: toDateInputValue(profile?.birthDate),
              email: context.user.email,
            }}
          />
        </div>

        <div className="grid gap-4">
          {/* A read-only summary of what this account can reach. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.profile.access}</CardTitle>
              <CardDescription>{t.context.workingContext}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs">
                  {t.profile.orgRole}
                </p>
                {context.isSuperAdmin ? (
                  <Badge>{t.user.superAdmin}</Badge>
                ) : context.user.orgRole ? (
                  <Badge>{context.user.orgRole.name}</Badge>
                ) : (
                  <p className="text-muted-foreground">{t.common.none}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs">
                  {t.profile.schoolRoles}
                </p>
                {context.user.memberships.length === 0 ? (
                  <p className="text-muted-foreground">{t.user.noAccess}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {context.user.memberships.map((membership) => (
                      <li
                        key={membership.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{membership.school.name}</span>
                        <Badge variant="secondary" className="shrink-0">
                          {membership.role.name}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <PasswordChangeForm />
        </div>
      </div>
    </>
  );
}
