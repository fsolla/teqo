import { CheckIcon, UserRoundIcon } from 'lucide-react'
import Image from 'next/image'

import { CardNameTileCanvas } from '@/components/cards/CardNameTileCanvas'
import type { CardModel } from '@/lib/cardModels'
import { cn } from '@/lib/utils'

/**
 * S13/S15/S31/S34 — artwork preview of one card model, shared by the home
 * section and the `/cards` gallery. The name tile reuses the empty master with a
 * `SEU NOME` preview drawn by the real composer pipeline (S14); the photo tiles
 * show the official transparent overlay above a neutral photo slot; the team
 * tiles show `previewSrc` (the filled example) and the colinha tile shows the
 * approved art itself (`assetSrc`, S34), with the `NOVO` badge.
 *
 * The box ratio comes from an in-flow spacer, never from `aspect-ratio` — see
 * the comment on the spacer for the WebKit bug that collapsed the tiles.
 */
export const CardModelTile = ({
  model,
  fontFamily,
  selected = false,
}: {
  model: CardModel
  fontFamily: string
  selected?: boolean
}) => {
  const ratio = model.height / model.width

  return (
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
    >
      {/*
        The tile height comes from this in-flow ratio spacer — a percentage
        padding resolved against the tile width — and NOT from `aspect-ratio`:
        WebKit loses the aspect-ratio height of a flex item on relayout
        (https://bugs.webkit.org/show_bug.cgi?id=265243, fixed only in WebKit
        main 2026-05), which collapsed the tiles to their labels on Orion/Safari.
        The spacer is engine-proof and keeps the master's exact ratio.
      */}
      <span
        aria-hidden="true"
        data-card-tile-ratio={ratio}
        className="block w-full"
        style={{ paddingBottom: `${(ratio * 100).toFixed(4)}%` }}
      />

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
        sizes="(min-width: 1024px) 167px, 78vw"
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
}
