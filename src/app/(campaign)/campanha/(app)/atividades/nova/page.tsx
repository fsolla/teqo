import config from '@payload-config'
import { getPayload } from 'payload'

import {
  searchActivityContactOptions,
  searchActivityLeadershipOptionsAction,
} from '@/app/(campaign)/campanha/(app)/atividades/contactSearchActions'
import { createActivityFormAction } from '@/app/(campaign)/campanha/(app)/atividades/formActions'
import { ActivityForm } from '@/components/campaign/activity/ActivityForm'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { loadAccessibleActivityTags } from '@/utilities/activityPageData'
import { parseActivityAgendaReturnHref, parseActivityCreatePrefill } from '@/utilities/activityUi'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
} from '@/utilities/campaignRelationOptions'
import { getEligibleAdvisorOptions } from '@/utilities/municipality/municipalityViewModels'

export const metadata = campaignPageMetadataFromCatalog('atividadesNova')

type NewActivityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewActivityPage({ searchParams }: NewActivityPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff', redirectTo: '/campanha/agenda' }),
    getPayload({ config }),
  ])

  const canManageAdvisors = user.role === 'coordinator'
  const [municipalityOptions, organizationOptions, advisorOptions, knownTags] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
    canManageAdvisors ? getEligibleAdvisorOptions(payload, user) : Promise.resolve([]),
    loadAccessibleActivityTags(payload, user),
  ])
  const accessibleMunicipalityIDs = new Set(municipalityOptions.map((option) => option.id))
  const accessibleTags = new Set(knownTags)
  const initialValues = parseActivityCreatePrefill(rawSearchParams, accessibleMunicipalityIDs)
  const cancelHref = parseActivityAgendaReturnHref(
    rawSearchParams.returnTo,
    accessibleMunicipalityIDs,
    accessibleTags,
  )

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <ActivityForm
        action={createActivityFormAction}
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        advisorOptions={advisorOptions}
        canManageAdvisors={canManageAdvisors}
        initialValues={initialValues}
        cancelHref={cancelHref}
        knownTags={knownTags}
        submitLabel="Criar atividade"
        searchContacts={searchActivityContactOptions}
        searchLeaderships={searchActivityLeadershipOptionsAction}
      />
    </div>
  )
}
