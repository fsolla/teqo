'use client'

import { useRef, useState } from 'react'

/** While a dot click animates the track, the scroll listener must not fight it. */
const PROGRAMMATIC_SCROLL_LOCK_MS = 700

import { CardModelTile } from '@/components/cards/CardModelTile'
import { CARD_MODELS, type CardModel, type CardModelId } from '@/lib/cardModels'

type CardModelGalleryProps = {
  ariaLabel: string
  fontFamily: string
  selectedId?: CardModelId | null
  onSelect: (id: CardModelId) => void
}

const tileClassName =
  'group flex h-full w-full flex-col rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:ring-offset-(--campaign-cream)'

/**
 * S14/S15/S30 — the five models side by side on desktop (a single row) and a
 * one-item-with-peek snap track on mobile, as buttons for the studio island:
 * selecting a tile opens the single composer in place (home or `/cards`). Both
 * tracks come from the same catalog (S13); the mobile track carries the five
 * page dots of the design gate (scene 2), following the scroll position.
 */
export const CardModelGallery = ({
  ariaLabel,
  fontFamily,
  selectedId = null,
  onSelect,
}: CardModelGalleryProps) => {
  const trackRef = useRef<HTMLUListElement>(null)
  const isProgrammaticScrollRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const syncActiveItem = () => {
    const track = trackRef.current
    if (!track || isProgrammaticScrollRef.current) return

    const items = Array.from(track.querySelectorAll<HTMLLIElement>('li'))
    const center = track.scrollLeft + track.clientWidth / 2
    let nearestIndex = activeIndex
    let nearestDistance = Number.POSITIVE_INFINITY

    items.forEach((item, index) => {
      const distance = Math.abs(item.offsetLeft - track.offsetLeft + item.offsetWidth / 2 - center)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    if (nearestIndex !== activeIndex) setActiveIndex(nearestIndex)
  }

  const scrollToModel = (index: number) => {
    const track = trackRef.current
    const target = track?.querySelector<HTMLElement>(`li:nth-child(${index + 1})`)
    if (!track || !target) return

    isProgrammaticScrollRef.current = true
    setActiveIndex(index)
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: 'smooth' })
    window.setTimeout(() => {
      isProgrammaticScrollRef.current = false
    }, PROGRAMMATIC_SCROLL_LOCK_MS)
  }

  const renderItem = (model: CardModel) => {
    const selected = selectedId === model.id

    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={model.label}
        data-card-model-tile={model.id}
        onClick={() => onSelect(model.id)}
        className={tileClassName}
      >
        <CardModelTile model={model} fontFamily={fontFamily} selected={selected} />
        <span
          className={`mt-auto block pt-3 text-center text-sm font-bold sm:text-base ${
            model.badge && !selected ? 'text-(--pt-red)' : 'text-(--campaign-ink)'
          }`}
        >
          {model.label}
        </span>
      </button>
    )
  }

  return (
    <div className="mt-8">
      <ul
        aria-label={`${ariaLabel} (desktop)`}
        className="m-0 hidden list-none grid-cols-5 gap-5 p-0 sm:gap-6 lg:grid lg:gap-4"
      >
        {CARD_MODELS.map((model) => (
          <li key={model.id} className="m-0">
            {renderItem(model)}
          </li>
        ))}
      </ul>

      <ul
        ref={trackRef}
        aria-label={`${ariaLabel} (mobile)`}
        onScroll={syncActiveItem}
        className="scrollbar-hide m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 p-0 pb-2 lg:hidden"
      >
        {CARD_MODELS.map((model) => (
          <li key={model.id} className="m-0 flex w-[78%] shrink-0 snap-start sm:w-[58%]">
            {renderItem(model)}
          </li>
        ))}
      </ul>

      <p className="mt-1 text-center text-xs font-semibold text-(--campaign-muted) lg:hidden">
        Deslize para ver os cinco modelos
      </p>

      {/* The visual dot of the gate sits inside a 24px target (WCAG 2.5.8 AA). */}
      <div className="mt-1 flex items-center justify-center lg:hidden">
        {CARD_MODELS.map((model, index) => (
          <button
            key={model.id}
            type="button"
            aria-label={`Ir para o modelo ${index + 1} de ${CARD_MODELS.length}`}
            aria-current={index === activeIndex ? 'true' : undefined}
            onClick={() => scrollToModel(index)}
            className="inline-flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className={`block rounded-full transition-colors ${
                index === activeIndex ? 'h-1.5 w-6 bg-(--pt-red)' : 'size-1.5 bg-(--campaign-muted)'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
