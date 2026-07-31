import {
  ArrowLeftRightIcon,
  BanknoteArrowDownIcon,
  BanknoteArrowUpIcon,
  BuildingIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  HomeIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  ReceiptTextIcon,
  SchoolIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import type { NavIcon } from "@/lib/module";

/**
 * Maps the icon *names* modules use in their manifests to real components.
 *
 * The indirection exists because nav entries cross the server/client boundary —
 * the sidebar is filtered on the server and a component is not serialisable.
 * Adding an icon is a two-step change: the name in `lib/module.ts` (`NavIcon`)
 * and the mapping here. `Record<NavIcon, …>` makes forgetting the second half a
 * compile error.
 */
export const NAV_ICONS: Record<NavIcon, typeof LayoutDashboardIcon> = {
  dashboard: LayoutDashboardIcon,
  organization: BuildingIcon,
  schools: SchoolIcon,
  schoolYears: CalendarRangeIcon,
  users: UsersIcon,
  roles: ShieldCheckIcon,
  profile: UserIcon,
  appearance: PaletteIcon,
  configuration: SettingsIcon,
  schoolLife: HeartHandshakeIcon,
  students: GraduationCapIcon,
  families: HomeIcon,
  classes: LayersIcon,
  timetable: CalendarClockIcon,
  cashRegister: WalletIcon,
  encaissement: BanknoteArrowDownIcon,
  decaissement: BanknoteArrowUpIcon,
  transfert: ArrowLeftRightIcon,
  cheques: ReceiptTextIcon,
};
