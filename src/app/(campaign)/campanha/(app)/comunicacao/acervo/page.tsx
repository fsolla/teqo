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
import { SpeechResultList } from '@/components/campaign/speech/SpeechResultList'
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
    requireCampaignPageActor({ gate: 'speechCatalog' }),
    getPayload({ config }),
  ])

  const data = await loadSpeechAcervoPageData(payload, user, searchParams)
  if (data.redirectHref) redirect(data.redirectHref)

  const hasFilters = buildSpeechFiltersKey(data.state) !== ''

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
        />

        <CampaignListResults>
          {data.rows.length > 0 ? (
            <SpeechResultList rows={data.rows} query={data.state.q} />
          ) : (
            <CampaignListEmptyState
              icon={SearchXIcon}
              title={
                data.state.q
                  ? `Nenhuma fala encontrada para "${data.state.q}"`
                  : 'Nenhuma fala encontrada'
              }
              description={
                hasFilters
                  ? 'Tente outro termo, remova filtros ou busque por um tema.'
                  : 'O acervo ainda não tem falas importadas.'
              }
            >
              <Button asChild variant="outline" className="min-h-11">
                <Link href={CAMPAIGN_COMMUNICATION_ACERVO}>Limpar busca e filtros</Link>
              </Button>
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
