"use client";

import * as React from "react";

/**
 * Tracks an element's rendered width.
 *
 * The charts draw at real pixel sizes rather than scaling a fixed viewBox: a
 * scaled viewBox would stretch strokes and text along with the geometry, so a
 * 2px line stops being 2px and labels distort. Measuring instead keeps every
 * mark at its specified size whatever the container does.
 *
 * Returns 0 until the first observation, which is the signal to render nothing
 * — drawing at a guessed width would flash a wrong layout on first paint.
 */
/**
 * `useLayoutEffect` warns when it runs during SSR, where it is a no-op anyway.
 * On the client it is what keeps the first measurement ahead of paint, so the
 * chart never flashes at zero width.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export function useMeasure<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
