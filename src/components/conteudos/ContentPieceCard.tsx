import Link from 'next/link'

import { contentPieceMediaKind, type ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

import { ContentPieceDownloadLink, ContentPieceShareButton } from './ContentPieceActions'
import { ContentPieceMedia } from './ContentPieceMedia'
import { CONTENT_PIECE_CARD, CONTENT_PIECE_TAG } from './contentPieceClasses'

type ContentPieceCardProps = {
  item: ContentPiecePublicItem
  playing: boolean
  onToggle: () => void
  onEnded: () => void
  onShare: (item: ContentPiecePublicItem) => void
}

const CardTag = ({ item }: { item: ContentPiecePublicItem }) => (
  <span className={CONTENT_PIECE_TAG}>{item.isLink ? item.originLabel : item.typeLabel}</span>
)

const CardTitle = ({ item, className }: { item: ContentPiecePublicItem; className?: string }) => (
  <h3 className={cn('mt-2 font-[family-name:var(--font-exo2)] font-extrabold', className)}>
    <Link
      href={item.publicPath}
      className="rounded-sm text-black underline-offset-4 hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-(--pt-red)"
    >
      {item.title}
    </Link>
  </h3>
)

const CardMeta = ({ item }: { item: ContentPiecePublicItem }) =>
  item.metaLabel ? <p className="mt-1 text-xs text-(--campaign-muted)">{item.metaLabel}</p> : null

/**
 * S27 — one catalogue card (artefato: cenas 01/02/07): video/audio/card and
 * link pieces take the full card with the asset on top; a photo/text is the
 * compact horizontal row. Actions work from the card itself — download never
 * needs the piece page.
 */
export const ContentPieceCard = ({
  item,
  playing,
  onToggle,
  onEnded,
  onShare,
}: ContentPieceCardProps) => {
  const kind = contentPieceMediaKind(item)
  const isCompact = kind === 'image' || kind === 'text' || kind === 'other'

  if (isCompact) {
    return (
      <article
        data-content-piece={item.slug}
        data-state={playing ? 'playing' : 'stopped'}
        className={cn(CONTENT_PIECE_CARD, 'flex items-center gap-4 p-3')}
      >
        <ContentPieceMedia
          item={item}
          playing={playing}
          onToggle={onToggle}
          onEnded={onEnded}
          variant="thumb"
          className="h-24 w-32 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <CardTag item={item} />
          <CardTitle item={item} className="text-sm" />
          <CardMeta item={item} />
          <div className="mt-3 flex flex-wrap gap-2">
            <ContentPieceDownloadLink item={item} className="min-h-9 px-3" />
            <ContentPieceShareButton item={item} onShare={onShare} className="min-h-9 px-3" />
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      data-content-piece={item.slug}
      data-state={playing ? 'playing' : 'stopped'}
      className={CONTENT_PIECE_CARD}
    >
      <ContentPieceMedia
        item={item}
        playing={playing}
        onToggle={onToggle}
        onEnded={onEnded}
        className="aspect-video"
      />
      <div className="p-4">
        <CardTag item={item} />
        <CardTitle item={item} className="text-base" />
        <CardMeta item={item} />
        <div className={cn('mt-4 grid gap-2', item.file ? 'grid-cols-2' : 'grid-cols-1')}>
          <ContentPieceDownloadLink item={item} />
          <ContentPieceShareButton item={item} onShare={onShare} />
        </div>
        <Link
          href={item.publicPath}
          className="mt-3 block rounded-sm text-center text-xs font-bold text-(--pt-red) underline-offset-4 hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-(--pt-red) sm:hidden"
        >
          Ver detalhes da peça →
        </Link>
      </div>
    </article>
  )
}
