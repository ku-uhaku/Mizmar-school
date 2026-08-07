import Image from "next/image";

import { isDisplayableImage } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * The two brands the sign-in screen carries, and they are not the same thing.
 *
 * `MizmarMark` is the product — whoever the school group is, the software is
 * Mizmar, and it belongs on the panel that describes the software.
 * `OrganizationMark` is the customer: the group whose login page this is, shown
 * beside the form where somebody is about to type *their* password. Putting the
 * product's logo there instead would tell a secretary nothing about whether
 * they are on their own school's site.
 */

/**
 * The Mizmar brand: the mark, and the name set in the page's own type.
 *
 * ── Why the name is text and not the supplied logo ──────────────────────────
 * `public/mizmar.png` sets "Mizmar" in a very dark navy — around #181848. That
 * is right on the white background it was drawn for and invisible on the deep
 * blue panel it now sits on, and recolouring the ink would have meant lifting
 * every dark pixel in the file, including the flute's own body and its finger
 * holes. So the artwork contributes the part that survives a dark background —
 * the instrument and its traces — and the name is set in the interface's type,
 * which inherits whatever colour the surface calls for and stays crisp at any
 * size.
 */
export function MizmarMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Image
        src="/mizmar-mark.png"
        alt=""
        width={512}
        height={512}
        // Eager, and it is the one image on the page worth it: this sits at the
        // top of the first screen anybody sees, and lazy-loading a logo that is
        // already in the viewport only makes it arrive late.
        priority
        className="h-full w-auto"
      />
      <span className="text-4xl font-semibold tracking-tight xl:text-5xl">
        Mizmar
      </span>
    </div>
  );
}

/**
 * The group's own crest, or its initials when it has not uploaded one.
 *
 * The fallback is the initials rather than a generic building icon: a school
 * group that has not got round to uploading a crest still has a name, and its
 * own letters say more about whose login page this is than a stock glyph does.
 */
export function OrganizationMark({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (isDisplayableImage(logoUrl)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl as string}
        alt={name}
        // `object-contain` on a fixed square: a crest is rarely square, and
        // cropping one is how you cut the name off its own badge — the same
        // rule the sidebar follows.
        className={cn(
          "bg-background size-12 shrink-0 rounded-xl object-contain",
          className,
        )}
      />
    );
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <div
      aria-hidden
      className={cn(
        "bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-semibold",
        className,
      )}
    >
      {initials}
    </div>
  );
}
