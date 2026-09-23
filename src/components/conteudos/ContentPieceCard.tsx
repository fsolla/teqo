import Link from 'next/link'

import { contentPieceMediaKind, type ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

import { ContentPieceDownloadLink, ContentPieceShareButton } from './ContentPieceActions'
import { ContentPieceMedia } from './ContentPieceMedia'
import {
  CONTENT_PIECE_CARD,
  CONTENT_PIECE_EXACT_TAG,
  CONTENT_PIECE_TAG,
} from './contentPieceClasses'

type ContentPieceCardProps = {
  item: ContentPiecePublicItem
  playing: boolean
  onToggle: () => void
  onEnded: () => void
  onShare: (item: ContentPiecePublicItem) => void
  /** S28 — the board is in the theme mode: the badge states the provenance. */
  themeMode: boolean
}

/**
 * S28 — the badge of a result. In the literal search it stays the editorial
 * tag; in the theme mode it states where the result came from: "✦ Tema" when an
 * expanded term surfaced the piece, "Termo exato" when only the query did
 * (never an invented theme).
 */
const CardTag = ({ item, themeMode }: { item: ContentPiecePublicItem; themeMode: boolean }) => {
  if (themeMode) {
    return item.themeMatch ? (
      <span className={CONTENT_PIECE_TAG}>✦ Tema</span>
    ) : (
      <span className={CONTENT_PIECE_EXACT_TAG}>Termo exato</span>
    )
  }

  return (
    <span className={CONTENT_PIECE_TAG}>{item.isLink ? item.originLabel : item.typeLabel}</span>
  )
}

const EVIDENCE_MARK = 'rounded-[3px] bg-[#fff09a] px-0.5 font-extrabold text-black'

/**
 * S28 — "Por que apareceu" (artefato: cenas 05/06): the real passage that
 * carries the expanded term, quoted and highlighted. When the match came from
 * another part of the haystack the block falls back to a real passage of the
 * piece — no quotes, no highlight, with the origin label — and never invents a
 * match or a score.
 */
const CardThemeEvidence = ({ item }: { item: ContentPiecePublicItem }) => {
  const evidence = item.themeMatch?.evidence
  if (!evidence || evidence.parts.length === 0) return null

  const originLabel =
    evidence.source === 'description' ? 'Descrição da peça' : 'Transcrição da peça'

  return (
    <div className="mt-3 rounded-lg bg-[#f5f5f4] p-3">
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-xs">Por que apareceu</b>
        {evidence.quoted ? null : (
          <span className="text-[11px] font-bold text-(--campaign-muted)">{originLabel}</span>
        )}
      </div>
      <p className="mt-1 text-sm leading-6">
        {evidence.quoted ? `“${evidence.truncatedStart ? '… ' : ''}` : null}
        {evidence.parts.map((part, index) =>
          part.highlighted ? (
            <mark key={index} className={EVIDENCE_MARK}>
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
        {evidence.quoted ? `${evidence.truncatedEnd ? ' …' : ''}”` : null}
      </p>
    </div>
  )
}

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
 * S27/S28 — one catalogue card (artefato: cenas 01/02/05–07): video/audio/card
 * and link pieces take the full card with the asset on top; a photo/text is the
 * compact horizontal row. Actions work from the card itself — download never
 * needs the piece page.
 */
export const ContentPieceCard = ({
  item,
  playing,
  onToggle,
  onEnded,
  onShare,
  themeMode,
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
          <CardTag item={item} themeMode={themeMode} />
          <CardTitle item={item} className="text-sm" />
          <CardMeta item={item} />
          <CardThemeEvidence item={item} />
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
        <CardTag item={item} themeMode={themeMode} />
        <CardTitle item={item} className="text-base" />
        <CardMeta item={item} />
        <CardThemeEvidence item={item} />
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
