"use client";

import { usePathname } from "next/navigation";

import { sectionForPath } from "@/lib/nav";

/**
 * Binds `--section` for everything on the page (see globals.css).
 *
 * It wraps the page body in the dashboard layout, so any component underneath
 * can reach for `text-section` / `bg-section/10` without being told which
 * section it is in — a `PageHeader` on `/students` comes out vie scolaire blue
 * and the same header on `/transport` comes out logistique orange, with no prop
 * threaded through fifty pages.
 *
 * Client-side because only the client knows the pathname; it renders one `div`
 * and its children arrive already rendered from the server.
 */
export function SectionScope({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const section = sectionForPath(usePathname());

  return (
    <div data-section={section ?? undefined} className={className}>
      {children}
    </div>
  );
}
