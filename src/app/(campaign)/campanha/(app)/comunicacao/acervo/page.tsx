import config from '@payload-config'
import { ScissorsIcon, SearchIcon, SearchXIcon, VideoIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { AcervoSourceToggle } from '@/components/campaign/recording/AcervoSourceToggle'
import { RecordingResultList } from '@/components/campaign/recording/RecordingResultList'
import { RecordingStatusRefresher } from '@/components/campaign/recording/RecordingStatusRefresher'
import { RecordingUploadDialog } from '@/components/campaign/recording/RecordingUploadDialog'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SpeechAcervoFilters } from '@/components/campaign/speech/SpeechAcervoFilters'
import { SpeechRefineSearchButton } from '@/components/campaign/speech/SpeechRefineSearchButton'
import { SpeechResultList } from '@/components/campaign/speech/SpeechResultList'
import { SpeechThemeFallbackNotice } from '@/components/campaign/speech/SpeechThemeFallbackNotice'
import { SpeechThemeRetryButton } from '@/components/campaign/speech/SpeechThemeRetryButton'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { CAMPAIGN_COMMUNICATION_ACERVO, CAMPAIGN_COMMUNICATION_CORTES } from '@/lib/campaignPaths'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  buildAcervoSourceHref,
  buildRecordingListHref,
  parseAcervoSource,
} from '@/utilities/recordings/recordingListUrl'
import { loadRecordingsPageData } from '@/utilities/recordings/recordingPageData'
import { buildSpeechFiltersKey, buildSpeechListHref } from '@/utilities/speech/speechListUrl'
import { loadSpeechAcervoPageData } from '@/utilities/speech/speechPageData'

export const metadata = campaignPageMetadataFromCatalog('acervo')

type SpeechAcervoPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * C199 — the acervo header and its source switcher live above both sources:
 * "Falas da Câmara" (the C154 catalog with its facets) and "Gravações enviadas"
 * (the C199 recordings with their own search).
 */
const AcervoHeader = ({ source }: { source: 'camara' | 'enviadas' }) => (
  <div className="flex flex-col gap-4 pt-4 md:pt-0">
    {/* Mobile keeps only the switcher row: the shell chrome already carries the
        title and the action joins the toggle (approved scene 6). */}
    <div className="flex flex-wrap items-end justify-between gap-4 max-md:hidden">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Acervo de falas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque nas falas da Câmara ou nas gravações da equipe.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={CAMPAIGN_COMMUNICATION_CORTES}>
            <ScissorsIcon data-icon="inline-start" aria-hidden="true" />
            Biblioteca de cortes
          </Link>
        </Button>
        <RecordingUploadDialog />
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <AcervoSourceToggle source={source} />
      <RecordingUploadDialog
        triggerLabel=""
        triggerAriaLabel="Enviar gravação"
        triggerClassName="min-h-10 md:hidden"
      />
    </div>
  </div>
)

const RecordingsSearchForm = ({ query }: { query?: string }) => (
  <form method="get" action={CAMPAIGN_COMMUNICATION_ACERVO} className="flex flex-col gap-1.5">
    <input type="hidden" name="source" value="enviadas" />
    {/* The shared input owns the accessible label; this is its visible twin. */}
    <p className="text-sm font-medium">Buscar nas gravações enviadas</p>
    <CampaignSearchInput
      id="recording-search"
      name="q"
      label="Buscar nas gravações enviadas"
      defaultValue={query}
      placeholder="Busque por palavra ou trecho da transcrição…"
    />
    <button type="submit" className="sr-only">
      Buscar
    </button>
  </form>
)

const RecordingsSource = ({
  data,
}: {
  data: Awaited<ReturnType<typeof loadRecordingsPageData>>
}) => {
  const hasSearch = Boolean(data.state.q)

  return (
    <CampaignListPendingBoundary>
      <RecordingsSearchForm query={data.state.q} />

      <RecordingStatusRefresher
        recordings={data.rows.map((row) => ({ id: row.id, status: row.status }))}
      />

      <CampaignListResults>
        {data.rows.length > 0 ? (
          <RecordingResultList rows={data.rows} />
        ) : (
          <CampaignListEmptyState
            className="border-solid"
            icon={hasSearch ? SearchIcon : VideoIcon}
            title={
              hasSearch
                ? `Nenhuma gravação encontrada para "${data.state.q}"`
                : 'Nenhuma gravação enviada ainda'
            }
            description={
              hasSearch
                ? 'Tente outro termo ou limpe a busca para ver todas as gravações enviadas.'
                : 'Envie um arquivo de vídeo para acompanhar a transcrição e pesquisar o conteúdo no acervo.'
            }
          >
            {hasSearch ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={buildAcervoSourceHref('enviadas')}>Limpar busca</Link>
              </Button>
            ) : (
              <RecordingUploadDialog triggerLabel="Enviar gravação" />
            )}
          </CampaignListEmptyState>
        )}

        {data.rows.length > 0 ? (
          <CampaignListFooter
            totalDocs={data.totalDocs}
            singular="gravação encontrada"
            plural="gravações encontradas"
            page={data.state.page}
            totalPages={data.totalPages}
            hrefForPage={(page) => buildRecordingListHref(data.state, page)}
          />
        ) : null}
      </CampaignListResults>
    </CampaignListPendingBoundary>
  )
}

