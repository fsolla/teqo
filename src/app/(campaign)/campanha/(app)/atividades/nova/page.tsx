import config from '@payload-config'
import { getPayload } from 'payload'

import {
  searchActivityContactOptions,
  searchActivityLeadershipOptionsAction,
} from '@/app/(campaign)/campanha/(app)/atividades/contactSearchActions'
import { createActivityFormAction } from '@/app/(campaign)/campanha/(app)/atividades/formActions'
import { ActivityForm } from '@/components/campaign/activity/ActivityForm'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
} from '@/utilities/campaignRelationOptions'
import { getEligibleAdvisorOptions } from '@/utilities/municipality/municipalityViewModels'

export const metadata = campaignPageMetadataFromCatalog('atividadesNova')

export default async function NewActivityPage() {
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff', redirectTo: '/campanha/atividades' }),
    getPayload({ config }),
  ])

  const canManageAdvisors = user.role === 'coordinator'
  const [municipalityOptions, organizationOptions, advisorOptions] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
    canManageAdvisors ? getEligibleAdvisorOptions(payload, user) : Promise.resolve([]),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <ActivityForm
        action={createActivityFormAction}
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        advisorOptions={advisorOptions}
        canManageAdvisors={canManageAdvisors}
        submitLabel="Criar atividade"
        searchContacts={searchActivityContactOptions}
        searchLeaderships={searchActivityLeadershipOptionsAction}
      />
    </div>
  )
}
