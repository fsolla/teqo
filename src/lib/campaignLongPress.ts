'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react'

export const CAMPAIGN_LONG_PRESS_MS = 450
const CAMPAIGN_LONG_PRESS_SLOP_PX = 10

export type CampaignLongPressPointerHandlers = {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerCancel: (event: PointerEvent) => void
  onClick: (event: MouseEvent) => void
}

export type CampaignLongPressResult = CampaignLongPressPointerHandlers & {
  /** True while the primary pointer is down (only when `enabled`). */
  pressing: boolean
}

/**
 * Long-press for coarse-pointer description drawers (B44). Short tap still
 * reaches `onClick`; the synthetic click after a long-press is suppressed.
 */
export const useCampaignLongPress = ({
  enabled,
  onLongPress,
  onClick,
}: {
  enabled: boolean
  onLongPress: () => void
  onClick?: (event: MouseEvent) => void
}): CampaignLongPressResult => {
  const [pressing, setPressing] = useState(false)
  const suppressClickRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const originRef = useRef<{ x: number; y: number } | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const releasePress = useCallback(() => {
    clearTimer()
    originRef.current = null
    setPressing(false)
  }, [clearTimer])

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (!enabled || event.button !== 0) return
      setPressing(true)
      originRef.current = { x: event.clientX, y: event.clientY }
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        originRef.current = null
        suppressClickRef.current = true
        onLongPress()
      }, CAMPAIGN_LONG_PRESS_MS)
    },
    [clearTimer, enabled, onLongPress],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!originRef.current || timerRef.current === null) return
      const dx = event.clientX - originRef.current.x
      const dy = event.clientY - originRef.current.y
      if (Math.hypot(dx, dy) > CAMPAIGN_LONG_PRESS_SLOP_PX) {
        clearTimer()
        originRef.current = null
      }
    },
    [clearTimer],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  const onClickHandler = useCallback(
    (event: MouseEvent) => {
      if (suppressClickRef.current) {
        event.preventDefault()
        event.stopPropagation()
        suppressClickRef.current = false
        return
      }
      onClick?.(event)
    },
    [onClick],
  )

  return useMemo(
    () => ({
      pressing: enabled && pressing,
      onPointerDown,
      onPointerMove,
      onPointerUp: releasePress,
      onPointerCancel: releasePress,
      onClick: onClickHandler,
    }),
    [enabled, onClickHandler, onPointerDown, onPointerMove, pressing, releasePress],
  )
}
