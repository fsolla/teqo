'use client'

import { useState } from 'react'

import { contentPieceMediaKind, type ContentPiecePublicItem } from '@/lib/contentPieceCatalog'

import { ContentPieceCard } from './ContentPieceCard'
import { ContentPieceCardInvite } from './ContentPieceCardInvite'
import { ContentPieceShareSheet } from './ContentPieceShareSheet'

/**
 * S27 — the catalogue board (artefato: cena 01): full cards for video, audio
 * and link pieces, compact rows for photo/text, the card invite when nothing
 * is filtered. One piece plays at a time (switching unmounts the previous
 * element) and the share sheet is owned here, so every card opens the same
 * vote message.
 */
export const ContentPieceCatalog = ({
  items,
  showCardInvite,
}: {
  items: readonly ContentPiecePublicItem[]
  showCardInvite: boolean
}) => {
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [sharingItem, setSharingItem] = useState<ContentPiecePublicItem | null>(null)

  const largeItems: ContentPiecePublicItem[] = []
  const compactItems: ContentPiecePublicItem[] = []
  for (const item of items) {
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
  })

  return (
    <>
      {largeItems.length > 0 || showCardInvite ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {largeItems.map((item) => (
            <ContentPieceCard key={item.id} {...cardProps(item)} />
          ))}
          {showCardInvite ? <ContentPieceCardInvite /> : null}
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
