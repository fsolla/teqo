import Link from 'next/link'

import { buildContentPieceCatalogHref } from '@/lib/contentPieceCatalog'
import type { ContentPieceHomeItem, ContentPieceHomeMatch } from '@/lib/contentPieceHomeSelection'
import { slugify } from '@/lib/slug'
import { cn } from '@/lib/utils'

import { ContentPieceShareButton } from './ContentPieceActions'
import {
  ContentPieceCardMeta,
  ContentPieceCardTitle,
  ContentPieceTagChevron,
} from './ContentPieceCardParts'
import { ContentPieceMedia } from './ContentPieceMedia'
import {
  CONTENT_PIECE_CARD,
  CONTENT_PIECE_HOME_LOCAL_TAG,
  CONTENT_PIECE_HOME_TAG,
  CONTENT_PIECE_LOCAL_TAG_LINK,
  CONTENT_PIECE_PIECE_LINK,
  CONTENT_PIECE_TAG_LINK,
} from './contentPieceClasses'

const MATCH_LABELS: Record<ContentPieceHomeMatch, string> = {
  municipality: 'Do seu município',
  region: 'Da sua região',
  recent: 'Mais recente',
}

/**
 * S42 — the canonical facet of a tag, or null when the tag has no honest one
 * (origin and "Mais recente" stay static). The match only exists with its
 * label, so the null guard is a contract, never a rendered case.
 */
const matchHref = (item: ContentPieceHomeItem, match: ContentPieceHomeMatch): string | null => {
  if (match === 'municipality' && item.cityLabel) {
    return buildContentPieceCatalogHref({ cidade: slugify(item.cityLabel) })
  }
  if (match === 'region' && item.regionLabel) {
    return buildContentPieceCatalogHref({ regiao: slugify(item.regionLabel) })
  }
  return null
}

/**
 * S39/S42 — the home sample card (artefato: cenas 01/02/05): a lighter sibling
 * of the catalogue card. Horizontal on the phone (`[124px | 1fr]`, cena 02) and
 * vertical from `sm` on; the asset is the shared `ContentPieceMedia`, so
 * video/audio only mount the media after the tap. S42 gives it the direct
 * shortcut: `Compartilhar` opens the section's own share sheet (the S27 one)
 * and the honest tags open `/conteudos` already filtered.
 */
export const ContentPieceHomeCard = ({
  item,
  match,
  playing,
  onToggle,
  onEnded,
  onShare,
}: {
  item: ContentPieceHomeItem
  match: ContentPieceHomeMatch
  playing: boolean
  onToggle: () => void
  onEnded: () => void
  onShare: (item: ContentPieceHomeItem) => void
}) => {
  const typeHref = item.isLink ? null : buildContentPieceCatalogHref({ tipo: item.type })
  const matchFacetHref = matchHref(item, match)

  return (
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
      <div className="min-w-0 p-4">
        <div className="flex flex-wrap gap-1.5">
          {typeHref ? (
            <Link href={typeHref} className={CONTENT_PIECE_TAG_LINK}>
              {item.typeLabel}
              <ContentPieceTagChevron />
            </Link>
          ) : (
            <span className={CONTENT_PIECE_HOME_TAG}>
              {item.isLink ? item.originLabel : item.typeLabel}
            </span>
          )}
          {matchFacetHref ? (
            <Link href={matchFacetHref} className={CONTENT_PIECE_LOCAL_TAG_LINK}>
              <span className="truncate">{MATCH_LABELS[match]}</span>
              <ContentPieceTagChevron />
            </Link>
          ) : (
            <span
              className={match === 'recent' ? CONTENT_PIECE_HOME_TAG : CONTENT_PIECE_HOME_LOCAL_TAG}
            >
              {MATCH_LABELS[match]}
            </span>
          )}
        </div>
        <ContentPieceCardTitle item={item} className="text-sm sm:text-base" />
        <ContentPieceCardMeta item={item} className="text-[11px] sm:text-xs" />
        <ContentPieceShareButton item={item} onShare={onShare} className="mt-3 w-full sm:mt-4" />
        <Link href={item.publicPath} className={CONTENT_PIECE_PIECE_LINK}>
          Ver esta peça →
        </Link>
      </div>
    </article>
  )
}
