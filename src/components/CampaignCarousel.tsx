'use client'

import { CampaignFlagCard } from '@/components/CampaignFlagCard'
import { CampaignProblemCard } from '@/components/CampaignProblemCard'
import { useCallback, useEffect, useRef, useState } from 'react'

const AUTO_ADVANCE_MS = 4_000
const PROGRAMMATIC_SCROLL_LOCK_MS = 700

export type CampaignCarouselItem = {
  id: string
  label?: string
  title: string
  body: string
  image?: string
  imageAlt?: string
  imageFrame?: {
    width: number
    height: number
    className: string
  }
}

type CampaignCarouselProps = {
  ariaLabel: string
  items: CampaignCarouselItem[]
  variant: 'problem' | 'flags'
}

export const CampaignCarousel = ({ ariaLabel, items, variant }: CampaignCarouselProps) => {
  const trackRef = useRef<HTMLOListElement>(null)
  const programmaticScrollTimerRef = useRef<number | null>(null)
  const isProgrammaticScrollRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isTouching, setIsTouching] = useState(false)

  const temporarilyPaused = isHovered || isFocused || isTouching

  const releaseProgrammaticScroll = useCallback(() => {
    isProgrammaticScrollRef.current = false
    if (programmaticScrollTimerRef.current !== null) {
      window.clearTimeout(programmaticScrollTimerRef.current)
      programmaticScrollTimerRef.current = null
    }
  }, [])

  useEffect(() => releaseProgrammaticScroll, [releaseProgrammaticScroll])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyPreference = () => setPrefersReducedMotion(media.matches)

    applyPreference()
    media.addEventListener('change', applyPreference)
    return () => media.removeEventListener('change', applyPreference)
  }, [])

  const scrollToItem = useCallback(
    (index: number) => {
      const track = trackRef.current
      const target = track?.querySelector<HTMLElement>(`[data-carousel-index="${index}"]`)
      if (!track || !target) return
      const startInset = Number.parseFloat(window.getComputedStyle(track).paddingLeft) || 0

      releaseProgrammaticScroll()
      isProgrammaticScrollRef.current = true
      setActiveIndex(index)
      track.scrollTo({
        left: target.offsetLeft - track.offsetLeft - startInset,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
      programmaticScrollTimerRef.current = window.setTimeout(
        releaseProgrammaticScroll,
        PROGRAMMATIC_SCROLL_LOCK_MS,
      )
    },
    [prefersReducedMotion, releaseProgrammaticScroll],
  )

  useEffect(() => {
    if (prefersReducedMotion || temporarilyPaused || items.length < 2) return
    // S6: on desktop the carousel lives inside an `lg:hidden` wrapper — its
    // auto-advance chain must not keep re-rendering a display:none subtree.
    if (trackRef.current && window.getComputedStyle(trackRef.current).display === 'none') return

    const timer = window.setTimeout(() => {
      scrollToItem((activeIndex + 1) % items.length)
    }, AUTO_ADVANCE_MS)

    return () => window.clearTimeout(timer)
  }, [activeIndex, items.length, prefersReducedMotion, scrollToItem, temporarilyPaused])

  const syncActiveItem = useCallback(() => {
    const track = trackRef.current
    if (!track || isProgrammaticScrollRef.current) return

    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-carousel-index]'))
    const startInset = Number.parseFloat(window.getComputedStyle(track).paddingLeft) || 0
    let nearestIndex = activeIndex
    let nearestDistance = Number.POSITIVE_INFINITY

    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft - track.offsetLeft - track.scrollLeft - startInset)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    if (nearestIndex !== activeIndex) setActiveIndex(nearestIndex)
  }, [activeIndex])

  const pauseOnTouch = () => {
    releaseProgrammaticScroll()
    setIsTouching(true)
  }
  const resumeAfterTouch = () => setIsTouching(false)

  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-roledescription="carrossel"
      data-carousel={variant}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={releaseProgrammaticScroll}
      onWheel={releaseProgrammaticScroll}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false)
      }}
      onTouchStart={pauseOnTouch}
      onTouchEnd={resumeAfterTouch}
      onTouchCancel={resumeAfterTouch}
      className="relative focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
    >
      {variant === 'flags' ? (
        <div className="relative h-6">
          <div
            aria-label="Escolher bandeira"
            data-carousel-chips
            className="scrollbar-hide absolute -top-2.5 right-0 left-0 flex h-11 items-center gap-1.5 overflow-x-auto pr-2"
          >
            {items.map((item, index) => {
              const isActive = index === activeIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => scrollToItem(index)}
                  className="campaign-action-feedback inline-flex min-h-11 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-arimo)] text-xs font-bold uppercase focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span
                    className={`inline-flex h-6 items-center rounded-full px-3 transition-colors ${
                      isActive
                        ? 'bg-(--pt-red) text-white'
                        : 'bg-[#dbdce0] text-[#66676b] hover:bg-[#cfd0d4]'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <ol
        ref={trackRef}
        aria-live={temporarilyPaused ? 'polite' : 'off'}
        onScroll={syncActiveItem}
        data-carousel-track
        className={`scrollbar-hide m-0 flex list-none snap-x snap-mandatory overflow-x-auto scroll-smooth p-0 ${
          variant === 'problem' ? 'gap-2.5' : 'mt-5 gap-2.5'
        }`}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            data-carousel-index={index}
            aria-label={`${index + 1} de ${items.length}`}
            aria-current={index === activeIndex ? 'true' : undefined}
            className={`m-0 shrink-0 snap-start ${
              variant === 'problem'
                ? 'h-[437px] w-[calc(100vw_-_38px)] max-w-[355px]'
                : 'h-[100px] w-[calc(100vw_-_66px)] max-w-[327px]'
            }`}
          >
            {variant === 'problem' ? (
              <CampaignProblemCard item={item} />
            ) : (
              <CampaignFlagCard item={item} />
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
