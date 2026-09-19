import config from '@payload-config'
import { ScissorsIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
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
import { buildSpeechFiltersKey, buildSpeechListHref } from '@/utilities/speech/speechListUrl'
import { loadSpeechAcervoPageData } from '@/utilities/speech/speechPageData'

export const metadata = campaignPageMetadataFromCatalog('acervo')

type SpeechAcervoPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SpeechAcervoPage({ searchParams }: SpeechAcervoPageProps) {
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  const data = await loadSpeechAcervoPageData(payload, user, searchParams)
  if (data.redirectHref) redirect(data.redirectHref)

  const hasFilters = buildSpeechFiltersKey(data.state) !== ''
  const themeMode = data.state.mode === 'tema'
  const themeActive = themeMode && data.themeApplied && !data.themeUnavailable

  return (
    <CampaignPageShell aria-label="Acervo de falas">
      <div className="flex justify-end pt-4 md:pt-0">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={CAMPAIGN_COMMUNICATION_CORTES}>
            <ScissorsIcon data-icon="inline-start" aria-hidden="true" />
            Biblioteca de cortes
          </Link>
        </Button>
      </div>

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
