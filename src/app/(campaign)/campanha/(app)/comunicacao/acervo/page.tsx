import config from '@payload-config'
import { ScissorsIcon, SearchIcon, SearchXIcon, VideoIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { RecordingAcervoFilters } from '@/components/campaign/recording/RecordingAcervoFilters'
import { RecordingResultList } from '@/components/campaign/recording/RecordingResultList'
import { RecordingStatusRefresher } from '@/components/campaign/recording/RecordingStatusRefresher'
import { RecordingThemeFallbackNotice } from '@/components/campaign/recording/RecordingThemeFallbackNotice'
import { RecordingUploadDialog } from '@/components/campaign/recording/RecordingUploadDialog'
import { AcervoSortSelect } from '@/components/campaign/shared/AcervoSortSelect'
import { AcervoSourceToggle } from '@/components/campaign/shared/AcervoSourceToggle'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignThemeRetryButton } from '@/components/campaign/shared/CampaignThemeRetryButton'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SpeechAcervoFilters } from '@/components/campaign/speech/SpeechAcervoFilters'
import { SpeechRefineSearchButton } from '@/components/campaign/speech/SpeechRefineSearchButton'
import { SpeechResultList } from '@/components/campaign/speech/SpeechResultList'
import { SpeechThemeFallbackNotice } from '@/components/campaign/speech/SpeechThemeFallbackNotice'
import { WebSpeechResultList } from '@/components/campaign/speech/WebSpeechResultList'
import { Button } from '@/components/ui/button'
import { buildAcervoSourceHref, parseAcervoSource, type AcervoSource } from '@/lib/acervoSource'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { CAMPAIGN_COMMUNICATION_ACERVO, CAMPAIGN_COMMUNICATION_CORTES } from '@/lib/campaignPaths'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  buildRecordingFiltersKey,
  buildRecordingListHref,
  recordingHasActiveFilters,
} from '@/utilities/recordings/recordingListUrl'
import { loadRecordingsPageData } from '@/utilities/recordings/recordingPageData'
import {
  buildSpeechFiltersKey,
  buildSpeechListHref,
  speechHasActiveFilters,
} from '@/utilities/speech/speechListUrl'
import {
  loadSpeechAcervoPageData,
  loadWebSpeechAcervoPageData,
} from '@/utilities/speech/speechPageData'

export const metadata = campaignPageMetadataFromCatalog('acervo')

type SpeechAcervoPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * C199/C216 — the acervo header and its source switcher live above the three
 * sources: "Falas da Câmara" (the C154 catalog with its facets), "Gravações
 * enviadas" (the C199 recordings with their own search) and "Falas na internet"
 * (the C216 web speeches).
 */
