import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { searchContentPieceLeaderOptionsForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import { ContentPieceAttachFileButton } from '@/components/campaign/content/ContentPieceAttachFileButton'
import { ContentPieceCirculationPanel } from '@/components/campaign/content/ContentPieceCirculationPanel'
import { ContentPieceForm } from '@/components/campaign/content/ContentPieceForm'
import { ContentPiecePublicationButton } from '@/components/campaign/content/ContentPiecePublicationButton'
import { ContentPieceRetryButton } from '@/components/campaign/content/ContentPieceRetryButton'
import {
  ContentPieceProcessingBadge,
  ContentPiecePublicationBadge,
} from '@/components/campaign/content/ContentPieceStatusBadge'
import { ContentPieceStatusRefresher } from '@/components/campaign/content/ContentPieceStatusRefresher'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { CAMPAIGN_COMMUNICATION_CONTEUDOS } from '@/lib/campaignPaths'
import {
  CONTENT_PIECE_LINK_LABEL,
  contentPieceOriginLabels,
  contentPieceTopicLabel,
} from '@/lib/contentPiece'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  ContentPieceNotFoundError,
  loadContentPieceDetailPageData,
  loadContentPieceFormOptions,
} from '@/utilities/content/contentPiecePageData'

import { updateContentPieceFormAction } from '../formActions'

type ContentPieceDetailPageProps = {
  params: Promise<{ id: string }>
}

const notFoundPage = () => notFound()

/**
 * C211 — the ficha of one piece (approved design scene 4): preview, origin and
 * duration on the left; the editable catalogue and the kill switch on the
 * right. The transcript is editable and feeds the public search (S28).
 */
