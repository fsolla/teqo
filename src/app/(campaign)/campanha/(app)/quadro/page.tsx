import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { Suspense } from 'react'

import { CampaignDashboard } from '@/components/campaign/dashboard/CampaignDashboard'
import { MunicipalityMapPanelDynamic } from '@/components/campaign/map/MunicipalityMapPanelDynamic'
import { MunicipalityEstimateScenarioProvider } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import {
  SuggestionSilenceStrip,
  SuggestionsPanel,
} from '@/components/campaign/suggestion/SuggestionsPanel'
import type { CampaignUser } from '@/payload-types'
import { getCampaignDashboardData } from '@/utilities/campaignDashboardData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadFederalCandidateOptions } from '@/utilities/electionCandidateOptions'
import { loadMunicipalityMapBundle } from '@/utilities/municipality/municipalityMapData'
import { loadMunicipalitySuggestions } from '@/utilities/municipality/municipalityTriggers'

import { resolveSuggestionFormAction } from '../suggestionFormActions'

export const dynamic = 'force-dynamic'

type CampaignQuadroPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CampaignQuadroPage({ searchParams }: CampaignQuadroPageProps) {
  const rawSearchParams = await searchParams
  const [payload, user] = await Promise.all([
    getPayload({ config }),
    requireCampaignPageActor({ gate: 'staff' }),
  ])

  const view = await getCampaignDashboardData(payload, user)

  return (
    <CampaignDashboard
      view={view}
      userName={user.name}
      mapSlot={
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="h-[420px] w-full animate-pulse rounded-xl border bg-muted/40"
            />
          }
        >
          <DashboardMapSection payload={payload} user={user} compare={rawSearchParams.compare} />
        </Suspense>
      }
      suggestionsSlot={
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="h-48 w-full animate-pulse rounded-xl border bg-muted/40"
            />
          }
        >
          <DashboardSuggestionsSection payload={payload} user={user} />
        </Suspense>
      }
    />
  )
}

/** E11 — the decision queue: top-5 by triage plus the monthly silence review. */
const DashboardSuggestionsSection = async ({
  payload,
  user,
}: {
  payload: Payload
  user: CampaignUser
}) => {
  const bundle = await loadMunicipalitySuggestions(payload, user)

  return (
    <SuggestionsPanel
      titleId="dashboard-suggestions-title"
      suggestions={bundle.suggestions.slice(0, 5)}
      activeCount={bundle.suggestions.length}
      showMunicipality
      resolveAction={resolveSuggestionFormAction}
      emptyState={
        <p className="text-sm text-muted-foreground">
          Nenhum padrão do catálogo dispara nos seus municípios agora.
        </p>
      }
    >
      <SuggestionSilenceStrip entries={bundle.silence} />
    </SuggestionsPanel>
  )
}

const DashboardMapSection = async ({
  payload,
  user,
  compare,
}: {
  payload: Payload
  user: CampaignUser
  compare: string | string[] | undefined
}) => {
  const [mapBundle, candidateOptions] = await Promise.all([
    loadMunicipalityMapBundle(payload, user, { compare }),
    loadFederalCandidateOptions(user),
  ])
  if (!mapBundle) return null

  return (
    <MunicipalityEstimateScenarioProvider>
      <MunicipalityMapPanelDynamic
        bundle={mapBundle}
        candidateOptions={candidateOptions}
        actorRole={user.role}
      />
    </MunicipalityEstimateScenarioProvider>
  )
}