const AcervoHeader = ({ source }: { source: AcervoSource }) => (
  <div className="flex flex-col gap-4 pt-4 md:pt-0">
    {/* Mobile keeps only the switcher row: the shell chrome already carries the
        title and the action joins the toggle (approved scene 6). */}
    <div className="flex flex-wrap items-end justify-between gap-4 max-md:hidden">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Acervo de falas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque nas falas da Câmara, nas gravações da equipe ou nas falas encontradas na internet.
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

const RecordingsSource = ({
  data,
}: {
  data: Awaited<ReturnType<typeof loadRecordingsPageData>>
}) => {
  const hasFilters = recordingHasActiveFilters(data.state)
  const themeMode = data.state.mode === 'tema'
  const themeActive = themeMode && data.themeApplied && !data.themeUnavailable

  return (
    <CampaignListPendingBoundary>
      <RecordingAcervoFilters
        key={buildRecordingFiltersKey(data.state)}
        state={data.state}
        filterOptions={data.filterOptions}
        themeUnavailable={data.themeUnavailable}
      />

      {data.themeUnavailable ? <RecordingThemeFallbackNotice /> : null}

      <RecordingStatusRefresher
        recordings={data.rows.map((row) => ({ id: row.id, status: row.status }))}
      />

      <CampaignListResults>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {data.themeUnavailable
                ? 'Resultados por termo exato'
                : themeActive
                  ? 'Resultados por tema'
                  : 'Gravações encontradas'}
            </h2>
            {themeMode ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.themeUnavailable
                  ? 'Comportamento atual do acervo.'
                  : themeActive
                    ? 'Confira o indício em cada gravação antes de abrir.'
                    : 'Nenhum termo relacionado foi acrescentado; mostramos a busca literal.'}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {data.themeUnavailable ? <CampaignThemeRetryButton /> : null}
            <AcervoSortSelect
              state={data.state}
              hint="Gravações sem duração aparecem apenas em Mais recentes."
            />
          </div>
        </div>

        {data.rows.length > 0 ? (
          <RecordingResultList rows={data.rows} />
        ) : (
          <CampaignListEmptyState
            className={themeActive ? 'border-solid' : undefined}
            icon={hasFilters ? SearchIcon : VideoIcon}
            title={
              themeActive
                ? 'Nenhuma gravação encontrada para este tema'
                : data.state.q
                  ? `Nenhuma gravação encontrada para "${data.state.q}"`
                  : hasFilters
                    ? 'Nenhuma gravação encontrada com esses filtros'
                    : 'Nenhuma gravação enviada ainda'
            }
            description={
              themeActive
                ? 'Não encontramos uma gravação que corresponda ao sentido desta busca com os filtros atuais. Não vamos preencher a lista com resultados pouco relacionados.'
                : hasFilters
                  ? 'Tente outro termo, remova filtros ou limpe a busca.'
                  : 'Envie um arquivo de vídeo para acompanhar a transcrição e pesquisar o conteúdo no acervo.'
            }
          >
            {themeActive ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild className="min-h-11">
                  <Link href={buildAcervoSourceHref('enviadas')}>Limpar filtros</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={buildRecordingListHref({ ...data.state, mode: undefined }, 1)}>
                    Trocar para termo exato
                  </Link>
                </Button>
              </div>
            ) : hasFilters ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={buildAcervoSourceHref('enviadas')}>Limpar filtros</Link>
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

/**
 * C216 — "Falas na internet": the web speeches list with the Câmara's search
 * gestures. The source has no Fase facet and no upload action, so the bar takes
 * the web copy and the ordering control its own hint.
 */
const WebSpeechesSource = ({
  data,
}: {
  data: Awaited<ReturnType<typeof loadWebSpeechAcervoPageData>>
}) => {
  const hasFilters = speechHasActiveFilters(data.state)
  const themeMode = data.state.mode === 'tema'
  const themeActive = themeMode && data.themeApplied && !data.themeUnavailable

  return (
    <CampaignListPendingBoundary>
      {/* C216 scene 01: the desktop bar sits inside the approved panel; below
          `md` the wrapper disappears and the shared sticky bar stays. */}
      <div className="max-md:contents md:rounded-xl md:border md:border-border md:bg-card md:p-4 md:shadow-sm">
        <SpeechAcervoFilters
          key={buildSpeechFiltersKey(data.state)}
          state={data.state}
          filterOptions={data.filterOptions}
          themeUnavailable={data.themeUnavailable}
          omniboxLabel="Buscar nas falas na internet"
          omniboxPlaceholder="Busque por assunto, tema ou município…"
          municipalityFacetLabel="Município citado"
          showPhaseFacet={false}
          filtersAriaLabel="Filtros das falas na internet"
        />
      </div>

      {data.themeUnavailable ? <SpeechThemeFallbackNotice /> : null}

      <CampaignListResults>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {data.themeUnavailable
                ? 'Resultados por termo exato'
                : themeActive
                  ? 'Resultados por tema'
                  : 'Resultados encontrados'}
            </h2>
            {themeMode ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.themeUnavailable
                  ? 'Comportamento atual do acervo.'
                  : themeActive
                    ? 'Confira o indício em cada fala antes de abrir.'
                    : 'Nenhum termo relacionado foi acrescentado; mostramos a busca literal.'}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {data.themeUnavailable ? <CampaignThemeRetryButton /> : null}
            <AcervoSortSelect
              state={data.state}
              hint="Falas sem duração aparecem apenas em Mais recentes."
            />
          </div>
        </div>

        {data.rows.length > 0 ? (
          <WebSpeechResultList rows={data.rows} />
        ) : (
          <CampaignListEmptyState
            className="border-solid"
            mediaClassName="rounded-none bg-transparent"
            icon={SearchXIcon}
            title={
              themeActive
                ? 'Nenhuma fala encontrada para este tema'
                : hasFilters
                  ? 'Nenhuma fala encontrada'
                  : 'Nenhuma fala da internet catalogada ainda'
            }
            description={
              themeActive
                ? 'Não encontramos uma fala que corresponda ao sentido desta busca com os filtros atuais. Não vamos preencher a lista com resultados pouco relacionados.'
                : hasFilters
                  ? 'Não encontramos uma fala para esta busca com os filtros atuais. Tente outro termo ou remova um filtro.'
                  : 'As falas encontradas na internet aparecem aqui depois que a ingestão as catalogar.'
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
                  <Link href={buildAcervoSourceHref('internet')}>Limpar filtros</Link>
                </Button>
              </div>
            ) : hasFilters ? (
              <Button asChild className="min-h-11">
                <Link href={buildAcervoSourceHref('internet')}>Limpar busca e filtros</Link>
              </Button>
            ) : null}
          </CampaignListEmptyState>
        )}

        {data.rows.length > 0 ? (
          <CampaignListFooter
            totalDocs={data.totalDocs}
            singular="fala na internet encontrada"
            plural="falas na internet encontradas"
            page={data.state.page}
            totalPages={data.totalPages}
            hrefForPage={(page) => buildSpeechListHref(data.state, page)}
          />
        ) : null}
      </CampaignListResults>
    </CampaignListPendingBoundary>
  )
}

/**
 * C154 — the Câmara source: the original acervo list with its facets (Fase
 * included). The three sources now share the page as one branch each.
 */
const CamaraSource = ({ data }: { data: Awaited<ReturnType<typeof loadSpeechAcervoPageData>> }) => {
  const hasFilters = speechHasActiveFilters(data.state)
  const themeMode = data.state.mode === 'tema'
  const themeActive = themeMode && data.themeApplied && !data.themeUnavailable

  return (
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
            {data.themeUnavailable ? <CampaignThemeRetryButton /> : null}
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
  )
}

export default async function SpeechAcervoPage({ searchParams }: SpeechAcervoPageProps) {
  const [user, payload, params] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
    searchParams,
  ])

  const source = parseAcervoSource(params)

  if (source === 'enviadas') {
    const recordings = await loadRecordingsPageData(payload, user, params)
    if (recordings.redirectHref) redirect(recordings.redirectHref)

    return (
      <CampaignPageShell aria-label="Acervo de gravações">
        <AcervoHeader source="enviadas" />
        <RecordingsSource data={recordings} />
      </CampaignPageShell>
    )
  }

  if (source === 'internet') {
    const webSpeeches = await loadWebSpeechAcervoPageData(payload, user, params)
    if (webSpeeches.redirectHref) redirect(webSpeeches.redirectHref)

    return (
      <CampaignPageShell aria-label="Acervo de falas na internet">
        <AcervoHeader source="internet" />
        <WebSpeechesSource data={webSpeeches} />
      </CampaignPageShell>
    )
  }

  const data = await loadSpeechAcervoPageData(payload, user, params)
  if (data.redirectHref) redirect(data.redirectHref)

  return (
    <CampaignPageShell aria-label="Acervo de falas">
      <AcervoHeader source="camara" />
      <CamaraSource data={data} />
    </CampaignPageShell>
  )
}
