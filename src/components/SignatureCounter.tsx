'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { getSignatureCount } from '@/app/(frontend)/actions/getSignatureCount'

const POLL_INTERVAL_MS = 10_000
const ANIMATION_DURATION_MS = 1200

export const SIGNATURE_CREATED_EVENT = 'signature:created'

export type SignatureCreatedDetail = { petitionId: string; count?: number }

const formatter = new Intl.NumberFormat('pt-BR')

const useAnimatedNumber = (target: number, durationMs = ANIMATION_DURATION_MS): number => {
  const [displayed, setDisplayed] = useState(target)
  const displayedRef = useRef(displayed)
  displayedRef.current = displayed

  useEffect(() => {
    const from = displayedRef.current
    if (from === target) return

    const start = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.round(from + (target - from) * eased)
      setDisplayed(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return displayed
}

interface SignatureCounterProps {
  petitionId: string
  initialCount: number
  variant?: 'hero' | 'card'
  className?: string
}

export const SignatureCounter = ({
  petitionId,
  initialCount,
  variant = 'card',
  className,
}: SignatureCounterProps) => {
  const [count, setCount] = useState(initialCount)
  const animated = useAnimatedNumber(count)
  const formatted = formatter.format(animated)

  const countRef = useRef(count)
  countRef.current = count

  useEffect(() => {
    let cancelled = false

    const refetch = async () => {
      try {
        const next = await getSignatureCount(petitionId)
        if (cancelled) return
        if (next > countRef.current) setCount(next)
      } catch {
        // transient failures are fine — next poll will retry
      }
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refetch()
    }, POLL_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const handleCreated = (event: Event) => {
      const detail = (event as CustomEvent<SignatureCreatedDetail>).detail
      if (detail?.petitionId !== petitionId) return
      if (typeof detail.count === 'number' && detail.count > countRef.current) {
        setCount(detail.count)
      } else {
        setCount((prev) => prev + 1)
      }
    }
    window.addEventListener(SIGNATURE_CREATED_EVENT, handleCreated)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener(SIGNATURE_CREATED_EVENT, handleCreated)
    }
  }, [petitionId])

  const isHero = variant === 'hero'

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'inline-flex items-center gap-3',
        isHero
          ? 'rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--petition-hero-foreground)] backdrop-blur-sm'
          : 'w-full rounded-xl border border-border bg-secondary/40 px-5 py-4 text-secondary-foreground',
        className,
      )}
    >
      <span className="relative flex size-2.5 shrink-0 items-center justify-center">
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-75',
            isHero ? 'bg-[var(--petition-hero-cta)]' : 'bg-primary',
          )}
        />
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            isHero ? 'bg-[var(--petition-hero-cta)]' : 'bg-primary',
          )}
        />
      </span>
      {isHero ? (
        <span className="leading-tight">
          <span className="font-bold tabular-nums">{formatted}</span>
          <span className="ml-1">pessoas já assinaram</span>
        </span>
      ) : (
        <span className="flex flex-col leading-tight">
          <span className="text-2xl font-bold tabular-nums sm:text-3xl">{formatted}</span>
          <span className="text-sm font-medium text-muted-foreground">
            pessoas já assinaram este abaixo-assinado
          </span>
        </span>
      )}
    </div>
  )
}
