import config from '@payload-config'
import { MapPinnedIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { ActivityAgenda } from '@/components/campaign/activity/ActivityAgenda'
import { ActivityAgendaFilters } from '@/components/campaign/activity/ActivityAgendaFilters'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { loadAccessibleActivityTags } from '@/utilities/activityPageData'
import {
  buildActivityAgendaHref,
  buildActivityCreateHref,
  resolveActivityAgendaUrl,
  restrictActivityAgendaState,
} from '@/utilities/activityUi'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { TOUR_COMPOSER_PATH } from '@/utilities/visit/visitPlannerUrl'

export const metadata = campaignPageMetadataFromCatalog('agenda')

type AgendaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const rawSearchParams = await searchParams
  const resolvedUrl = resolveActivityAgendaUrl(rawSearchParams)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])
  const [municipalityOptions, knownTags] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    loadAccessibleActivityTags(payload, user),
  ])
  const state = restrictActivityAgendaState(
    resolvedUrl.state,
    new Set(municipalityOptions.map((option) => option.id)),
    new Set(knownTags),
  )
  const accessibleHref = buildActivityAgendaHref(state)
  if (accessibleHref !== resolvedUrl.href) redirect(accessibleHref)

  return (
    <CampaignPageShell className="gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={TOUR_COMPOSER_PATH}>
            <MapPinnedIcon data-icon="inline-start" aria-hidden="true" />
            Planejar giro
          </Link>
        </Button>
        <Button asChild className="min-h-11">
          <Link href={buildActivityCreateHref(state)}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova atividade
          </Link>
        </Button>
      </div>

      <CampaignListPendingBoundary>
        <ActivityAgendaFilters
          state={state}
          municipalityOptions={municipalityOptions}
          knownTags={knownTags}
        />
        <CampaignListResults>
          <ActivityAgenda state={state} />
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
