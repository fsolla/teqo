'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { useCampaignListSheet } from '@/components/campaign/shared/CampaignListSheetHost'
import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

export type CampaignCellEditOverlayVariant = 'popover' | 'sheet'

/** `relative` is load-bearing: see the comment where it is composed below. */
const campaignCellEditTriggerClassName =
  'relative min-h-11 rounded-md px-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type CampaignCellEditOverlayProps = {
  variant: CampaignCellEditOverlayVariant
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dialog title: the Drawer's heading, and the Popover's accessible name. */
  title: string
  trigger: ReactNode
  triggerLabel: string
  triggerClassName?: string
  triggerBusy?: boolean
  /**
   * Announced by the region this shell keeps OUTSIDE the overlay. Closing is
   * what commits a draft, and a region rendered inside the Popover/Drawer
   * unmounts with it — so the one announcement that matters most ("Salvando…",
   * and the failure that follows) was the one that never reached a screen
   * reader (B32+ F4).
   */
  statusMessage?: string
  children: ReactNode

  // Popover only ─────────────────────────────────────────────────────────────
  /** B23's read-without-opening tooltip: there is no hover on touch. */
  tooltipContent?: ReactNode
  align?: 'start' | 'center' | 'end'
  contentClassName?: string
  /**
   * Leaves focus on the trigger so the control's own fields decide what to
   * focus. The Drawer never needs it — it always opens with focus on its title,
   * never on a field (see `initialFocus` below).
   */
  preventPopoverAutoFocus?: boolean

  // Sheet only ───────────────────────────────────────────────────────────────
  /** Subject line under the title: which row is being edited. */
  description?: string
  sheetBodyClassName?: string
  /**
   * Replaces the default "Fechar" for a sheet whose primary action is an
   * explicit submit (E14's "Registrar movimento"): in a scrolling body the
   * button drifts below the fold, and the footer is where a thumb expects it.
   * A submit that belongs to a `<form>` in `children` is associated by the
   * standard `form` attribute — the caller owns both ids, so the shell does not
   * need to know there is a form at all.
   */
  footer?: ReactNode
}

/**
 * Container for the list's in-cell quick-edit surfaces: a Popover on `md+`, a
 * bottom Drawer below it, where a Popover competes with the virtual keyboard
 * (B42; `MunicipalityListSignalControl` set the precedent in B26).
 *
 * The variant comes from the call site, not from `matchMedia`: the lists render
 * the mobile cards (`md:hidden`) and the table (`hidden md:block`) as sibling
 * trees, so each already knows which viewport it belongs to — and a media query
 * here would flip the container after hydration.
 *
 * Only the container lives here. Each control keeps its own auto-save scaffold
 * (debounce, abort, flush on close), which is what `onOpenChange` carries — so
 * closing the Drawer commits exactly like dismissing the Popover does.
 *
 * When a `CampaignListSheetProvider` wraps the list (B42 mobile cards), sheet
 * cells publish into that single Drawer instead of mounting one per row — prod
 * was tripping React #130 with ~125 idle drawer roots on a 25-row page.
 */
