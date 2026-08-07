import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, useWindowDimensions } from "react-native";

/**
 * How much of the screen the keyboard covers that the layout has *not* already
 * accounted for.
 *
 * ── Why this is not just the keyboard's height ──────────────────────────────
 * Android's `softwareKeyboardLayoutMode` defaults to "resize", which shrinks
 * the window when the keyboard opens — the layout has already moved, and adding
 * the keyboard's height on top of that pushes the composer far above the
 * keyboard, which is what a plain `KeyboardAvoidingView` with an offset did
 * here. On iOS the window does not resize, so the full height is genuinely
 * needed.
 *
 * Rather than branch on the platform and hope, this measures: the window height
 * with the keyboard down is the baseline, and whatever the window lost when it
 * came up is height the layout has already given back. The overlap is what is
 * left.
 *
 *   resized fully   → window shrank by the keyboard's height → overlap 0
 *   not resized     → window unchanged → overlap is the whole keyboard
 *   partially       → the difference, which is the honest answer
 *
 * Returns 0 whenever the keyboard is down, so a caller can add it to padding
 * unconditionally.
 */
export function useKeyboardOverlap(): number {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // The window height with nothing covering it. Captured while the keyboard is
  // down, and re-captured on rotation because the baseline changes with it.
  const baseline = useRef(windowHeight);
  if (keyboardHeight === 0 && baseline.current !== windowHeight) {
    baseline.current = windowHeight;
  }

  useEffect(() => {
    // `Will` on iOS so the padding animates with the keyboard rather than after
    // it; Android only emits `Did`.
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardHeight === 0) return 0;

  const reclaimedByResize = Math.max(0, baseline.current - windowHeight);
  return Math.max(0, keyboardHeight - reclaimedByResize);
}
