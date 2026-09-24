'use client'

import { useState } from 'react'

import {
  contentPieceMediaKind,
  isCardCatalogItem,
  type ContentCatalogItem,
  type ContentPiecePublicItem,
} from '@/lib/contentPieceCatalog'

import { ContentCatalogCardItem } from './ContentCatalogCardItem'
import { ContentPieceCard } from './ContentPieceCard'
import { ContentPieceShareSheet } from './ContentPieceShareSheet'

/**
 * S27 — the catalogue board (artefato: cena 01): full cards for video, audio
 * and link pieces, compact rows for photo/text, one piece plays at a time
 * (switching unmounts the previous element) and the share sheet is owned here,
 * so every card opens the same vote message.
 *
 * S38 — the six card models are items of the same board: they take the full-card
 * bucket and the whole item is one link to the studio (`/cards?model=<id>`); the
 * old single invite tile is gone and no section groups them.
 */
export const ContentPieceCatalog = ({
  items,
  themeMode,
}: {
  items: readonly ContentCatalogItem[]
  /** S28 — the board is in the theme mode: the pieces state their provenance. */
  themeMode: boolean
}) => {
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [sharingItem, setSharingItem] = useState<ContentPiecePublicItem | null>(null)

  const largeItems: ContentCatalogItem[] = []
  const compactItems: ContentPiecePublicItem[] = []
  for (const item of items) {
    if (isCardCatalogItem(item)) {
      largeItems.push(item)
      continue
    }
    const kind = contentPieceMediaKind(item)
    if (kind === null || kind === 'video' || kind === 'audio') largeItems.push(item)
    else compactItems.push(item)
  }

  const cardProps = (item: ContentPiecePublicItem) => ({
    item,
    playing: playingId === item.id,
    onToggle: () => setPlayingId((current) => (current === item.id ? null : item.id)),
    onEnded: () => setPlayingId((current) => (current === item.id ? null : current)),
    onShare: setSharingItem,
    themeMode,
  })

  return (
    <>
      {largeItems.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {largeItems.map((item) =>
            isCardCatalogItem(item) ? (
              <ContentCatalogCardItem key={`card:${item.modelId}`} item={item} />
            ) : (
              <ContentPieceCard key={item.id} {...cardProps(item)} />
            ),
          )}
        </div>
      ) : null}

      {compactItems.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {compactItems.map((item) => (
            <ContentPieceCard key={item.id} {...cardProps(item)} />
          ))}
        </div>
      ) : null}

      {sharingItem ? (
        <ContentPieceShareSheet item={sharingItem} onClose={() => setSharingItem(null)} />
      ) : null}
    </>
  )
}