export default async function SpeechAcervoPage({ searchParams }: SpeechAcervoPageProps) {
  const [user, payload, params] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
    searchParams,
  ])

  if (parseAcervoSource(params) === 'enviadas') {
    const recordings = await loadRecordingsPageData(payload, user, params)
    if (recordings.redirectHref) redirect(recordings.redirectHref)

    return (
      <CampaignPageShell aria-label="Acervo de gravações">
        <AcervoHeader source="enviadas" />
        <RecordingsSource data={recordings} />
      </CampaignPageShell>
    )
  }

  const data = await loadSpeechAcervoPageData(payload, user, params)
  if (data.redirectHref) redirect(data.redirectHref)

  const hasFilters = buildSpeechFiltersKey(data.state) !== ''
  const themeMode = data.state.mode === 'tema'
  const themeActive = themeMode && data.themeApplied && !data.themeUnavailable

  return (
    <CampaignPageShell aria-label="Acervo de falas">
      <AcervoHeader source="camara" />

      <CampaignListPendingBoundary>
        <SpeechAcervoFilters
          key={buildSpeechFiltersKey(data.state)}
          state={data.state}
          filterOptions={data.filterOptions}
          themeUnavailable={data.themeUnavailable}
        />

        {data.themeUnavailable ? <SpeechThemeFallbackNotice /> : null}

        <CampaignListResults>
          {themeMode ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {data.themeUnavailable
                    ? 'Resultados por termo exato'
                    : themeActive
                      ? 'Resultados por tema'
                      : 'Resultados'}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.themeUnavailable
                    ? 'Comportamento atual do acervo.'
                    : themeActive
                      ? 'Confira o indício em cada fala antes de abrir.'
                      : 'Nenhum termo relacionado foi acrescentado; mostramos a busca literal.'}
                </p>
              </div>
              {data.themeUnavailable ? <SpeechThemeRetryButton /> : null}
            </div>
          ) : null}

          {data.rows.length > 0 ? (
            <SpeechResultList rows={data.rows} query={data.state.q} />
          ) : (
            <CampaignListEmptyState
              icon={SearchXIcon}
              className={themeActive ? 'border-solid' : undefined}
              mediaClassName={themeActive ? 'size-12 rounded-full' : undefined}
              contentClassName={themeActive ? 'max-w-none' : undefined}
              title={
                themeActive
                  ? 'Nenhuma fala encontrada para este tema'
                  : data.state.q
                    ? `Nenhuma fala encontrada para "${data.state.q}"`
                    : 'Nenhuma fala encontrada'
              }
              description={
                themeActive
                  ? 'Não encontramos uma fala que corresponda ao sentido desta busca com os filtros atuais. Não vamos preencher a lista com resultados pouco relacionados.'
                  : hasFilters
                    ? 'Tente outro termo, remova filtros ou busque por um tema.'
                    : 'O acervo ainda não tem falas importadas.'
              }
            >
              {themeActive ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <SpeechRefineSearchButton />
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href={buildSpeechListHref({ ...data.state, mode: undefined }, 1)}>
                      Usar termo exato
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="min-h-11">
                    <Link href={CAMPAIGN_COMMUNICATION_ACERVO}>Limpar filtros</Link>
                  </Button>
                </div>
              ) : (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={CAMPAIGN_COMMUNICATION_ACERVO}>Limpar busca e filtros</Link>
                </Button>
              )}
            </CampaignListEmptyState>
          )}

          {data.rows.length > 0 ? (
            <CampaignListFooter
              totalDocs={data.totalDocs}
              singular="fala encontrada"
              plural="falas encontradas"
              page={data.state.page}
              totalPages={data.totalPages}
              hrefForPage={(page) => buildSpeechListHref(data.state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
