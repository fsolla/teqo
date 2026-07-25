import config from '@payload-config'
import { PencilIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  CancelActionPlanDialog,
  MarkActionPlanRealizedDialog,
} from '@/components/campaign/actionPlan/ActionPlanLifecycleDialog'
import { ActionPlanStatusBadge } from '@/components/campaign/actionPlan/ActionPlanStatusBadge'
import { ActionPlanTabNav } from '@/components/campaign/actionPlan/ActionPlanTabNav'
import { ActionPlanTaskChecklist } from '@/components/campaign/actionPlan/ActionPlanTaskChecklist'
import { ActionPlanUpdateFeed } from '@/components/campaign/actionPlan/ActionPlanUpdateFeed'
import { ActionPlanUpdateForm } from '@/components/campaign/actionPlan/ActionPlanUpdateForm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPlanKindLabels } from '@/lib/schemas/actionPlan'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  ActionPlanNotFoundError,
  resolveAccessibleActionPlanContext,
} from '@/utilities/actionPlanPageData'
import { getActionPlanDetailPageData } from '@/utilities/actionPlanDetailPageData'
import {
  getActionPlanDetailTabRedirect,
  resolveActionPlanDetailTab,
} from '@/utilities/actionPlanDetailTabUi'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'

import { ActionPlanOverviewTab } from './ActionPlanOverviewTab'

type ActionPlanDetailPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ActionPlanDetailPage({
  params,
  searchParams,
}: ActionPlanDetailPageProps) {
  const [{ slug }, query, user, payload] = await Promise.all([
    params,
    searchParams,
    getCampaignUser(),
    getPayload({ config }),
  ])

  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')
  if (!slug) notFound()

  const activeTab = resolveActionPlanDetailTab(query)
  const context = await resolveAccessibleActionPlanContext(payload, user, slug, activeTab).catch(
    (error) => {
      if (error instanceof ActionPlanNotFoundError) notFound()
      throw error
    },
  )
  const view = await getActionPlanDetailPageData(payload, user, context, activeTab)
  const canonicalTabRedirect = getActionPlanDetailTabRedirect(view.slug, query)
  if (canonicalTabRedirect) redirect(canonicalTabRedirect)

  const isStaff = isCampaignStaff(user)
  const canManageLifecycle = isStaff && view.status !== 'realizado' && view.status !== 'cancelado'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
              <ActionPlanStatusBadge status={view.status} />
              {view.deputyPresent ? <Badge>Deputado presente</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <Badge variant="secondary">{actionPlanKindLabels[view.kind]}</Badge>
              <span>
                {view.startAt ? formatBahiaDateTimeLabel(view.startAt) : 'Data a definir'}
              </span>
              {view.locationLabel ? <span>· {view.locationLabel}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isStaff ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/campanha/planos/${view.slug}/editar`}>
                  <PencilIcon data-icon="inline-start" aria-hidden="true" />
                  Editar
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/campanha/planos/${view.slug}?tab=updates&newUpdate=1`}>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Nova atualização
              </Link>
            </Button>
            {canManageLifecycle ? (
              <>
                <MarkActionPlanRealizedDialog planId={view.id} />
                <CancelActionPlanDialog planId={view.id} />
              </>
            ) : null}
          </div>
        </div>
      </header>

      <ActionPlanTabNav activeTab={activeTab} planSlug={view.slug} searchParams={query} />

      {activeTab === 'overview' ? <ActionPlanOverviewTab view={view} isStaff={isStaff} /> : null}

      {activeTab === 'tasks' ? (
        <Card>
          <CardHeader>
            <CardTitle>Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionPlanTaskChecklist planId={view.id} tasks={view.tasks} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'updates' ? (
        <div className="flex flex-col gap-4">
          <ActionPlanUpdateForm planId={view.id} />
          <ActionPlanUpdateFeed updates={view.updates} />
        </div>
      ) : null}
    </div>
  )
}