export const CampaignCellEditOverlay = ({
  variant,
  open,
  onOpenChange,
  title,
  description,
  trigger,
  triggerLabel,
  triggerClassName,
  triggerBusy,
  statusMessage,
  tooltipContent,
  align = 'start',
  contentClassName,
  sheetBodyClassName,
  footer,
  preventPopoverAutoFocus,
  children,
}: CampaignCellEditOverlayProps) => {
  const sharedSheet = useCampaignListSheet()
  const wasOpenRef = useRef(open)

  /**
   * The region is mounted from the first open onwards and never unmounted
   * again — a live region has to exist BEFORE its text changes or most screen
   * readers skip the first message, and it has to outlive the close, which is
   * what commits. Mounting it unconditionally instead would leave ~250 polite
   * regions registered on a 25-row município page (5 controls × 2 sibling
   * trees), which is a load on assistive tech that nothing here needs.
   */
  const [everOpened, setEverOpened] = useState(open)
  if (open && !everOpened) setEverOpened(true)

  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const triggerButton = (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-busy={triggerBusy || undefined}
      // `relative` (in the shared class) is load-bearing on the mobile card,
      // where the município's own link stretches an `after:inset-0` overlay
      // across the whole card: it is what paints this trigger above that overlay
      // and keeps its tap. It belongs on the control and not on the cell around
      // it — a positioned cell would lift its label and padding too, turning
      // them into taps that neither edit nor navigate.
      className={cn(
        campaignCellEditTriggerClassName,
        open ? 'bg-muted/60' : undefined,
        triggerClassName,
      )}
      aria-label={triggerLabel}
      // The Popover's own trigger owns the click; the Drawer has none to borrow.
      onClick={variant === 'sheet' ? () => onOpenChange(true) : undefined}
    >
      {trigger}
    </button>
  )

  // One region per control, next to its trigger — never a single global one:
  // two cells saving at once would then overwrite each other's announcement,
  // and neither would say which row it came from.
  // `role="status"` and not a bare `aria-live`: its implicit `aria-atomic`
  // makes the sentence be announced whole, which is what these messages are —
  // `MunicipalityPortfolioCell` had already settled on it.
  const liveRegion =
    statusMessage === undefined || !everOpened ? null : (
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    )

  useLayoutEffect(() => {
    if (variant !== 'sheet' || !sharedSheet) return

    const wasOpen = wasOpenRef.current
    wasOpenRef.current = open

    if (!open) {
      if (wasOpen) sharedSheet.dismissSheet(onOpenChange)
      return
    }

    sharedSheet.openSheet({
      title,
      description,
      hasCustomFooter: Boolean(footer),
      sheetBodyClassName,
      onOpenChange,
    })
  }, [variant, sharedSheet, open, title, description, footer, sheetBodyClassName, onOpenChange])

  if (variant === 'sheet' && sharedSheet) {
    const showPortals = open && sharedSheet.isActiveSheet(onOpenChange)
    const bodyTarget = showPortals ? sharedSheet.bodyPortalRef.current : null
    const footerTarget = showPortals ? sharedSheet.footerPortalRef.current : null
    // portalRevision keeps this render in sync after the drawer mounts its targets.
    void sharedSheet.portalRevision

    return (
      <>
        {triggerButton}
        {liveRegion}
        {showPortals && bodyTarget ? createPortal(children, bodyTarget) : null}
        {showPortals && footerTarget && footer ? createPortal(footer, footerTarget) : null}
      </>
    )
  }

  if (variant === 'sheet') {
    return (
      <>
        {triggerButton}
        {liveRegion}
        {open || everOpened ? (
          <Drawer open={open} onOpenChange={onOpenChange}>
            {open ? (
              <DrawerContent initialFocus={titleRef}>
                <DrawerHeader>
                  <DrawerTitle ref={titleRef} tabIndex={-1} className="outline-none">
                    {title}
                  </DrawerTitle>
                  {description ? <DrawerDescription>{description}</DrawerDescription> : null}
                </DrawerHeader>
                <div
                  className={cn(
                    'flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-2',
                    sheetBodyClassName,
                  )}
                >
                  {children}
                </div>
                <DrawerFooter>
                  {footer ?? <DrawerCloseButton>Fechar</DrawerCloseButton>}
                </DrawerFooter>
              </DrawerContent>
            ) : null}
          </Drawer>
        ) : null}
      </>
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <CampaignHoverTooltip
          content={tooltipContent}
          align={align}
          openOnTouch={false}
          disabled={open}
        >
          <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        </CampaignHoverTooltip>
        <PopoverContent
          align={align}
          sideOffset={8}
          className={contentClassName}
          // Radix gives the popover `role="dialog"` and no name; the Drawer's
          // title is the same sentence, so it serves as one here too.
          aria-label={title}
          onOpenAutoFocus={preventPopoverAutoFocus ? (event) => event.preventDefault() : undefined}
        >
          {children}
        </PopoverContent>
      </Popover>
      {liveRegion}
    </>
  )
}
