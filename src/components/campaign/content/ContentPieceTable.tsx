import { FilmIcon, ImageIcon, LinkIcon, MicIcon, TypeIcon } from 'lucide-react'
import Link from 'next/link'

import { ContentPieceRetryButton } from '@/components/campaign/content/ContentPieceRetryButton'
import {
  ContentPieceProcessingBadge,
  ContentPiecePublicationBadge,
} from '@/components/campaign/content/ContentPieceStatusBadge'
import { CampaignTable, CampaignTableHead } from '@/components/campaign/shared/CampaignTable'
import { Button } from '@/components/ui/button'
import type { CampaignColumnVisibility } from '@/lib/campaignColumnVisibility'
import {
  contentPieceStepLabels,
  type ContentPieceType,
  type ContentPieceViewModel,
} from '@/lib/contentPiece'

const TYPE_ICON: Record<ContentPieceType, typeof FilmIcon> = {
  video: FilmIcon,
  foto: ImageIcon,
  texto: TypeIcon,
  audio: MicIcon,
  card: ImageIcon,
}

const metaLine = (piece: ContentPieceViewModel): string =>
  [piece.typeLabel, piece.cityLabel ?? piece.regionLabel, piece.durationLabel]
    .filter((value): value is string => Boolean(value))
    .join(' · ')

/**
 * C211 — one piece of the Central list (approved design scene 1): thumbnail,
 * title and the type/city/duration line, the honest processing state, the
 * publication state and one action ("Abrir" or "Reprocessar" when it failed).
 */
export const ContentPieceTable = ({
  rows,
  columnVisibility,
  empty,
}: {
  rows: readonly ContentPieceViewModel[]
  columnVisibility?: CampaignColumnVisibility
  empty?: React.ReactNode
}) => (
  <CampaignTable
    className="hidden md:block"
    caption="Uma linha por peça da Central de Conteúdos. Rascunhos não aparecem na Central pública."
    columnVisibility={columnVisibility}
    rows={rows}
    rowKey={(row) => row.id}
    empty={empty}
    columns={[
      {
        id: 'piece',
        label: 'Peça',
        mandatory: true,
        head: <CampaignTableHead>Peça</CampaignTableHead>,
        cell: (piece) => {
          const Icon = TYPE_ICON[piece.type]
          return (
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-20 shrink-0 place-items-center rounded-md bg-gradient-to-br from-stone-200 to-stone-100 text-stone-500">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Link href={piece.detailHref} className="font-semibold hover:underline">
                  {piece.title}
                </Link>
                <p className="mt-1 truncate text-xs text-muted-foreground">{metaLine(piece)}</p>
                {piece.origin !== 'arquivo' ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <LinkIcon className="size-3" aria-hidden="true" />
                    {piece.originLabel}
                  </p>
                ) : null}
              </div>
            </div>
          )
        },
      },
      {
        id: 'processing',
        label: 'Processamento',
        cell: (piece) => (
          <div>
            <ContentPieceProcessingBadge status={piece.processingStatus} />
            {piece.processingStatus === 'processando' ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {piece.step ? contentPieceStepLabels[piece.step] : 'Processando…'}
              </p>
            ) : piece.processingStatus === 'falhou' && piece.failureMessage ? (
              <p className="mt-1 max-w-56 text-xs text-red-800">{piece.failureMessage}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'publication',
        label: 'Publicação',
        cell: (piece) => <ContentPiecePublicationBadge status={piece.status} />,
      },
      {
        id: 'action',
        label: 'Próxima ação',
        mandatory: true,
        head: <CampaignTableHead align="right">Próxima ação</CampaignTableHead>,
        cellClassName: 'text-right',
        cell: (piece) =>
          piece.canRetry ? (
            <ContentPieceRetryButton
              contentPieceId={piece.id}
              label="Reprocessar"
              className="inline-block"
            />
          ) : (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={piece.detailHref}>Abrir</Link>
            </Button>
          ),
      },
    ]}
  />
)
