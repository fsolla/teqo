import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import {
  searchActivityContactOptions,
  searchActivityLeadershipOptionsAction,
} from '@/app/(campaign)/campanha/(app)/atividades/contactSearchActions'
import { updateActivityFormAction } from '@/app/(campaign)/campanha/(app)/atividades/formActions'
import { ActivityForm } from '@/components/campaign/activity/ActivityForm'
import { ActivityNotFoundError, getActivityEditPageData } from '@/utilities/activityPageData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
} from '@/utilities/campaignRelationOptions'
import { getEligibleAdvisorOptions } from '@/utilities/municipality/municipalityViewModels'

type EditActivityPageProps = {
  params: Promise<{ slug: string }>
}

export default async function EditActivityPage({ params }: EditActivityPageProps) {
  const [{ slug }, user, payload] = await Promise.all([
    params,
    requireCampaignPageActor({ gate: 'staff', redirectTo: '/campanha/atividades' }),
    getPayload({ config }),
  ])
  if (!slug) notFound()

  const canManageAdvisors = user.role === 'coordinator'
  const [view, municipalityOptions, organizationOptions, advisorOptions] = await Promise.all([
    getActivityEditPageData(payload, user, slug).catch((error) => {
      if (error instanceof ActivityNotFoundError) notFound()
      throw error
    }),
    loadMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
    canManageAdvisors ? getEligibleAdvisorOptions(payload, user) : Promise.resolve([]),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Atividades</p>
        <h1 className="text-2xl font-semibold tracking-tight">Editar {view.title}</h1>
        <p className="text-muted-foreground">
          Atualize os detalhes da atividade sem alterar o título original.
        </p>
      </header>
      <ActivityForm
        action={updateActivityFormAction}
        activity={view}
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        advisorOptions={advisorOptions}
        canManageAdvisors={canManageAdvisors}
        submitLabel="Salvar alterações"
        searchContacts={searchActivityContactOptions}
        searchLeaderships={searchActivityLeadershipOptionsAction}
      />
    </div>
  )
}
