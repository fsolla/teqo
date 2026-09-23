import { CheckIcon, UserRoundIcon } from 'lucide-react'
import Image from 'next/image'

import { CardNameTileCanvas } from '@/components/cards/CardNameTileCanvas'
import type { CardModel } from '@/lib/cardModels'
import { cn } from '@/lib/utils'

/**
 * S13/S15 — artwork preview of one card model, shared by the home section and
 * the `/cards` gallery. The name tile reuses the empty master with a `SEU NOME`
 * preview drawn by the real composer pipeline (S14); the photo tiles show the
 * official transparent overlay above a neutral photo slot; the team tile shows
 * the filled example (`previewSrc`) with its `NOVO` badge.
 */
export const CardModelTile = ({
  model,
  fontFamily,
  selected = false,
}: {
  model: CardModel
  fontFamily: string
  selected?: boolean
}) => (
  <span
    className={cn(
      'relative block overflow-hidden rounded-xl border bg-(--campaign-band) transition duration-200',
      selected
        ? 'border-(--pt-red) ring-2 ring-(--pt-red)'
        : model.badge
          ? // S30 — the gate highlights the newest model even unselected.
            'border-2 border-(--pt-red) shadow-lg group-hover:-translate-y-0.5'
          : 'border-(--campaign-line) group-hover:-translate-y-0.5 group-hover:shadow-lg',
    )}
    style={{ aspectRatio: `${model.width} / ${model.height}` }}
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
      src={model.previewSrc ?? model.assetSrc}
      alt=""
      fill
      sizes="(min-width: 1024px) 200px, 78vw"
      className="object-cover"
    />

    {model.kind === 'name' ? <CardNameTileCanvas model={model} fontFamily={fontFamily} /> : null}

    {selected ? (
      <span className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full bg-(--pt-red) text-white shadow-md">
        <CheckIcon className="size-4" aria-hidden="true" />
      </span>
    ) : model.badge ? (
      <span className="absolute top-3 right-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black text-(--team-blue) shadow">
        {model.badge}
      </span>
    ) : null}
  </span>
)
