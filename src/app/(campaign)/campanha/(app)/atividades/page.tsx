import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import config from '@payload-config'
import { MapPinnedIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { ActivityFilters } from '@/components/campaign/activity/ActivityFilters'
import { ActivityList } from '@/components/campaign/activity/ActivityList'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import type { Activity } from '@/payload-types'
import { loadActivityListPageData } from '@/utilities/activityPageData'
import {
  buildActivityFiltersKey,
  buildActivityListHref,
  resolveActivityListUrl,
} from '@/utilities/activityUi'
import { toActivityListViewModel } from '@/utilities/activityViewModels'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { TOUR_COMPOSER_PATH } from '@/utilities/visitPlannerUrl'

type ActivityListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ActivityListPage({ searchParams }: ActivityListPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveActivityListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) return null
  if (!isCampaignStaff(user)) redirect('/campanha')

  const now = new Date()
  const [{ result, state }, municipalityOptions] = await Promise.all([
    loadActivityListPageData(payload, user, rawSearchParams, now),
    loadMunicipalityOptions(payload, user),
  ])
  const resolvedUrl = resolveActivityListUrl(rawSearchParams, result.totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)

  const canCreate = isCampaignStaff(user)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Atividades</h1>
          <p className="text-muted-foreground">
            Organize caminhadas, comícios, panfletagens e demais ações de campanha.
          </p>
        </div>
        {canCreate ? (
          <div className="flex flex-wrap gap-2">
            {/* E13: the planner generates several drafts at once, so it sits next
                to "Nova atividade" rather than replacing it. */}
            <Button asChild variant="outline" className="min-h-11">
              <Link href={TOUR_COMPOSER_PATH}>
                <MapPinnedIcon data-icon="inline-start" aria-hidden="true" />
                Planejar giro
              </Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/campanha/atividades/nova">
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Nova atividade
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

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
