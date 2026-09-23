import Link from 'next/link'

import { ContentPieceCirculationCounters } from '@/components/campaign/content/ContentPieceCirculationCounters'
import { ContentPieceRetryButton } from '@/components/campaign/content/ContentPieceRetryButton'
import {
  ContentPieceProcessingBadge,
  ContentPiecePublicationBadge,
} from '@/components/campaign/content/ContentPieceStatusBadge'
import { Button } from '@/components/ui/button'
import { contentPieceStepLabels } from '@/lib/contentPiece'
import type { ContentPieceRowViewModel } from '@/lib/contentPieceCirculation'

/**
 * C211 — the Central list on mobile (approved design scenes 5): one card per
 * piece with the title + processing state, the type/publication line and the
 * single "Abrir" (or "Reprocessar" when it failed). C213 adds the piece's
 * circulation counters (2×2 grid) right above the action.
 */
export const ContentPieceCardList = ({
  rows,
  empty,
}: {
  rows: readonly ContentPieceRowViewModel[]
  empty?: React.ReactNode
}) => (
  <div className="flex flex-col gap-3 md:hidden">
    {rows.length === 0 && empty ? empty : null}
    {rows.map((piece) => (
      <article key={piece.id} className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={piece.detailHref} className="min-w-0 text-sm font-semibold hover:underline">
            {piece.title}
          </Link>
          <ContentPieceProcessingBadge status={piece.processingStatus} className="shrink-0" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ContentPiecePublicationBadge status={piece.status} />
          <span>
            {[piece.typeLabel, piece.durationLabel].filter(Boolean).join(' · ')}
            {piece.cityLabel ? ` · ${piece.cityLabel}` : ''}
          </span>
        </div>

        {piece.processingStatus === 'processando' ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {piece.step ? contentPieceStepLabels[piece.step] : 'Processando…'}
            </p>
          </>
        ) : piece.processingStatus === 'falhou' && piece.failureMessage ? (
          <p className="mt-2 text-xs text-red-800">{piece.failureMessage}</p>
        ) : null}

        <ContentPieceCirculationCounters
          circulation={piece.circulation}
          isPublished={piece.isPublished}
          layout="card"
        />

        {piece.canRetry ? (
          <ContentPieceRetryButton contentPieceId={piece.id} className="mt-3" />
        ) : (
          <Button asChild variant="outline" className="mt-3 min-h-11 w-full">
            <Link href={piece.detailHref}>Abrir</Link>
          </Button>
        )}
      </article>
    ))}
  </div>
)
