import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import config from '@payload-config'
import { MapPinnedIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { ActivityCreateOverlayHost } from '@/components/campaign/activity/ActivityCreateOverlayHost'
import { ActivityFilters } from '@/components/campaign/activity/ActivityFilters'
import { ActivityList } from '@/components/campaign/activity/ActivityList'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import type { Activity } from '@/payload-types'
import { loadAccessibleActivityTags, loadActivityListPageData } from '@/utilities/activityPageData'
import {
  buildActivityFiltersKey,
  buildActivityListHref,
  resolveActivityListUrl,
} from '@/utilities/activityUi'
import { toActivityListViewModel } from '@/utilities/activityViewModels'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
} from '@/utilities/campaignRelationOptions'
import { TOUR_COMPOSER_PATH } from '@/utilities/visit/visitPlannerUrl'

export const metadata = campaignPageMetadataFromCatalog('atividades')

type ActivityListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ActivityListPage({ searchParams }: ActivityListPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveActivityListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const now = new Date()
  const [{ result, state }, municipalityOptions, organizationOptions, knownTags] =
    await Promise.all([
      loadActivityListPageData(payload, user, rawSearchParams, now),
      loadMunicipalityOptions(payload, user),
      loadOrganizationOptions(payload, user),
      loadAccessibleActivityTags(payload, user),
    ])
  const resolvedUrl = resolveActivityListUrl(rawSearchParams, result.totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)

  const canCreate = isCampaignStaff(user)

  return (
    <CampaignPageShell>
      {canCreate ? (
        <div className="flex flex-wrap justify-end gap-2 pt-4 md:pt-0">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={TOUR_COMPOSER_PATH}>
              <MapPinnedIcon data-icon="inline-start" aria-hidden="true" />
              Planejar giro
            </Link>
          </Button>
          <ActivityCreateOverlayHost
            municipalityId={state.municipality}
            municipalityOptions={municipalityOptions}
            organizationOptions={organizationOptions}
            knownTags={knownTags}
          />
        </div>
      ) : null}

      <CampaignListPendingBoundary>
        <ActivityFilters
          key={buildActivityFiltersKey(state)}
          state={state}
          municipalityOptions={municipalityOptions}
        />

        <CampaignListResults>
          {result.docs.length ? (
            <>
              <ActivityList
                activities={result.docs.map((activity) =>
                  toActivityListViewModel(activity as Activity),
                )}
              />
              <CampaignListFooter
                totalDocs={result.totalDocs}
                singular="atividade encontrada"
                plural="atividades encontradas"
                page={state.page}
                totalPages={result.totalPages}
                hrefForPage={(page) => buildActivityListHref(state, page)}
              />
            </>
          ) : (
            <CampaignListEmptyState
              icon={SearchXIcon}
              title="Nenhuma atividade encontrada"
              description="Ajuste os filtros ou a janela selecionada. Você só vê atividades dentro do seu escopo."
            >
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/campanha/atividades">Limpar filtros</Link>
              </Button>
            </CampaignListEmptyState>
          )}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
