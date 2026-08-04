'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type { PanelImperativeHandle } from 'react-resizable-panels'

type AISidebarContextValue = {
  open: boolean
  /** Opens/closes the desktop Panel AND toggles the mobile Drawer. */
  setOpen: (open: boolean) => void
  /** Opens the mobile Drawer only — does NOT expand the desktop Panel. */
  setOpenMobile: (open: boolean) => void
  /** Toggles the desktop Panel. */
  toggle: () => void
}

const AISidebarContext = createContext<AISidebarContextValue | null>(null)

export const CampaignAISidebarProvider = ({
  panelRef,
  children,
}: {
  panelRef: MutableRefObject<PanelImperativeHandle | null>
  children: ReactNode
}) => {
  const [open, setOpen] = useState(false)

  const setOpenWithPanel = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next) {
        panelRef.current?.expand()
      } else {
        panelRef.current?.collapse()
      }
    },
    [panelRef],
  )

  const setOpenMobile = useCallback((next: boolean) => {
    setOpen(next)
    // Don't touch the Panel — it's hidden on mobile
  }, [])

  const toggle = useCallback(() => setOpenWithPanel(!open), [open, setOpenWithPanel])

  const value = useMemo(
    () => ({ open, setOpen: setOpenWithPanel, setOpenMobile, toggle }),
    [open, setOpenWithPanel, setOpenMobile, toggle],
  )

  return <AISidebarContext.Provider value={value}>{children}</AISidebarContext.Provider>
}

export const useAISidebar = (): AISidebarContextValue | null => {
  return useContext(AISidebarContext)
}
