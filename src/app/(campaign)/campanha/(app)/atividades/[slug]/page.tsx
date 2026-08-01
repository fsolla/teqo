import config from '@payload-config'
import { PencilIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  CancelActivityDialog,
  MarkActivityRealizedDialog,
} from '@/components/campaign/activity/ActivityLifecycleDialog'
import { ActivityStatusBadge } from '@/components/campaign/activity/ActivityStatusBadge'
import { ActivityTabNav } from '@/components/campaign/activity/ActivityTabNav'
import { ActivityTaskChecklist } from '@/components/campaign/activity/ActivityTaskChecklist'
import { ActivityUpdateFeed } from '@/components/campaign/activity/ActivityUpdateFeed'
import { ActivityUpdateForm } from '@/components/campaign/activity/ActivityUpdateForm'
import { CampaignQuickActionContextBridge } from '@/components/campaign/shell/CampaignQuickActionContextBridge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import { activityKindLabels } from '@/lib/schemas/activity'
import { getActivityDetailPageData } from '@/utilities/activityDetailPageData'
import {
  getActivityDetailTabRedirect,
  resolveActivityDetailTab,
} from '@/utilities/activityDetailTabUi'
import {
  ActivityNotFoundError,
  resolveAccessibleActivityContext,
} from '@/utilities/activityPageData'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

import { ActivityOverviewTab } from './ActivityOverviewTab'

type ActivityDetailPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ActivityDetailPage({
  params,
  searchParams,
}: ActivityDetailPageProps) {
  const [{ slug }, query, user, payload] = await Promise.all([
    params,
    searchParams,
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])
  if (!slug) notFound()

  const activeTab = resolveActivityDetailTab(query)
  const context = await resolveAccessibleActivityContext(payload, user, slug, activeTab).catch(
    (error) => {
      if (error instanceof ActivityNotFoundError) notFound()
      throw error
    },
  )
  const view = await getActivityDetailPageData(payload, user, context, activeTab)
  const canonicalTabRedirect = getActivityDetailTabRedirect(view.slug, query)
  if (canonicalTabRedirect) redirect(canonicalTabRedirect)

  const isStaff = isCampaignStaff(user)
  const canManageLifecycle = isStaff && view.status !== 'realizado' && view.status !== 'cancelado'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <CampaignQuickActionContextBridge
        activitySlug={view.slug}
        municipalitySlug={view.municipality?.slug}
      />
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
              <ActivityStatusBadge status={view.status} />
              {view.deputyPresent ? <Badge>Deputado presente</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <Badge variant="secondary">{activityKindLabels[view.kind]}</Badge>
              <span>
                {view.startAt ? formatBahiaDateTimeLabel(view.startAt) : 'Data a definir'}
              </span>
              {view.locationLabel ? <span>· {view.locationLabel}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isStaff ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/campanha/atividades/${view.slug}/editar`}>
                  <PencilIcon data-icon="inline-start" aria-hidden="true" />
                  Editar
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/campanha/atividades/${view.slug}?tab=updates&newUpdate=1`}>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Nova atualização
              </Link>
            </Button>
            {canManageLifecycle ? (
              <>
                <MarkActivityRealizedDialog activityId={view.id} />
                <CancelActivityDialog activityId={view.id} />
              </>
            ) : null}
          </div>
        </div>
      </header>

      <ActivityTabNav activeTab={activeTab} activitySlug={view.slug} searchParams={query} />

      {activeTab === 'overview' ? <ActivityOverviewTab view={view} isStaff={isStaff} /> : null}

      {activeTab === 'tasks' ? (
        <Card>
          <CardHeader>
            <CardTitle>Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTaskChecklist activityId={view.id} tasks={view.tasks} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'updates' ? (
        <div className="flex flex-col gap-4">
          <ActivityUpdateForm activityId={view.id} />
          <ActivityUpdateFeed updates={view.updates} />
        </div>
      ) : null}
    </div>
  )
}
