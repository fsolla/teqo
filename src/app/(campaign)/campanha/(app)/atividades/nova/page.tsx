import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  searchActivityContactOptions,
  searchActivityLeadershipOptionsAction,
} from '@/app/(campaign)/campanha/(app)/atividades/contactSearchActions'
import { createActivityFormAction } from '@/app/(campaign)/campanha/(app)/atividades/formActions'
import { ActivityForm } from '@/components/campaign/activity/ActivityForm'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
} from '@/utilities/campaignRelationOptions'
import { getEligibleAdvisorOptions } from '@/utilities/municipalityViewModels'

export default async function NewActivityPage() {
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha/atividades')

  const canManageAdvisors = user.role === 'coordinator'
  const [municipalityOptions, organizationOptions, advisorOptions] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
    canManageAdvisors ? getEligibleAdvisorOptions(payload, user) : Promise.resolve([]),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Atividades</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nova atividade</h1>
        <p className="text-muted-foreground">
          Defina a ação, quando e onde ela acontece e quem responde por ela.
        </p>
      </header>
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
