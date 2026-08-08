import * as React from 'react'

const MOBILE_BREAKPOINT = 768

function useMobileMeasured(): boolean | undefined {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

export function useIsMobile() {
  return !!useMobileMeasured()
}

/**
 * Same viewport signal as `useIsMobile`, plus whether the first matchMedia
 * measurement has landed. The pre-measurement frame is indistinguishable from a
 * genuine desktop viewport, which is enough to break breakpoint-crossing
 * migration logic (B167) — the hydration settle must not be treated as a resize.
 */
export function useIsMobileMeasured(): { isMobile: boolean; measured: boolean } {
  const isMobile = useMobileMeasured()
  return { isMobile: !!isMobile, measured: isMobile !== undefined }
}
