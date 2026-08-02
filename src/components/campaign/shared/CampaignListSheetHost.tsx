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
  footerPortalRef: RefObject<HTMLDivElement | null>
  /** Bumps when the drawer body/footer mount targets attach — portals read this. */
  portalRevision: number
  openSheet: (chrome: CampaignListSheetChrome) => void
  /** Dismiss whichever cell opened the shared sheet (B119 — stable ref, not callback identity). */
  dismissActiveSheet: () => void
  dismissSheet: (onOpenChange: (open: boolean) => void) => void
  isActiveSheet: (onOpenChange: (open: boolean) => void) => boolean
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
  const footerPortalRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [chrome, setChrome] = useState<CampaignListSheetChrome | null>(null)
  const [portalRevision, setPortalRevision] = useState(0)
  const activeOnOpenChangeRef = useRef<((open: boolean) => void) | null>(null)

  const attachBodyPortal = useCallback((node: HTMLDivElement | null) => {
    bodyPortalRef.current = node
    if (node) setPortalRevision((value) => value + 1)
  }, [])

  const attachFooterPortal = useCallback((node: HTMLDivElement | null) => {
    footerPortalRef.current = node
    if (node) setPortalRevision((value) => value + 1)
  }, [])

  const dismissActiveSheet = useCallback(() => {
    const onOpenChange = activeOnOpenChangeRef.current
    setOpen(false)
    activeOnOpenChangeRef.current = null
    setChrome(null)
    onOpenChange?.(false)
  }, [])

  const dismissSheet = useCallback(
    (onOpenChange: (open: boolean) => void) => {
      if (activeOnOpenChangeRef.current !== onOpenChange) return
      dismissActiveSheet()
    },
    [dismissActiveSheet],
  )

  const openSheet = useCallback((next: CampaignListSheetChrome) => {
    const previousOnOpenChange = activeOnOpenChangeRef.current
    if (previousOnOpenChange && previousOnOpenChange !== next.onOpenChange) {
      previousOnOpenChange(false)
    }
    activeOnOpenChangeRef.current = next.onOpenChange
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
  }, [])

  const isActiveSheet = useCallback(
    (onOpenChange: (open: boolean) => void) =>
      open && activeOnOpenChangeRef.current === onOpenChange,
    [open],
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return
      if (!activeOnOpenChangeRef.current) {
        setOpen(false)
        setChrome(null)
        return
      }
      dismissActiveSheet()
    },
    [dismissActiveSheet],
  )

  const contextValue = useMemo(
    () => ({
      bodyPortalRef,
      footerPortalRef,
      portalRevision,
      openSheet,
      dismissActiveSheet,
      dismissSheet,
      isActiveSheet,
    }),
    [portalRevision, openSheet, dismissActiveSheet, dismissSheet, isActiveSheet],
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
              <div ref={attachFooterPortal} className="flex w-full flex-col gap-2" />
              {!chrome.hasCustomFooter ? <DrawerCloseButton>Fechar</DrawerCloseButton> : null}
            </DrawerFooter>
          </DrawerContent>
        ) : null}
      </Drawer>
    </CampaignListSheetContext.Provider>
  )
}
