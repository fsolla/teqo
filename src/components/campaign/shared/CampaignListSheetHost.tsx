'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { cn } from '@/lib/utils'

export type CampaignListSheetChrome = {
  title: string
  description?: string
  hasCustomFooter: boolean
  sheetBodyClassName?: string
  onOpenChange: (open: boolean) => void
}

type CampaignListSheetContextValue = {
  bodyPortalRef: RefObject<HTMLDivElement | null>
  /** Bumps when the drawer body mount target attaches — portals read this. */
  portalRevision: number
  /** Opens the shared drawer; returns the session id the caller must keep. */
  openSheet: (chrome: CampaignListSheetChrome) => number
  /** Closes the drawer only when `sessionId` is the active session. */
  dismissSheet: (sessionId: number, onOpenChange: (open: boolean) => void) => void
  isActiveSheet: (sessionId: number) => boolean
  /**
   * C109 — the caller's custom footer (submit + `DrawerCloseButton`) must
   * render INSIDE the drawer's React tree: the overlay lives outside the
   * `Drawer`, so a portal keeps the Dialog context away from `DialogClose`.
   * The host renders the registered node for the ACTIVE session only — a
   * stale session's close render can never wipe the open drawer's footer.
   */
  setFooterContent: (sessionId: number, footer: ReactNode | null) => void
}

const CampaignListSheetContext = createContext<CampaignListSheetContextValue | null>(null)

export const useCampaignListSheet = () => useContext(CampaignListSheetContext)

/**
 * One bottom Drawer for an entire list surface (B42 mobile cards). Cell bodies
 * portal into it so we never mount hundreds of Drawer roots and never sync form
 * trees through provider state (which tripped React #185 in prod).
 */
export const CampaignListSheetProvider = ({ children }: { children: ReactNode }) => {
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const bodyPortalRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [chrome, setChrome] = useState<CampaignListSheetChrome | null>(null)
  const [portalRevision, setPortalRevision] = useState(0)
  const [footerContent, setFooterContent] = useState<ReactNode | null>(null)
  const activeOnOpenChangeRef = useRef<((open: boolean) => void) | null>(null)
  /**
   * C109 (2026-08-10, B193) — sheet sessions are keyed by a monotonically
   * increasing id instead of the control's `onOpenChange` identity: the
   * autosave/level callbacks are recreated per render, so ANY re-render of an
   * open control (a keystroke, `isPending`) used to look like "a different
   * control opened" — the host dismissed the old session, the drawer stayed
   * up with its body portal torn down, and the next `DialogClose` crashed
   * outside its root. A session id survives re-renders; only an explicit
   * open/close moves it.
   */
  const sessionCounterRef = useRef(0)
  const activeSessionRef = useRef<number | null>(null)

  const attachBodyPortal = useCallback((node: HTMLDivElement | null) => {
    bodyPortalRef.current = node
    if (node) setPortalRevision((value) => value + 1)
  }, [])

  const dismissSheet = useCallback((sessionId: number, onOpenChange: (open: boolean) => void) => {
    if (activeSessionRef.current !== sessionId) return
    setOpen(false)
    activeSessionRef.current = null
    activeOnOpenChangeRef.current = null
    setChrome(null)
    setFooterContent(null)
    onOpenChange(false)
  }, [])

  const openSheet = useCallback((next: CampaignListSheetChrome): number => {
    const session = ++sessionCounterRef.current
    const previousOnOpenChange = activeOnOpenChangeRef.current
    if (previousOnOpenChange && previousOnOpenChange !== next.onOpenChange) {
      previousOnOpenChange(false)
    }
    activeOnOpenChangeRef.current = next.onOpenChange
    activeSessionRef.current = session
    setFooterContent(null)
    setChrome((current) => {
      if (
        current &&
        current.onOpenChange === next.onOpenChange &&
        current.title === next.title &&
        current.description === next.description &&
        current.sheetBodyClassName === next.sheetBodyClassName &&
        current.hasCustomFooter === next.hasCustomFooter
      ) {
        return current
      }
      return next
    })
    setOpen(true)
    return session
  }, [])

  const isActiveSheet = useCallback(
    (sessionId: number) => open && activeSessionRef.current === sessionId,
    [open],
  )

  const registerFooter = useCallback((sessionId: number, footer: ReactNode | null) => {
    if (activeSessionRef.current !== sessionId) return
    setFooterContent(footer)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return
      const sessionId = activeSessionRef.current
      const onOpenChange = activeOnOpenChangeRef.current
      if (sessionId === null || !onOpenChange) {
        setOpen(false)
        setChrome(null)
        return
      }
      dismissSheet(sessionId, onOpenChange)
    },
    [dismissSheet],
  )

  const contextValue = useMemo(
    () => ({
      bodyPortalRef,
      portalRevision,
      openSheet,
      dismissSheet,
      isActiveSheet,
      setFooterContent: registerFooter,
    }),
    [portalRevision, openSheet, dismissSheet, isActiveSheet, registerFooter],
  )

  return (
    <CampaignListSheetContext.Provider value={contextValue}>
      {children}
      <Drawer open={open} onOpenChange={handleOpenChange}>
        {chrome && open ? (
          <DrawerContent initialFocus={titleRef}>
            <DrawerHeader>
              <DrawerTitle ref={titleRef} tabIndex={-1} className="outline-none">
                {chrome.title}
              </DrawerTitle>
              {chrome.description ? (
                <DrawerDescription>{chrome.description}</DrawerDescription>
              ) : null}
            </DrawerHeader>
            <div
              ref={attachBodyPortal}
              className={cn(
                'flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-2',
                chrome.sheetBodyClassName,
              )}
            />
            <DrawerFooter>
              {/* C109 — the custom footer renders HERE, inside the Drawer's
                  React tree, so its `DialogClose` has the root context; the
                  body keeps the portal (its content never needs Dialog). */}
              {footerContent ? (
                <div className="flex w-full flex-col gap-2">{footerContent}</div>
              ) : null}
              {!chrome.hasCustomFooter ? <DrawerCloseButton>Fechar</DrawerCloseButton> : null}
            </DrawerFooter>
          </DrawerContent>
        ) : null}
      </Drawer>
    </CampaignListSheetContext.Provider>
  )
}
