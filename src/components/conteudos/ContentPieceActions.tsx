import type { ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

import { CONTENT_PIECE_OUTLINE_BUTTON, CONTENT_PIECE_PRIMARY_BUTTON } from './contentPieceClasses'

/**
 * S27 — the two per-piece actions, single-owned (artefato: cenas 01/04/07): the
 * download is the SAME public file with the legible name (a link piece has no
 * file and renders no download), and share always opens the vote sheet.
 */

export const ContentPieceDownloadLink = ({
  item,
  className,
}: {
  item: ContentPiecePublicItem
  className?: string
}) =>
  item.file ? (
    <a
      href={`${item.file.path}?download=1`}
      download={item.file.downloadFilename}
      aria-label={`Baixar ${item.title}`}
      className={cn(CONTENT_PIECE_OUTLINE_BUTTON, className)}
    >
      Baixar
    </a>
  ) : null

export const ContentPieceShareButton = ({
  item,
  onShare,
  className,
}: {
  item: ContentPiecePublicItem
  onShare: (item: ContentPiecePublicItem) => void
  className?: string
}) => (
  <button
    type="button"
    onClick={() => onShare(item)}
    aria-label={`Compartilhar ${item.title}`}
    className={cn(CONTENT_PIECE_PRIMARY_BUTTON, className)}
  >
    Compartilhar
  </button>
)
