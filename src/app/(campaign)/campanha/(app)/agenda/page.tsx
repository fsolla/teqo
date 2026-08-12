import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  createCalendarFeedLink,
  listCalendarFeeds,
  revokeCalendarFeed,
} from '@/app/(campaign)/campanha/actions/calendarFeed'
import {
  getGoogleCalendarSyncState,
  runGoogleCalendarSyncNow,
  setGoogleCalendarSyncDisabled,
} from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { ActivityAgenda } from '@/components/campaign/activity/ActivityAgenda'
import { ActivityAgendaFilters } from '@/components/campaign/activity/ActivityAgendaFilters'
import { AgendaFeedChrome } from '@/components/campaign/activity/AgendaFeedChrome'
import { AgendaGoogleSyncChrome } from '@/components/campaign/activity/AgendaGoogleSyncChrome'
import { AgendaViewChrome } from '@/components/campaign/activity/AgendaViewChrome'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { loadAccessibleActivityTags } from '@/utilities/activityPageData'
import {
  buildActivityAgendaHref,
  resolveActivityAgendaUrl,
  restrictActivityAgendaState,
} from '@/utilities/activityUi'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
} from '@/utilities/campaignRelationOptions'

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
  const [municipalityOptions, organizationOptions, knownTags, feeds, googleSyncState] =
    await Promise.all([
      loadMunicipalityOptions(payload, user),
      loadOrganizationOptions(payload, user),
      loadAccessibleActivityTags(payload, user),
      listCalendarFeeds().catch(() => []),
      getGoogleCalendarSyncState(),
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
      {/* C95: mounted before AgendaFeedChrome so the header cluster orders
          [Semana ▾][Link de import][Notificações][IA] (gate da intenção). */}
      <AgendaViewChrome state={state} />
      <AgendaFeedChrome
        feeds={feeds.map((f) => ({
          id: f.id,
          label: f.label,
          createdAt: f.createdAt,
        }))}
        onCreateFeed={async (label) => {
          'use server'
          return createCalendarFeedLink({
            label,
            filterMunicipality: state.municipality,
            filterDeputyPresent: state.deputyPresent,
            filterTag: state.tag,
          })
        }}
        onRevokeFeed={async (feedId) => {
          'use server'
          return revokeCalendarFeed(feedId)
        }}
      />
      {/* C114: pill Google no header (após o link de import) + FAB mobile. */}
      <AgendaGoogleSyncChrome
        initialState={googleSyncState}
        onSyncNow={async () => {
          'use server'
          return runGoogleCalendarSyncNow()
        }}
        onSetDisabled={async (disabled) => {
          'use server'
          return setGoogleCalendarSyncDisabled(disabled)
        }}
      />

      <CampaignListPendingBoundary>
        <ActivityAgendaFilters
          state={state}
          municipalityOptions={municipalityOptions}
          knownTags={knownTags}
        />
        <CampaignListResults>
          <ActivityAgenda
            state={state}
            municipalityOptions={municipalityOptions}
            organizationOptions={organizationOptions}
            knownTags={knownTags}
          />
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
