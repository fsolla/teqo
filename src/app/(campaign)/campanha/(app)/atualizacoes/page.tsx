import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignUpdatesFeed } from '@/components/campaign/municipality/CampaignUpdatesFeed'
import { CampaignUpdatesFilters } from '@/components/campaign/municipality/CampaignUpdatesFilters'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadCampaignUpdatesFeed,
  loadCampaignUpdatesFeedFacets,
} from '@/utilities/municipality/campaignUpdatesFeedData'
import {
  buildCampaignUpdatesFeedHref,
  resolveCampaignUpdatesFeedUrl,
} from '@/utilities/municipality/municipalityUpdateListUrl'

export const metadata = campaignPageMetadataFromCatalog('atualizacoes')

type CampaignUpdatesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CampaignUpdatesPage({ searchParams }: CampaignUpdatesPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveCampaignUpdatesFeedUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])
  const isStaff = isCampaignStaff(user)

  const { state } = canonicalUrl
  const [feed, facets] = await Promise.all([
    loadCampaignUpdatesFeed(payload, user, state),
    loadCampaignUpdatesFeedFacets(payload, user),
  ])

  const resolvedUrl = resolveCampaignUpdatesFeedUrl(rawSearchParams, feed.totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state: canonicalState } = resolvedUrl

  return (
    <CampaignPageShell>
      <CampaignListPendingBoundary>
        <CampaignUpdatesFilters state={canonicalState} facets={facets} isStaff={isStaff} />
        <CampaignListResults>
          <CampaignUpdatesFeed cards={feed.cards} />
          <CampaignListFooter
            totalDocs={feed.totalDocs}
            singular="atualização encontrada"
            plural="atualizações encontradas"
            page={feed.page}
            totalPages={feed.totalPages}
            hrefForPage={(page) => buildCampaignUpdatesFeedHref(canonicalState, page)}
          />
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
