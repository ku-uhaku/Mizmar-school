import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Subscribing through useSyncExternalStore rather than useState + useEffect:
// the viewport is external state, and this avoids the cascading render that
// setting state inside an effect body causes.
function subscribe(onStoreChange: () => void) {
  const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  query.addEventListener("change", onStoreChange)
  return () => query.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// There is no viewport on the server; assume desktop and let the client correct
// it on hydration.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
