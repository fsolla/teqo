'use client'

import { CampaignArticleCard, type CampaignArticleCardData } from '@/components/CampaignArticleCard'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

const PROGRAMMATIC_SCROLL_LOCK_MS = 700

type CampaignContentCarouselProps = {
  ariaLabel: string
  items: CampaignArticleCardData[]
}

/**
 * Mobile-only carousel for the campaign home content section: one card per
 * screen with snap scrolling, page dots and a "N de M" readout. Deliberately
 * not a variant of `CampaignCarousel` — that module is pinned to the Penpot
 * auto-advancing geometry of the problem/flags sections.
 */
export const CampaignContentCarousel = ({ ariaLabel, items }: CampaignContentCarouselProps) => {
  const trackRef = useRef<HTMLOListElement>(null)
  const isProgrammaticScrollRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const releaseProgrammaticScroll = useCallback(() => {
    isProgrammaticScrollRef.current = false
  }, [])

  useEffect(() => releaseProgrammaticScroll, [releaseProgrammaticScroll])

  const scrollToItem = useCallback(
    (index: number) => {
      const track = trackRef.current
      const target = track?.querySelector<HTMLElement>(`[data-carousel-index="${index}"]`)
      if (!track || !target) return

      isProgrammaticScrollRef.current = true
      setActiveIndex(index)
      track.scrollTo({ left: target.offsetLeft - track.offsetLeft })
      window.setTimeout(releaseProgrammaticScroll, PROGRAMMATIC_SCROLL_LOCK_MS)
    },
    [releaseProgrammaticScroll],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = activeIndex + (event.key === 'ArrowRight' ? 1 : -1)
    scrollToItem(Math.max(0, Math.min(items.length - 1, next)))
  }

  const syncActiveItem = useCallback(() => {
    const track = trackRef.current
    if (!track || isProgrammaticScrollRef.current) return

    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-carousel-index]'))
    let nearestIndex = activeIndex
    let nearestDistance = Number.POSITIVE_INFINITY

    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft - track.offsetLeft - track.scrollLeft)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    if (nearestIndex !== activeIndex) setActiveIndex(nearestIndex)
  }, [activeIndex])

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carrossel"
      data-carousel="contents"
      onPointerDown={releaseProgrammaticScroll}
      onFocusCapture={releaseProgrammaticScroll}
      className="relative focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
    >
      <ol
        ref={trackRef}
        onScroll={syncActiveItem}
        onKeyDown={handleKeyDown}
        tabIndex={items.length > 1 ? 0 : undefined}
        data-carousel-track
        className="scrollbar-hide m-0 flex list-none snap-x snap-mandatory overflow-x-auto scroll-smooth p-0 motion-reduce:scroll-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            data-carousel-index={index}
            aria-label={`${index + 1} de ${items.length}`}
            aria-current={index === activeIndex ? 'true' : undefined}
            aria-hidden={index !== activeIndex || undefined}
            inert={index !== activeIndex || undefined}
            className="m-0 w-full shrink-0 snap-start"
          >
            <CampaignArticleCard card={item} />
          </li>
        ))}
      </ol>

      {items.length > 1 ? (
        <>
          <div className="mt-3 flex items-center justify-center gap-2">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Ir para o conteúdo ${index + 1} de ${items.length}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => scrollToItem(index)}
                className={`h-2 w-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none ${
                  index === activeIndex
                    ? 'bg-(--pt-red)'
                    : 'bg-(--campaign-muted) hover:bg-[#4f4744]'
                }`}
              />
            ))}
          </div>
          <p
            aria-live="polite"
            className="mt-2 text-center text-xs font-semibold text-(--campaign-muted)"
          >
            {activeIndex + 1} de {items.length} · deslize para ver os próximos
          </p>
        </>
      ) : null}
    </div>
  )
}
