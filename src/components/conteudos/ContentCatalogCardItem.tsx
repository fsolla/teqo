import Image from 'next/image'
import Link from 'next/link'

import { sendCardOpeningEvent } from '@/lib/contentEvents'
import type { CardCatalogItem } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

import {
  CONTENT_PIECE_CARD,
  CONTENT_PIECE_FOCUS,
  CONTENT_PIECE_OUTLINE_BUTTON,
  CONTENT_PIECE_TAG,
} from './contentPieceClasses'

const CARD_TAG_LABEL = 'Card'

/**
 * S38 — the art of a model item (artefato: cenas 01–03): the model's real file
 * cropped from the top (the banners and the name line live there), or the
 * neutral dashed placeholder of the photo models, whose master is only the
 * frame with a transparent photo window. The `NOVO` badge of the newest model
 * sits on the art.
 */
const CardItemArt = ({ item }: { item: CardCatalogItem }) => (
  <span
    className={cn(
      'relative grid min-h-40 place-items-center overflow-hidden sm:aspect-video sm:min-h-0',
      item.art.kind === 'placeholder'
        ? 'bg-[linear-gradient(145deg,#eee9e5,#fff)]'
        : 'bg-[linear-gradient(145deg,#184e92,#0876ac)]',
    )}
  >
    {item.art.kind === 'placeholder' ? (
      <span
        aria-hidden="true"
        className={cn(
          'relative grid place-items-center border-2 border-dashed border-[#a21c1c]/40 text-3xl text-[#a21c1c]',
          item.art.shape === 'square' ? 'size-20 rounded-full' : 'h-24 w-16 rounded-lg',
        )}
      >
        ◎
      </span>
    ) : (
      <Image
        src={item.art.src}
        alt=""
        fill
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 128px"
        className="object-cover object-top"
      />
    )}

    {item.badge ? (
      <span className="absolute top-2 right-2 rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#184e92]">
        {item.badge}
      </span>
    ) : null}
  </span>
)

/**
 * S38 — one card model as an item of the board (artefato: cenas 01–05). The
 * whole item is a single link to the studio with the model chosen — a bigger
 * tap target on the phone and no second selection contract. It is NOT a piece:
 * no download, no share, no detail page; the item is an invite to `/cards`.
 * The click feeds the anonymous opening event of the model (C213/S32
 * mechanism), never a piece event.
 */
export const ContentCatalogCardItem = ({ item }: { item: CardCatalogItem }) => (
  <Link
    href={item.href}
    data-card-model={item.modelId}
    onClick={() => sendCardOpeningEvent(item.modelId)}
    className={cn(
      CONTENT_PIECE_CARD,
      'grid grid-cols-[128px_1fr] text-black no-underline sm:block',
      item.badge ? 'border-2 border-(--pt-red)' : null,
      CONTENT_PIECE_FOCUS,
    )}
  >
    <CardItemArt item={item} />

    <div className="p-4">
      <span className={CONTENT_PIECE_TAG}>{CARD_TAG_LABEL}</span>
      <h3 className="mt-2 font-[family-name:var(--font-exo2)] text-sm font-extrabold sm:text-base">
        {item.title}
      </h3>
      <p className="mt-1 text-xs text-(--campaign-muted)">{item.description}</p>
      {item.aliases.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex rounded-full border border-black/10 bg-white px-[7px] py-[3px] text-[10px] font-bold text-(--campaign-muted)"
            >
              {alias}
            </span>
          ))}
        </div>
      ) : null}
      <span className={cn(CONTENT_PIECE_OUTLINE_BUTTON, 'mt-4 hidden w-full sm:inline-flex')}>
        Escolher este modelo →
      </span>
      <span className="mt-3 block text-xs font-bold text-(--pt-red) sm:hidden">Escolher →</span>
    </div>
  </Link>
)
