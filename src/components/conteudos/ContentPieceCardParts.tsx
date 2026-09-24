import Link from 'next/link'

import type { ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

import { CONTENT_PIECE_FOCUS } from './contentPieceClasses'

/**
 * S27/S39 — the title and the metadata line shared by the catalogue card and
 * the home sample card. Both take the structural subset they read, so the
 * leaner home projection renders through the same markup (one owner for the
 * link, the focus ring and the meta contract).
 */

type ContentPieceCardTitleItem = Pick<ContentPiecePublicItem, 'title' | 'publicPath'>

export const ContentPieceCardTitle = ({
  item,
  className,
}: {
  item: ContentPieceCardTitleItem
  className?: string
}) => (
  <h3 className={cn('mt-2 font-[family-name:var(--font-exo2)] font-extrabold', className)}>
    <Link
      href={item.publicPath}
      className={cn(
        'rounded-sm text-black underline-offset-4 hover:underline',
        CONTENT_PIECE_FOCUS,
      )}
    >
      {item.title}
    </Link>
  </h3>
)

type ContentPieceCardMetaItem = Pick<ContentPiecePublicItem, 'metaLabel'>

export const ContentPieceCardMeta = ({
  item,
  className,
}: {
  item: ContentPieceCardMetaItem
  className?: string
}) =>
  item.metaLabel ? (
    <p className={cn('mt-1 text-xs text-(--campaign-muted)', className)}>{item.metaLabel}</p>
  ) : null
