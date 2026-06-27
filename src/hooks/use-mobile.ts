import * as React from "react"

const MOBILE_BREAKPOINT = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function getServerSnapshot(): boolean {
  return false
}

function getClientSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
