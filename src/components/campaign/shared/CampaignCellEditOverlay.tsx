'use client'

import { useRef, type ReactNode } from 'react'

import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

export type CampaignCellEditOverlayVariant = 'popover' | 'sheet'

/**
 * Shared so the triggers this container does NOT own — `MunicipalityListSignalControl`,
 * which wraps its own `<form>` — can't drift from the ones it does.
 * `relative` is load-bearing: see the comment where it is composed below.
 */
export const campaignCellEditTriggerClassName =
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
  tooltipContent,
  align = 'start',
  contentClassName,
  sheetBodyClassName,
  preventPopoverAutoFocus,
  children,
}: CampaignCellEditOverlayProps) => {
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

  if (variant === 'sheet') {
    return (
      <>
        {triggerButton}
        <Drawer open={open} onOpenChange={onOpenChange}>
          {/*
           * Focus lands on the title, never on the first field: base-ui's
           * default (first tabbable element) raises the virtual keyboard over
           * the sheet before it can be read, and every one of these sheets is
           * opened to look at a value at least as often as to type one. The
           * title is focusable only programmatically (`tabIndex={-1}`), so it
           * adds no stop to the tab order.
           */}
          <DrawerContent initialFocus={titleRef}>
            <DrawerHeader>
              <DrawerTitle ref={titleRef} tabIndex={-1} className="outline-none">
                {title}
              </DrawerTitle>
              {/* Guarded, not required: every sheet today names its row, but one
                  opened from under a heading that already does would pass none. */}
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
              <DrawerClose
                render={<Button type="button" variant="outline" className="min-h-11 w-full" />}
              >
                Fechar
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
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
  )
}
