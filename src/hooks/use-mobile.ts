import * as React from 'react'

const MOBILE_BREAKPOINT = 768

function useViewportNarrowMeasured(breakpoint: number): boolean | undefined {
  const [isNarrow, setIsNarrow] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsNarrow(window.innerWidth < breakpoint)
    }
    mql.addEventListener('change', onChange)
    setIsNarrow(window.innerWidth < breakpoint)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])

  return isNarrow
}

export function useIsMobile() {
  return !!useViewportNarrowMeasured(MOBILE_BREAKPOINT)
}

/**
 * Same viewport signal as `useIsMobile`, plus whether the first matchMedia
 * measurement has landed. The pre-measurement frame is indistinguishable from a
 * genuine desktop viewport, which is enough to break breakpoint-crossing
 * migration logic (B167) — the hydration settle must not be treated as a resize.
 */
export function useIsMobileMeasured(): { isMobile: boolean; measured: boolean } {
  const isMobile = useViewportNarrowMeasured(MOBILE_BREAKPOINT)
  return { isMobile: !!isMobile, measured: isMobile !== undefined }
}

/**
 * Generic viewport-narrow signal with the same hydration settle as
 * `useIsMobileMeasured`, at a caller-chosen breakpoint (C95 — the agenda view
 * selector mirrors the calendar's own narrow threshold).
 */
export function useNarrowMeasured(breakpoint: number): { isNarrow: boolean; measured: boolean } {
  const isNarrow = useViewportNarrowMeasured(breakpoint)
  return { isNarrow: !!isNarrow, measured: isNarrow !== undefined }
}
