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
import { SpeechCutLibraryFilters } from '@/components/campaign/speech/SpeechCutLibraryFilters'
import { SpeechCutLibraryList } from '@/components/campaign/speech/SpeechCutLibraryList'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { CAMPAIGN_COMMUNICATION_ACERVO, CAMPAIGN_COMMUNICATION_CORTES } from '@/lib/campaignPaths'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  buildSpeechCutFiltersKey,
  buildSpeechCutListHref,
} from '@/utilities/speech/speechCutListUrl'
import { loadSpeechCutAcervoPageData } from '@/utilities/speech/speechCutPageData'

export const metadata = campaignPageMetadataFromCatalog('cortes')

type SpeechCutLibraryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** C168 — the cut library: what was already cut, newest first, searchable. */
export default async function SpeechCutLibraryPage({ searchParams }: SpeechCutLibraryPageProps) {
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'speechCatalog' }),
    getPayload({ config }),
  ])

  const data = await loadSpeechCutAcervoPageData(payload, user, searchParams)
  if (data.redirectHref) redirect(data.redirectHref)

  const hasFilters = Boolean(data.state.q)

  return (
    <CampaignPageShell aria-label="Biblioteca de cortes">
      <CampaignListPendingBoundary>
        <SpeechCutLibraryFilters key={buildSpeechCutFiltersKey(data.state)} state={data.state} />

        <CampaignListResults>
          {data.rows.length > 0 ? (
            <SpeechCutLibraryList rows={data.rows} />
          ) : (
            <CampaignListEmptyState
              icon={hasFilters ? SearchXIcon : ScissorsIcon}
              title={
                data.state.q
                  ? `Nenhum corte encontrado para "${data.state.q}"`
                  : 'Nenhum corte ainda'
              }
              description={
                hasFilters
                  ? 'Tente outro termo ou limpe a busca.'
                  : 'Quando você cortar um trecho de uma fala, ele fica guardado aqui para reencontrar, baixar, ajustar o texto e republicar.'
              }
            >
              <Button asChild variant="outline" className="min-h-11">
                <Link
                  href={hasFilters ? CAMPAIGN_COMMUNICATION_CORTES : CAMPAIGN_COMMUNICATION_ACERVO}
                >
                  {hasFilters ? 'Limpar busca' : 'Ir para o acervo de falas'}
                </Link>
              </Button>
            </CampaignListEmptyState>
          )}

          {data.rows.length > 0 ? (
            <CampaignListFooter
              totalDocs={data.totalDocs}
              singular="corte encontrado"
              plural="cortes encontrados"
              page={data.state.page}
              totalPages={data.totalPages}
              hrefForPage={(page) => buildSpeechCutListHref(data.state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
