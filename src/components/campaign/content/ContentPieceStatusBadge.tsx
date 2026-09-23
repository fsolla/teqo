import {
  contentPieceProcessingStatusLabels,
  contentPieceStatusLabels,
  type ContentPieceProcessingStatus,
  type ContentPieceStatus,
} from '@/lib/contentPiece'
import { cn } from '@/lib/utils'

const PROCESSING_TONE: Record<ContentPieceProcessingStatus, string> = {
  processando: 'bg-amber-100 text-amber-900',
  pronto: 'bg-green-100 text-green-800',
  falhou: 'bg-red-100 text-red-700',
}

const PUBLICATION_TONE: Record<ContentPieceStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  publicado: 'bg-rose-50 text-rose-900 ring-1 ring-rose-200',
}

/** C211 — the one processing chip of the Central surfaces (list and ficha). */
export const ContentPieceProcessingBadge = ({
  status,
  className,
}: {
  status: ContentPieceProcessingStatus
  className?: string
}) => (
  <span
    className={cn(
      'inline-flex min-h-5 items-center rounded-full px-2 py-0.5 text-xs font-semibold',
      PROCESSING_TONE[status],
      className,
    )}
  >
    {contentPieceProcessingStatusLabels[status]}
  </span>
)

/** C211 — the publication chip: "Rascunho" is off the public Central. */
export const ContentPiecePublicationBadge = ({
  status,
  className,
}: {
  status: ContentPieceStatus
  className?: string
}) => (
  <span
    className={cn(
      'inline-flex min-h-5 items-center rounded-full px-2 py-0.5 text-xs font-semibold',
      PUBLICATION_TONE[status],
      className,
    )}
  >
    {contentPieceStatusLabels[status]}
  </span>
)
