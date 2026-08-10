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
  /**
   * Custom footer for a sheet whose commit is an explicit submit (E14's
   * "Registrar movimento", B42's "Registrar atualização"). Rendered INLINE in
   * the host's DrawerFooter so its controls resolve the Drawer's context —
   * the cell's own tree has no `Drawer.Root`, and a portaled footer keeps the
   * source context and crashes base-ui's `DialogClose` (C109). The element is
   * still CREATED by the cell (form state, `form` attribute association live
   * there); only its render location moves — so it can rely on props/state
   * captured by the cell and on providers ABOVE the sheet provider, never on
   * providers local to the cell.
   */
  footer?: ReactNode
  sheetBodyClassName?: string
  onOpenChange: (open: boolean) => void
}

type CampaignListSheetContextValue = {
  bodyPortalRef: RefObject<HTMLDivElement | null>
  /** Bumps when the drawer body mount target attaches — portals read this. */
  portalRevision: number
  openSheet: (chrome: CampaignListSheetChrome) => void
  dismissSheet: (onOpenChange: (open: boolean) => void) => void
  isActiveSheet: (onOpenChange: (open: boolean) => void) => boolean
}

const CampaignListSheetContext = createContext<CampaignListSheetContextValue | null>(null)

export const useCampaignListSheet = () => useContext(CampaignListSheetContext)

/**
 * One bottom Drawer for an entire list surface (B42 mobile cards). Cell bodies
 * portal into it so we never mount hundreds of Drawer roots and never sync form
 * trees through provider state (which tripped React #185 in prod). Custom
 * footers travel in the chrome instead of portaling: a portaled footer keeps
 * the cell's context, which has no `Drawer.Root`, and crashes (C109).
 */
export const CampaignListSheetProvider = ({ children }: { children: ReactNode }) => {
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const bodyPortalRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [chrome, setChrome] = useState<CampaignListSheetChrome | null>(null)
  const [portalRevision, setPortalRevision] = useState(0)
  const activeOnOpenChangeRef = useRef<((open: boolean) => void) | null>(null)

  const attachBodyPortal = useCallback((node: HTMLDivElement | null) => {
    bodyPortalRef.current = node
    if (node) setPortalRevision((value) => value + 1)
  }, [])

  const dismissSheet = useCallback((onOpenChange: (open: boolean) => void) => {
    if (activeOnOpenChangeRef.current !== onOpenChange) return
    setOpen(false)
    activeOnOpenChangeRef.current = null
    setChrome(null)
    onOpenChange(false)
  }, [])

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
        // Deliberately NOT `hasCustomFooter`: a custom footer is a fresh JSX
        // element on every cell render, and this comparison is what forces the
        // host to adopt it — `isPending`/spinner freshness depends on the
        // footer being re-rendered here (the cell no longer renders it itself).
        current.footer === next.footer
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
      const onOpenChange = activeOnOpenChangeRef.current
      if (!onOpenChange) {
        setOpen(false)
        setChrome(null)
        return
      }
      dismissSheet(onOpenChange)
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
    }),
    [portalRevision, openSheet, dismissSheet, isActiveSheet],
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
              {chrome.footer ?? <DrawerCloseButton>Fechar</DrawerCloseButton>}
            </DrawerFooter>
          </DrawerContent>
        ) : null}
      </Drawer>
    </CampaignListSheetContext.Provider>
  )
}
