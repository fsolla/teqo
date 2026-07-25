import config from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

import {
  searchActionPlanContactOptions,
  searchActionPlanLeadershipOptionsAction,
} from '@/app/(campaign)/campanha/(app)/planos/contactSearchActions'
import { createActionPlanFormAction } from '@/app/(campaign)/campanha/(app)/planos/formActions'
import { ActionPlanForm } from '@/components/campaign/actionPlan/ActionPlanForm'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadOrganizationOptions, loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { getEligibleAdvisorOptions } from '@/utilities/municipalityViewModels'

export default async function NewActionPlanPage() {
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha/planos')

  const canManageAdvisors = user.role === 'coordinator'
  const [municipalityOptions, organizationOptions, advisorOptions] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
    canManageAdvisors ? getEligibleAdvisorOptions(payload, user) : Promise.resolve([]),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Planos de ação</p>
        <h1 className="text-2xl font-semibold tracking-tight">Novo plano</h1>
        <p className="text-muted-foreground">
          Defina a ação, quando e onde ela acontece e quem responde por ela.
        </p>
      </header>
      <ActionPlanForm
        action={createActionPlanFormAction}
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        advisorOptions={advisorOptions}
        canManageAdvisors={canManageAdvisors}
        submitLabel="Criar plano"
        searchContacts={searchActionPlanContactOptions}
        searchLeaderships={searchActionPlanLeadershipOptionsAction}
      />
    </div>
  )
}
