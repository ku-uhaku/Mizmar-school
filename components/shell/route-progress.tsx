"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/components/providers/i18n-provider";

/**
 * The thin bar across the top of the window while the next screen is being
 * fetched.
 *
 * Next gives no global "navigation in flight" hook — `useLinkStatus` reports
 * one link at a time, and the history entry is only pushed once the new tree
 * has already committed. So the two ends are observed separately: a click on an
 * internal link (or a back/forward) starts the bar, and the URL actually
 * changing ends it. Programmatic `router.push` calls are therefore not covered;
 * they are almost always the tail of a form submit, which shows its own pending
 * state on the button that was pressed.
 *
 * It never reaches 100% on its own. There is no way to know how much of a
 * streamed response is left, so it eases towards a ceiling and only completes
 * when the navigation really has — a bar that fills and then waits is a lie the
 * user learns to distrust.
 */

/** Long enough that a prefetched, instant navigation shows nothing at all. */
const APPEAR_AFTER_MS = 120;
const TRICKLE_MS = 200;
/** How long the filled bar stays on screen before it fades. */
const SETTLE_MS = 260;
/**
 * Nothing should be able to leave the bar running forever — a navigation that
 * ends in a download or a cancelled fetch never changes the URL.
 */
const GIVE_UP_MS = 15_000;

/** The asymptote it creeps towards while it waits. */
const CEILING = 92;

export function RouteProgress() {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `null` is "not navigating" — nothing is rendered at all, so the bar cannot
  // sit at zero width catching the eye between navigations.
  const [value, setValue] = useState<number | null>(null);

  const running = useRef(false);
  /*
    Two sets of timers, because they must not be cancelled together. The fade
    at the end of one navigation outlives the start of the next: clicking
    through a sidebar quickly would otherwise snap a full bar back to 8% while
    the eye is still on it, which reads as the previous page having failed.
  */
  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Everything belonging to the navigation in flight — not the fade. */
  const clearPending = useCallback(() => {
    pending.current.forEach(clearTimeout);
    pending.current = [];
    if (trickle.current) clearInterval(trickle.current);
    trickle.current = null;
  }, []);

  const clearAll = useCallback(() => {
    clearPending();
    if (settle.current) clearTimeout(settle.current);
    settle.current = null;
  }, [clearPending]);

  const finish = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    clearPending();
    // Still `null` when the navigation beat `APPEAR_AFTER_MS`: it was instant,
    // and the user should never learn it happened.
    setValue((current) => (current === null ? null : 100));

    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => setValue(null), SETTLE_MS);
  }, [clearPending]);

  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    clearPending();

    pending.current.push(
      setTimeout(() => {
        // The previous navigation's fade is still on its own timer, and it ends
        // by hiding the bar. Take it over rather than let it hide this one.
        if (settle.current) clearTimeout(settle.current);
        settle.current = null;

        setValue(8);
        trickle.current = setInterval(() => {
          setValue((current) =>
            current === null ? current : current + (CEILING - current) * 0.1,
          );
        }, TRICKLE_MS);
      }, APPEAR_AFTER_MS),
    );

    pending.current.push(setTimeout(finish, GIVE_UP_MS));
  }, [clearPending, finish]);

  // The end of a navigation: the router only adopts the new URL once the tree
  // it belongs to has committed.
  const url = `${pathname}?${searchParams}`;
  const lastUrl = useRef(url);
  useEffect(() => {
    if (lastUrl.current === url) return;
    lastUrl.current = url;
    finish();
  }, [url, finish]);

  useEffect(() => {
    /*
      Bubble phase at the document, so React's own root handler has already run
      by the time this sees the event — which is the point. `<Link>` calls
      `preventDefault` on every internal click before handing off to the router
      (next/dist/client/app-dir/link.js), so a click that *will* navigate
      arrives here already defaulted-prevented. Testing for the opposite, as
      this once did, rejects every navigation in the app and the bar never
      shows.
    */
    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;

      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      // Also rules out mailto: and tel:, whose origin is never this one.
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      // A link to where we already are loads nothing, so nothing would ever
      // end the bar.
      if (target.pathname + target.search === pathname + window.location.search)
        return;

      start();
    }

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", start);
    };
  }, [pathname, start]);

  useEffect(() => clearAll, [clearAll]);

  if (value === null) return null;

  return (
    <div
      role="progressbar"
      aria-label={t.common.loading}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5 print:hidden"
    >
      {/* Width rather than a transform, so it grows from the inline start in
        both directions without the origin having to be flipped for Arabic. */}
      <div
        className="bg-primary h-full shadow-[0_0_8px_1px_var(--color-primary)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${value}%`, opacity: value === 100 ? 0 : 1 }}
      />
    </div>
  );
}

/** A click the browser would navigate on — not a new tab, not a middle click. */
function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
