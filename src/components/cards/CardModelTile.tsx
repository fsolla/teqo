import { CheckIcon, UserRoundIcon } from 'lucide-react'
import Image from 'next/image'

import { NAME_CARD_SLOT, type CardModel } from '@/lib/cardModels'
import { cn } from '@/lib/utils'

/**
 * S13 — artwork preview of one card model, shared by the home section and the
 * `/cards` gallery. The name tile reuses the empty master with an HTML
 * `SEU NOME` placeholder (the real name is only drawn by the canvas); the photo
 * tiles show the official transparent overlay above a neutral photo slot.
 */
export const CardModelTile = ({
  model,
  selected = false,
  priority = false,
}: {
  model: CardModel
  selected?: boolean
  priority?: boolean
}) => (
  <span
    className={cn(
      'relative block overflow-hidden rounded-xl border bg-(--campaign-band) transition duration-200',
      selected
        ? 'border-(--pt-red) ring-2 ring-(--pt-red)'
        : 'border-(--campaign-line) group-hover:-translate-y-0.5 group-hover:shadow-lg',
    )}
    style={{ aspectRatio: `${model.width} / ${model.height}`, containerType: 'inline-size' }}
  >
    {model.kind === 'photo' ? (
      <>
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(160deg,#ded8d2,#f7f3ef)]"
        />
        {model.photoWindow ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 flex items-center justify-center"
            style={{
              height: `${((model.photoWindow.y + model.photoWindow.height) / model.height) * 100}%`,
            }}
          >
            <UserRoundIcon className="h-[30%] w-auto text-(--campaign-muted) opacity-45" />
          </span>
        ) : null}
      </>
    ) : null}

    <Image
      src={model.assetSrc}
      alt=""
      fill
      priority={priority}
      sizes="(min-width: 1024px) 340px, 78vw"
      className="object-cover"
    />

    {model.kind === 'name' ? (
      <span
        aria-hidden="true"
        className="absolute -translate-x-1/2 font-[family-name:var(--font-exo2)] leading-none font-black tracking-[-0.02em]"
        style={{
          left: `${(NAME_CARD_SLOT.centerX / model.width) * 100}%`,
          top: `${(NAME_CARD_SLOT.capTop / model.height) * 100}%`,
          fontSize: '11.5cqw',
          color: NAME_CARD_SLOT.fill,
        }}
      >
        SEU NOME
      </span>
    ) : null}

    {selected ? (
      <span className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full bg-(--pt-red) text-white shadow-md">
        <CheckIcon className="size-4" aria-hidden="true" />
      </span>
    ) : null}
  </span>
)
