import config from '@payload-config'
import { getPayload } from 'payload'
import { notFound, redirect } from 'next/navigation'

import {
  searchActionPlanContactOptions,
  searchActionPlanLeadershipOptionsAction,
} from '@/app/(campaign)/campanha/(app)/planos/contactSearchActions'
import { updateActionPlanFormAction } from '@/app/(campaign)/campanha/(app)/planos/formActions'
import { ActionPlanForm } from '@/components/campaign/ActionPlanForm'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  ActionPlanNotFoundError,
  getActionPlanEditPageData,
} from '@/utilities/actionPlanPageData'
import { getEligibleNucleusCoordinatorOptions } from '@/utilities/nucleusCoordinatorOptions'

type EditActionPlanPageProps = {
  params: Promise<{ slug: string }>
}

export default async function EditActionPlanPage({ params }: EditActionPlanPageProps) {
  const [{ slug }, user, payload] = await Promise.all([
    params,
    getCampaignUser(),
    getPayload({ config }),
  ])

  if (!user) redirect('/campanha/login')
  if (user.role === 'lideranca') redirect('/campanha/planos')
  if (!slug) notFound()

  const [view, coordinators] = await Promise.all([
    getActionPlanEditPageData(payload, user, slug).catch((error) => {
      if (error instanceof ActionPlanNotFoundError) notFound()
      throw error
    }),
    getEligibleNucleusCoordinatorOptions(payload, user),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Planos de ação</p>
        <h1 className="text-2xl font-semibold tracking-tight">Editar {view.title}</h1>
        <p className="text-muted-foreground">
          Atualize os detalhes do plano sem alterar o título original.
        </p>
      </header>
      <ActionPlanForm
        action={updateActionPlanFormAction}
        plan={view}
        coordinators={coordinators}
        canManageCoordinators={user.role === 'geral'}
        submitLabel="Salvar alterações"
        searchContacts={searchActionPlanContactOptions}
        searchLeaderships={searchActionPlanLeadershipOptionsAction}
      />
    </div>
  )
}
