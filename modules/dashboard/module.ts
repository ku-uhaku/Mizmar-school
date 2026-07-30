import { defineModule } from "@/lib/module";

export const dashboardModule = defineModule({
  id: "dashboard",
  nav: [
    {
      href: "/",
      icon: "dashboard",
      section: "main",
      labelKey: "dashboard",
      order: 0,
    },
  ],
});
