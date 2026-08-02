'use client'

import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

import {
  CampaignHomeActionButton,
  type CampaignHomeActionButtonProps,
} from '@/components/campaign/dashboard/CampaignHomeActionButton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useCoarsePointer } from '@/lib/campaignCoarsePointer'
import { cn } from '@/lib/utils'

/** Horizontal pan threshold (px) — below this, child link/button clicks still fire. */
export const HOME_ACTION_STRIP_DRAG_THRESHOLD_PX = 8

export type CampaignHomeActionStripVariant = 'strip' | 'responsive'

type DragSession = {
  pointerId: number
  startX: number
  startScrollLeft: number
  dragging: boolean
}

const setScrollerDragging = (el: HTMLDivElement | null, dragging: boolean) => {
  if (!el) return
  if (dragging) {
    el.dataset.dragging = 'true'
  } else {
    delete el.dataset.dragging
  }
}

export const CampaignHomeActionStrip = ({
  actions,
  ariaLabel = 'Ações rápidas',
  className,
  variant = 'responsive',
}: {
  actions?: readonly (CampaignHomeActionButtonProps & { id?: string })[]
  ariaLabel?: string
  className?: string
  /** `responsive`: 2×3 grid on mobile, horizontal strip on md+. `strip`: always horizontal. */
  variant?: CampaignHomeActionStripVariant
}) => {
  const isCoarsePointer = useCoarsePointer()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragSession | null>(null)
  const suppressClickRef = useRef(false)
  const isStripLayout = variant === 'strip'

  const endDragSession = useCallback((pointerId: number) => {
    const session = dragRef.current
    if (!session || session.pointerId !== pointerId) return

    const el = scrollerRef.current
    if (el && typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId)
    }

    if (session.dragging) {
      suppressClickRef.current = true
    }

    setScrollerDragging(el, false)
    dragRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (isCoarsePointer || event.button !== 0) return

      const el = scrollerRef.current
      if (!el) return

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: el.scrollLeft,
        dragging: false,
      }
      suppressClickRef.current = false
    },
    [isCoarsePointer],
  )

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const el = scrollerRef.current
    if (!el) return

    const deltaX = event.clientX - session.startX

    if (!session.dragging) {
      if (Math.abs(deltaX) < HOME_ACTION_STRIP_DRAG_THRESHOLD_PX) return
      session.dragging = true
      setScrollerDragging(el, true)
      // Capture only once pan is confirmed — capturing on pointerdown retargets
      // pointerup to the scroller and child Links never receive the click (B67).
      if (typeof el.setPointerCapture === 'function') {
        el.setPointerCapture(event.pointerId)
      }
    }

    el.scrollLeft = session.startScrollLeft - deltaX
    event.preventDefault()
  }, [])

  const onPointerEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      endDragSession(event.pointerId)
    },
    [endDragSession],
  )

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }, [])

  const finePointerPanProps = isCoarsePointer
    ? {}
    : {
        onPointerDown,
        onPointerMove,
        onPointerUp: onPointerEnd,
        onPointerCancel: onPointerEnd,
        onClickCapture,
      }

  const listClassName = cn(
    'm-0 list-none p-0',
    isStripLayout
      ? 'flex min-w-max snap-x snap-proximity gap-0 px-4 pb-1 md:px-0'
      : 'grid grid-cols-2 gap-3 md:flex md:min-w-max md:snap-x md:snap-proximity md:gap-0 md:px-0 md:pb-1',
  )

  const scrollerClassName = cn(
    'min-w-0',
    isStripLayout
      ? 'overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pointer-fine:cursor-grab pointer-fine:data-[dragging=true]:cursor-grabbing pointer-fine:data-[dragging=true]:select-none'
      : 'md:overflow-x-auto md:overflow-y-hidden md:overscroll-x-contain md:[touch-action:pan-x] md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden md:pointer-fine:cursor-grab md:pointer-fine:data-[dragging=true]:cursor-grabbing md:pointer-fine:data-[dragging=true]:select-none',
    className,
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={scrollerRef}
        aria-label={ariaLabel}
        className={scrollerClassName}
        {...finePointerPanProps}
      >
        <ul role="list" className={listClassName}>
          {actions?.map(({ id, ...button }) => (
            <li key={id ?? button.href ?? button.label} className="m-0 list-none p-0">
              <CampaignHomeActionButton
                {...button}
                layout={isStripLayout ? 'strip' : 'responsive'}
              />
            </li>
          ))}
        </ul>
      </div>
    </TooltipProvider>
  )
}
