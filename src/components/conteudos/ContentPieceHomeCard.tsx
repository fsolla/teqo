import Link from 'next/link'

import type { ContentPieceHomeItem, ContentPieceHomeMatch } from '@/lib/contentPieceHomeSelection'
import { cn } from '@/lib/utils'

import { ContentPieceCardMeta, ContentPieceCardTitle } from './ContentPieceCardParts'
import { ContentPieceMedia } from './ContentPieceMedia'
import {
  CONTENT_PIECE_CARD,
  CONTENT_PIECE_FOCUS,
  CONTENT_PIECE_LOCAL_TAG,
  CONTENT_PIECE_TAG,
} from './contentPieceClasses'

const MATCH_LABELS: Record<ContentPieceHomeMatch, string> = {
  municipality: 'Do seu município',
  region: 'Da sua região',
  recent: 'Mais recente',
}

/**
 * S39 — the home sample card (artefato: cenas 01/02/05): a lighter sibling of
 * the catalogue card — no download/share actions, the piece page is the
 * handoff. Horizontal on the phone (`[124px | 1fr]`, cena 02) and vertical from
 * `sm` on; the asset is the shared `ContentPieceMedia`, so video/audio only
 * mount the media after the tap.
 */
export const ContentPieceHomeCard = ({
  item,
  match,
  playing,
  onToggle,
  onEnded,
}: {
  item: ContentPieceHomeItem
  match: ContentPieceHomeMatch
  playing: boolean
  onToggle: () => void
  onEnded: () => void
}) => (
  <article
    data-content-piece={item.slug}
    className={cn(CONTENT_PIECE_CARD, 'grid grid-cols-[124px_1fr] sm:block')}
  >
    <ContentPieceMedia
      item={item}
      playing={playing}
      onToggle={onToggle}
      onEnded={onEnded}
      // C226 — below `sm` this card's media slot is the 124px thumb of the
      // design's cena 05 (the compact play/duration, no marker); from `sm` up
      // the card becomes a full block and the media slot goes back to the
      // catalogue treatment.
      variant="home-thumb"
      className="aspect-video self-start"
    />
    <div className="p-4">
      <div className="flex flex-wrap gap-1">
        <span className={CONTENT_PIECE_TAG}>{item.isLink ? item.originLabel : item.typeLabel}</span>
        <span className={match === 'recent' ? CONTENT_PIECE_TAG : CONTENT_PIECE_LOCAL_TAG}>
          {MATCH_LABELS[match]}
        </span>
      </div>
      <ContentPieceCardTitle item={item} className="text-sm sm:text-base" />
      <ContentPieceCardMeta item={item} className="text-[11px] sm:text-xs" />
      <Link
        href={item.publicPath}
        className={cn(
          'mt-3 inline-block text-xs font-bold text-(--pt-red) underline-offset-4 hover:underline',
          CONTENT_PIECE_FOCUS,
        )}
      >
        Ver esta peça →
      </Link>
    </div>
  </article>
)