export default async function ContentPieceDetailPage({ params }: ContentPieceDetailPageProps) {
  const { id } = await params
  const contentPieceId = Number(id)
  if (!Number.isInteger(contentPieceId) || contentPieceId <= 0) notFoundPage()

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  const [data, options] = await Promise.all([
    loadContentPieceDetailPageData(payload, user, contentPieceId).catch((error) => {
      if (error instanceof ContentPieceNotFoundError) notFoundPage()
      throw error
    }),
    loadContentPieceFormOptions(payload),
  ])
  const { piece } = data

  // C220 — while the official extraction runs, the ficha shows the three
  // designed steps (scene 1): the link arrived, the official media is being
  // looked up (or was found), and the cataloguing follows.
  const mediaStepDone = piece.step !== null && piece.step !== 'extraindo'
  const processingSteps =
    piece.origin === 'instagram' && piece.processingStatus === 'processando' && !piece.hasFile
      ? [
          {
            label: '1. Link recebido',
            stateLabel: 'Concluído',
            className: 'rounded-lg border border-green-200 bg-green-50 p-3',
            stateClassName: 'text-green-800',
          },
          {
            label: '2. Mídia oficial',
            stateLabel: mediaStepDone ? 'Concluído' : 'Em andamento',
            className: mediaStepDone
              ? 'rounded-lg border border-green-200 bg-green-50 p-3'
              : 'rounded-lg border border-amber-200 bg-amber-50 p-3',
            stateClassName: mediaStepDone ? 'text-green-800' : 'text-amber-900',
          },
          {
            label: '3. Catalogação',
            stateLabel: mediaStepDone ? 'Em andamento' : 'Aguardando',
            className: mediaStepDone
              ? 'rounded-lg border border-amber-200 bg-amber-50 p-3'
              : 'rounded-lg border bg-muted p-3 text-muted-foreground',
            stateClassName: mediaStepDone ? 'text-amber-900' : '',
          },
        ]
      : null

  return (
    <CampaignPageShell aria-label="Peça da Central de Conteúdos">
      <SetCampaignPageChrome chrome={{ title: piece.title }} />
      <ContentPieceStatusRefresher
        pieces={[{ id: piece.id, processingStatus: piece.processingStatus }]}
      />

      <div className="mb-6">
        <Link
          href={CAMPAIGN_COMMUNICATION_CONTEUDOS}
          className="text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeftIcon className="mr-1 inline size-3.5" aria-hidden="true" />
          Conteúdos
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{piece.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ContentPieceProcessingBadge status={piece.processingStatus} />
              <ContentPiecePublicationBadge status={piece.status} />
            </div>
          </div>
          <ContentPiecePublicationButton contentPieceId={piece.id} status={piece.status} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:gap-8">
        <div>
          <div className="overflow-hidden rounded-xl border bg-stone-100">
            {piece.hasFile && piece.type === 'video' ? (
              <video
                src={piece.fileHref ?? undefined}
                controls
                preload="metadata"
                className="aspect-video w-full bg-black"
              />
            ) : piece.hasFile && piece.type === 'audio' ? (
              <div className="p-4">
                <audio
                  src={piece.fileHref ?? undefined}
                  controls
                  preload="metadata"
                  className="w-full"
                />
              </div>
            ) : piece.type === 'texto' ? (
              <div className="grid aspect-video place-items-center p-4 text-center text-xs font-semibold text-muted-foreground">
                Texto
              </div>
            ) : piece.hasFile && piece.fileHref ? (
              // eslint-disable-next-line @next/next/no-img-element -- private authenticated media proxy, not a static asset
              <img
                src={piece.fileHref}
                alt={piece.title}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="grid aspect-video place-items-center p-4 text-center text-xs font-semibold text-muted-foreground">
                {piece.origin === 'arquivo'
                  ? 'Sem arquivo'
                  : piece.processingStatus === 'processando'
                    ? 'Buscando a mídia no perfil oficial…'
                    : CONTENT_PIECE_LINK_LABEL}
              </div>
            )}
          </div>

          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Origem</dt>
              <dd className="text-right">{contentPieceOriginLabels[piece.origin]}</dd>
            </div>
            {piece.sourceUrl ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Link</dt>
                <dd className="min-w-0 text-right">
                  <a
                    href={piece.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-primary hover:underline"
                  >
                    {piece.sourceUrl}
                  </a>
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Duração</dt>
              <dd>{piece.durationLabel ?? '—'}</dd>
            </div>
            {piece.topics.length > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Temas</dt>
                <dd className="text-right">
                  {piece.topics.map(contentPieceTopicLabel).join('; ')}
                </dd>
              </div>
            ) : null}
            {piece.publishedAtLabel ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Publicado em</dt>
                <dd>{piece.publishedAtLabel}</dd>
              </div>
            ) : null}
          </dl>

          {!piece.hasFile && piece.linkFailureReasonLabel ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-950">
                Por que o arquivo não foi baixado
              </p>
              <p className="mt-2 text-sm font-medium text-amber-950">
                {piece.linkFailureReasonLabel}
              </p>
              <p className="mt-2 text-xs leading-5 text-amber-900">
                A peça continua disponível pelo link.
              </p>
              <ContentPieceAttachFileButton contentPieceId={piece.id} className="mt-3" />
            </div>
          ) : !piece.hasFile && piece.processingStatus !== 'processando' ? (
            <div className="mt-5 rounded-lg bg-muted p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                Sem mídia oficial para extrair. A peça circula pelo link; se quiser arquivar o
                original, anexe o arquivo.
              </p>
              <ContentPieceAttachFileButton contentPieceId={piece.id} className="mt-2" />
            </div>
          ) : null}

          {piece.processingStatus === 'falhou' ? (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs leading-5 text-red-800">
                {piece.failureMessage ?? 'O processamento não foi concluído.'} O arquivo foi
                preservado.
              </p>
              <ContentPieceRetryButton contentPieceId={piece.id} className="mt-2" />
            </div>
          ) : piece.processingStatus === 'processando' ? (
            piece.origin === 'instagram' && !piece.hasFile ? (
              <div className="mt-5 rounded-lg bg-muted p-3">
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Procurando a publicação no perfil oficial…
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-lg bg-muted p-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  {piece.step === 'transcrevendo'
                    ? 'Transcrevendo e catalogando…'
                    : 'Preparando a peça…'}{' '}
                  A ficha fica disponível para revisão assim que terminar.
                </p>
              </div>
            )
          ) : null}
        </div>

        <div>
          {processingSteps ? (
            // The detailed tracker is the desktop scene; mobile keeps the
            // compact progress box in the media column (design scene 3).
            <div className="mb-6 hidden rounded-xl border p-5 md:block">
              <p className="text-sm font-semibold">Processamento da peça</p>
              <ol className="mt-4 grid grid-cols-3 gap-3 text-xs">
                {processingSteps.map((step) => (
                  <li key={step.label} className={step.className}>
                    <b>{step.label}</b>
                    <p className={`mt-1 ${step.stateClassName}`}>{step.stateLabel}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : piece.origin !== 'arquivo' && piece.processingStatus === 'pronto' && piece.hasFile ? (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-900">
                {piece.transcript ? 'Arquivo e transcrição prontos' : 'Arquivo pronto'}
              </p>
              <p className="mt-1 text-xs leading-5 text-green-900/80">
                A ficha foi catalogada. Revise os campos antes de publicar.
              </p>
            </div>
          ) : null}
          <ContentPieceCirculationPanel
            circulation={piece.circulation}
            isPublished={piece.isPublished}
          />
          <div className="mt-6 border-t pt-6">
            <ContentPieceForm
              piece={{
                id: piece.id,
                title: piece.title,
                description: piece.description,
                type: piece.type,
                pieceDate: piece.pieceDate,
                topics: piece.topics,
                municipalityId: piece.municipalityId,
                institution: piece.institution,
                transcript: piece.transcript,
              }}
              municipalityOptions={options.municipalities}
              leaderOptions={data.leaderOptions}
              publicFigures={piece.publicFigures}
              searchLeaders={searchContentPieceLeaderOptionsForActor}
              formAction={updateContentPieceFormAction}
            />
            {piece.fileHref ? (
              <div className="mt-4">
                <Button asChild variant="outline" className="min-h-11">
                  <a href={`${piece.fileHref}?download=1`}>Baixar arquivo</a>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </CampaignPageShell>
  )
}
