import config from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

import {
  searchActionPlanContactOptions,
  searchActionPlanLeadershipOptionsAction,
} from '@/app/(campaign)/campanha/(app)/planos/contactSearchActions'
import { createActionPlanFormAction } from '@/app/(campaign)/campanha/(app)/planos/formActions'
import { ActionPlanForm } from '@/components/campaign/ActionPlanForm'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { getEligibleNucleusCoordinatorOptions } from '@/utilities/nucleusCoordinatorOptions'

export default async function NewActionPlanPage() {
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) redirect('/campanha/login')
  if (user.role !== 'geral' && user.role !== 'coordenador') redirect('/campanha/planos')

  const coordinators = await getEligibleNucleusCoordinatorOptions(payload, user)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Planos de ação</p>
        <h1 className="text-2xl font-bold tracking-tight">Novo plano</h1>
        <p className="text-muted-foreground">
          Defina a ação, quando e onde ela acontece e quem responde por ela.
        </p>
      </header>
      <ActionPlanForm
        action={createActionPlanFormAction}
        coordinators={coordinators}
        canManageCoordinators={user.role === 'geral'}
        submitLabel="Criar plano"
        searchContacts={searchActionPlanContactOptions}
        searchLeaderships={searchActionPlanLeadershipOptionsAction}
      />
    </div>
  )
}
