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
}: {
  actions?: readonly (CampaignHomeActionButtonProps & { id?: string })[]
  ariaLabel?: string
  className?: string
}) => {
  const isCoarsePointer = useCoarsePointer()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragSession | null>(null)
  const suppressClickRef = useRef(false)

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
      if (typeof el.setPointerCapture === 'function') {
        el.setPointerCapture(event.pointerId)
      }
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

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={scrollerRef}
        aria-label={ariaLabel}
        className={cn(
          'min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'pointer-fine:cursor-grab pointer-fine:data-[dragging=true]:cursor-grabbing pointer-fine:data-[dragging=true]:select-none',
          className,
        )}
        {...finePointerPanProps}
      >
        <ul
          role="list"
          className="m-0 flex min-w-max list-none snap-x snap-proximity gap-4 p-0 pb-1"
        >
          {actions?.map(({ id, ...button }) => (
            <li key={id ?? button.href ?? button.label} className="m-0 list-none p-0">
              <CampaignHomeActionButton {...button} />
            </li>
          ))}
        </ul>
      </div>
    </TooltipProvider>
  )
}
