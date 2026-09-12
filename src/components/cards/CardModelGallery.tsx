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
 * S14 — the three models side by side on desktop and a one-item-with-peek snap
 * track on mobile, as buttons for the studio island: selecting a tile opens the
 * single composer in place (home or `/cards`). Both tracks come from the same
 * catalog (S13).
 */
export const CardModelGallery = ({
  ariaLabel,
  fontFamily,
  selectedId = null,
  onSelect,
}: CardModelGalleryProps) => {
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
        <span className="mt-auto block pt-3 text-center text-sm font-bold text-(--campaign-ink) sm:text-base">
          {model.label}
        </span>
      </button>
    )
  }

  return (
    <div className="mt-8">
      <ul
        aria-label={`${ariaLabel} (desktop)`}
        className="m-0 hidden list-none grid-cols-3 gap-5 p-0 sm:gap-6 lg:grid"
      >
        {CARD_MODELS.map((model) => (
          <li key={model.id} className="m-0">
            {renderItem(model)}
          </li>
        ))}
      </ul>

      <ul
        aria-label={`${ariaLabel} (mobile)`}
        className="scrollbar-hide m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 p-0 pb-2 lg:hidden"
      >
        {CARD_MODELS.map((model) => (
          <li key={model.id} className="m-0 flex w-[78%] shrink-0 snap-start sm:w-[58%]">
            {renderItem(model)}
          </li>
        ))}
      </ul>

      <p className="mt-1 text-center text-xs font-semibold text-(--campaign-muted) lg:hidden">
        Deslize para ver os três modelos
      </p>
    </div>
  )
}
