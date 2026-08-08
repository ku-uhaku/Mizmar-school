import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A set of ticked ids, kept on the device and nowhere else.
 *
 * ── Why this is not on the server ───────────────────────────────────────────
 * A tick means "I have this in the basket", which is a fact about the person
 * holding the phone rather than about the child. Two parents share one
 * household account, so a tick saved to the school would tell the other one
 * that the cahiers were bought — which may not be true, and which the school
 * has no business recording either way.
 *
 * `AsyncStorage`, not `expo-secure-store`: the latter is the Keychain, meant
 * for the tokens, with a size limit and a cost per read that a shopping list
 * has no use for. Nothing here is a secret.
 *
 * ── The two states that are not the same ────────────────────────────────────
 * "Nothing ticked yet" and "not read from disk yet" look alike and are not: a
 * screen that renders the first while the second is true flashes every item
 * unticked and then corrects itself. `isReady` is what lets a caller wait.
 */
export function useChecklist(storageKey: string): {
  ticked: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
  isReady: boolean;
} {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [isReady, setIsReady] = useState(false);

  // Guards a write racing the first read: without it, a tap landing before the
  // load finishes is overwritten by whatever was on disk a moment ago.
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const ids = JSON.parse(raw) as unknown;
            if (Array.isArray(ids)) {
              setTicked(new Set(ids.filter((id): id is string => typeof id === "string")));
            }
          } catch {
            // Corrupt entry — a shopping list is not worth surfacing an error
            // for. Start empty and let the next write replace it.
          }
        }
      })
      .finally(() => {
        if (cancelled) return;
        loaded.current = true;
        setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const persist = useCallback(
    (next: Set<string>) => {
      if (!loaded.current) return;
      // Not awaited: the tick has already happened on screen, and a write that
      // fails costs a re-tick rather than anything worth blocking a tap for.
      void AsyncStorage.setItem(storageKey, JSON.stringify([...next]));
    },
    [storageKey],
  );

  const toggle = useCallback(
    (id: string) =>
      setTicked((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      }),
    [persist],
  );

  const clear = useCallback(() => {
    setTicked(new Set());
    void AsyncStorage.removeItem(storageKey);
  }, [storageKey]);

  return { ticked, toggle, clear, isReady };
}
