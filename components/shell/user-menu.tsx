"use client";

import * as React from "react";
import Link from "next/link";
import { LogOutIcon, PaletteIcon, UserIcon } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { useT } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  name,
  email,
  avatarUrl,
  initials,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
}) {
  const t = useT();
  const signOutFormRef = React.useRef<HTMLFormElement>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={name}>
          <Avatar className="size-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="grid gap-0.5">
            <span className="truncate font-medium">{name}</span>
            <span className="text-muted-foreground truncate text-xs" dir="ltr">
              {email}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon />
            {t.nav.profile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/appearance">
            <PaletteIcon />
            {t.nav.appearance}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onSelect={() => signOutFormRef.current?.requestSubmit()}
        >
          <LogOutIcon />
          {t.auth.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Signing out is a mutation, so it goes through a form POST rather than
          an onClick. Kept outside the menu content so it is not unmounted when
          the menu closes on select. */}
      <form ref={signOutFormRef} action={logoutAction} className="hidden" />
    </DropdownMenu>
  );
}
