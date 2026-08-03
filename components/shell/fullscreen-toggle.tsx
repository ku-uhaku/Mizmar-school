"use client";

import { MaximizeIcon, MinimizeIcon } from "lucide-react";
import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Puts the console full screen.
 *
 * Worth a button rather than leaving it to F11: the screens this app is used on
 * all day — the timetable grid, a class list, the caisse ledger — are wider than
 * they are tall, and a secretary working from a 1366×768 laptop gets back the
 * browser's chrome as usable rows. The keyboard shortcut exists but is not
 * discoverable, and on a shared machine nobody goes looking for it.
 *
 * Deliberately not persisted. Fullscreen can only be entered from a real user
 * gesture — a browser refuses `requestFullscreen()` called on load — so
 * remembering the preference would produce a setting that silently fails to
 * apply, which is worse than not offering it.
 */
function subscribeToFullscreen(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** For a value that cannot change while the page is open. */
function subscribeToNothing(): () => void {
  return () => {};
}

export function FullscreenToggle({
  variant = "ghost",
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const t = useT();

  /*
    Read through `useSyncExternalStore` rather than mirrored into state by an
    effect.

    Whether the page is fullscreen belongs to the document, not to this
    component: Escape and F11 both leave fullscreen without going through the
    button, and an icon still showing "exit" after that is a control that lies
    about what it will do. Copying it into `useState` inside an effect would
    also tear during a concurrent render, and is what
    `react-hooks/set-state-in-effect` exists to catch.

    The third argument is the server snapshot. There is no `document` there, and
    a page is never rendered fullscreen, so `false` is both safe and correct.
  */
  const isFullscreen = React.useSyncExternalStore(
    subscribeToFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );

  // iOS Safari on the phone has no Fullscreen API at all. Never changes within
  // a session, so it needs no subscription — but it must still render as
  // "supported" on the server to keep the markup stable through hydration.
  const isSupported = React.useSyncExternalStore(
    subscribeToNothing,
    () => Boolean(document.fullscreenEnabled),
    () => true,
  );

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Refused — a permissions policy, or a gesture the browser did not count.
      // There is nothing to tell the user that the unchanged screen does not
      // already say, so this stays quiet rather than raising a toast.
    }
  }

  if (!isSupported) return null;

  const label = isFullscreen
    ? t.appearance.exitFullscreen
    : t.appearance.enterFullscreen;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          onClick={toggle}
          aria-label={label}
          // Announces the state, not just the action, so a screen reader user
          // knows which way the toggle currently sits.
          aria-pressed={isFullscreen}
          // Hidden on small screens: a phone browser's fullscreen hides the URL
          // bar and little else, and the header has no room to spare there.
          className="hidden sm:inline-flex"
        >
          {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
