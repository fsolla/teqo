import config from '@payload-config'
import { ClapperboardIcon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { ReelLibraryList } from '@/components/campaign/reels/ReelLibraryList'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { buildReelListHref } from '@/utilities/reels/reelListUrl'
import { loadReelLibraryPageData } from '@/utilities/reels/reelPageData'

export const metadata = campaignPageMetadataFromCatalog('reels')

type ReelLibraryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** C194 — the reel library: published tutorials, newest publication first. */
export default async function ReelLibraryPage({ searchParams }: ReelLibraryPageProps) {
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  const data = await loadReelLibraryPageData(payload, user, searchParams)
  if (data.redirectHref) redirect(data.redirectHref)

  return (
    <CampaignPageShell aria-label="Biblioteca de reels">
      <CampaignListPendingBoundary>
        <CampaignListResults>
          {data.rows.length > 0 ? (
            <>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Reels publicados</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Abra um reel para assistir e baixar os arquivos.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {data.totalDocs} {data.totalDocs === 1 ? 'reel' : 'reels'}
                </span>
              </div>

              <ReelLibraryList rows={data.rows} />
            </>
          ) : (
            <CampaignListEmptyState
              icon={ClapperboardIcon}
              title="Nenhum reel produzido ainda"
              description="A produção dos reels acontece fora do Teqo. Quando um reel for aprovado e publicado na biblioteca, ele aparece aqui para a assessoria."
            />
          )}

          {data.rows.length > 0 ? (
            <CampaignListFooter
              totalDocs={data.totalDocs}
              singular="reel publicado"
              plural="reels publicados"
              page={data.state.page}
              totalPages={data.totalPages}
              hrefForPage={(page) => buildReelListHref(data.state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
