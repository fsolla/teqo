'use client'

import type { PointerEvent, ReactElement, ReactNode, Ref } from 'react'
import { cloneElement, useEffect, useRef, useState } from 'react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Hover/focus explanation with no extra chrome — wraps an existing control,
 * heading or table cell. Shared by the campaign list system: column headers
 * (`MunicipalitySortableHead`), card metrics, and cell content via
 * `CampaignTable`'s `cellTooltip`. Radix's `TooltipTrigger` deliberately
 * ignores touch pointer events — no hover on touch, and a tap doesn't
 * reliably focus a non-form element either — which otherwise makes the whole
 * tooltip unreachable on phones (an `/impeccable critique` finding). The open state is controlled
 * so a `pointerType === 'touch'` tap can explicitly toggle it; mouse hover
 * and keyboard focus are untouched (Radix keeps driving `onOpenChange` for
 * those exactly as before), so a **mouse** click — which already hovered the
 * trigger on its way in — can't immediately re-close what hover just opened.
 *
 * Radix's Tooltip has no outside-tap dismiss layer (that's a Popover
 * feature), so once opened by touch it would otherwise stay open until the
 * page navigates. The `pointerdown`-outside listener below closes it —
 * tapping a *different* metric's trigger counts as "outside" too, which is
 * what keeps at most one of these tooltips open at a time. The content itself
 * counts as "inside": it may hold a link (E18's "Saiba mais"), and closing on
 * `pointerdown` would unmount that link before its click ever landed.
 */
type TappableElement = ReactElement<{
  onPointerUp?: (event: PointerEvent) => void
  ref?: Ref<HTMLElement>
}>

export const CampaignHoverTooltip = ({
  content,
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 4,
}: {
  content: ReactNode
  children: TappableElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const closeIfOutside = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'touch') return
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (contentRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', closeIfOutside)
    return () => document.removeEventListener('pointerdown', closeIfOutside)
  }, [open])

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node
    },
    onPointerUp: (event: PointerEvent) => {
      children.props.onPointerUp?.(event)
      if (event.pointerType === 'touch') setOpen((current) => !current)
    },
  })

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          ref={contentRef}
          side={side}
          align={align}
          sideOffset={sideOffset}
          className="max-w-xs text-left font-normal"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
