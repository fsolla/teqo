'use client'

import { useState } from 'react'

import type { ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

import { ContentPieceDownloadLink, ContentPieceShareButton } from './ContentPieceActions'
import { ContentPieceMedia } from './ContentPieceMedia'
import { ContentPieceShareSheet } from './ContentPieceShareSheet'
import { CONTENT_PIECE_TAG } from './contentPieceClasses'

type Fact = { label: string; value: string }

const originOrDurationFact = (item: ContentPiecePublicItem): Fact | null => {
  if (item.isLink) return { label: 'Origem', value: item.originLabel }
  if (item.durationLabel) return { label: 'Duração', value: item.durationLabel }
  return null
}

/**
 * S27 — the piece page body (artefato: cenas 04/07): the asset on the left
 * (play on demand, photo preview, platform placeholder for a link piece), the
 * title/description/facts and the same two actions of the card. The share
 * sheet is the same component, so the message is identical everywhere.
 */
export const ContentPieceDetail = ({ item }: { item: ContentPiecePublicItem }) => {
  const [playing, setPlaying] = useState(false)
  const [sharing, setSharing] = useState(false)

  const facts = [
    item.topicLabels.length > 0 ? { label: 'Tema', value: item.topicLabels.join(', ') } : null,
    item.cityLabel || item.regionLabel
      ? { label: 'Local', value: item.cityLabel ?? item.regionLabel ?? '' }
      : null,
    originOrDurationFact(item),
    item.pieceDateLabel ? { label: 'Data', value: item.pieceDateLabel } : null,
  ].filter((fact): fact is Fact => fact !== null)

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:gap-10">
        <ContentPieceMedia
          item={item}
          playing={playing}
          onToggle={() => setPlaying((current) => !current)}
          onEnded={() => setPlaying(false)}
          variant="detail"
          className="aspect-video"
        />

        <div>
          <span className={CONTENT_PIECE_TAG}>
            {item.isLink ? item.originLabel : item.typeLabel}
          </span>
          <h1 className="mt-3 text-left font-[family-name:var(--font-exo2)] text-3xl leading-[1.05] font-black tracking-[-0.02em] text-balance">
            {item.title}
          </h1>
          {item.description ? (
            <p className="mt-3 text-sm leading-6 text-(--campaign-muted)">{item.description}</p>
          ) : null}

          {facts.length > 0 ? (
            <dl className="mt-5 border-y border-(--campaign-line) py-4 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="flex justify-between gap-4 py-1">
                  <dt className="text-(--campaign-muted)">{fact.label}</dt>
                  <dd className="text-right font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className={cn('mt-5 grid gap-2', item.file ? 'grid-cols-2' : 'grid-cols-1')}>
            <ContentPieceDownloadLink item={item} />
            <ContentPieceShareButton item={item} onShare={() => setSharing(true)} />
          </div>

          {item.isLink ? (
            <p className="mt-3 text-center text-xs leading-5 text-(--campaign-muted)">
              O compartilhamento usa o link da publicação no {item.originLabel}.
            </p>
          ) : null}
        </div>
      </div>

      {sharing ? <ContentPieceShareSheet item={item} onClose={() => setSharing(false)} /> : null}
    </>
  )
}
