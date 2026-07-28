import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'
import { Suspense } from 'react'

import { CampaignDashboard } from '@/components/campaign/dashboard/CampaignDashboard'
import { LeaderContactsPanel } from '@/components/campaign/leadership/LeaderContactsPanel'
import { MunicipalityMapPanelDynamic } from '@/components/campaign/map/MunicipalityMapPanelDynamic'
import { MunicipalityEstimateScenarioProvider } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import {
  SuggestionSilenceStrip,
  SuggestionsPanel,
} from '@/components/campaign/suggestion/SuggestionsPanel'
import type { CampaignUser } from '@/payload-types'
import { isCampaignLeader, isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { getCampaignDashboardData } from '@/utilities/campaignDashboardData'
import { loadFederalCandidateOptions } from '@/utilities/electionCandidateOptions'
import { loadLeaderContactsPageData } from '@/utilities/leaderContactsPageData'
import { loadMunicipalityMapBundle } from '@/utilities/municipalityMapData'
import { loadMunicipalitySuggestions } from '@/utilities/municipalityTriggers'

import { resolveSuggestionFormAction } from './suggestionFormActions'

export const dynamic = 'force-dynamic'

type CampaignHomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CampaignHomePage({ searchParams }: CampaignHomePageProps) {
  const rawSearchParams = await searchParams
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) redirect('/campanha/login')

  if (isCampaignLeader(user)) {
    const view = await loadLeaderContactsPageData(payload, user)
    return (
      <LeaderContactsPanel
        userName={user.name}
        municipalityOptions={view.municipalityOptions}
        defaultMunicipalityId={view.defaultMunicipalityId}
        showMunicipalitySelect={view.showMunicipalitySelect}
        registrationConsentConfigured={view.registrationConsentConfigured}
        contacts={view.contacts}
      />
    )
  }

  const isStaff = isCampaignStaff(user)
  const view = await getCampaignDashboardData(payload, user)

  return (
    <CampaignDashboard
      view={view}
      userName={user.name}
      mapSlot={
        isStaff ? (
          // Streams after the KPI shell paints; the shared request-scoped
          // municipality scope is reused (React cache), not reloaded.
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
        ) : null
      }
      suggestionsSlot={
        isStaff ? (
          // Streams too: the evaluator adds its own reads (signals, agenda,
          // decisions) and must not hold the KPI shell.
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
        ) : null
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
      <MunicipalityMapPanelDynamic bundle={mapBundle} candidateOptions={candidateOptions} />
    </MunicipalityEstimateScenarioProvider>
  )
}
