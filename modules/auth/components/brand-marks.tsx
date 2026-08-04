/**
 * Placeholder brand marks for the sign-in screen.
 *
 * Both are inline SVG on purpose: the real artwork has not been supplied yet,
 * and inlining keeps the login screen free of a network request and of a
 * missing-asset 404 while it is still a placeholder. Replace the body of each
 * component with the real mark (or an <img> pointing at `public/`) when it
 * lands — nothing else on the page needs to change.
 */

import { cn } from "@/lib/utils";

/** The school group's mark. */
export function GroupMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-hidden
      className={cn("size-9", className)}
    >
      <rect width="40" height="40" rx="11" className="fill-primary" />
      <path
        d="M20 10.5 30 15.5 20 20.5 10 15.5 20 10.5Z"
        className="fill-primary-foreground"
      />
      <path
        d="M13.5 19v6.2c0 2.4 2.9 4.3 6.5 4.3s6.5-1.9 6.5-4.3V19L20 22.4 13.5 19Z"
        className="fill-primary-foreground/70"
      />
    </svg>
  );
}

/** The publisher's mark — placeholder until the real logo is provided. */
export function OwnerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-hidden
      className={cn("size-9", className)}
    >
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="10.25"
        className="fill-muted stroke-border"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <path
        d="M13 27V13h5.4a4.3 4.3 0 0 1 0 8.6H13"
        className="stroke-muted-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="25.5" cy="25.5" r="2" className="fill-muted-foreground" />
    </svg>
  );
}
