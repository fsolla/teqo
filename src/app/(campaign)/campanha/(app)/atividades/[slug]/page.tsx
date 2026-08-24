import config from '@payload-config'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { ActivityEditOverlayHost } from '@/components/campaign/activity/ActivityEditOverlayHost'
import {
  CancelActivityDialog,
  MarkActivityRealizedDialog,
} from '@/components/campaign/activity/ActivityLifecycleDialog'
import { ActivityStatusBadge } from '@/components/campaign/activity/ActivityStatusBadge'
import { ActivityTabNav } from '@/components/campaign/activity/ActivityTabNav'
import { ActivityTaskChecklist } from '@/components/campaign/activity/ActivityTaskChecklist'
import { ActivityUpdateFeed } from '@/components/campaign/activity/ActivityUpdateFeed'
import { ActivityUpdateForm } from '@/components/campaign/activity/ActivityUpdateForm'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignQuickActionContextBridge } from '@/components/campaign/shell/CampaignQuickActionContextBridge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { loadAccessibleActivityTags } from '@/utilities/activityPageData'
import { formatActivityWhenLabel } from '@/utilities/activityViewModels'
import {
  loadOrganizationOptions,
  loadWritableMunicipalityOptions,
} from '@/utilities/campaignRelationOptions'

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
import { firstValue, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

import { ActivityOverviewTab } from './ActivityOverviewTab'

export async function generateMetadata({ params }: ActivityDetailPageProps) {
  const { slug } = await params
  if (!slug) return campaignPageMetadata({ title: 'Atividade' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  try {
    const activeTab = 'overview' as const
    const context = await resolveAccessibleActivityContext(payload, user, slug, activeTab)
    const view = await getActivityDetailPageData(payload, user, context, activeTab, 1)
    const subtitle = view.locationLabel || view.municipality?.name
    return campaignPageMetadata(subtitle ? { title: view.title, subtitle } : { title: view.title })
  } catch {
    return campaignPageMetadata({ title: 'Atividade' })
  }
}

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
  const view = await getActivityDetailPageData(
    payload,
    user,
    context,
    activeTab,
    strictDecimalInteger(firstValue(query.demandsPage)) ?? 1,
  )
  const canonicalTabRedirect = getActivityDetailTabRedirect(view.slug, query)
  if (canonicalTabRedirect) redirect(canonicalTabRedirect)

  const [municipalityOptions, organizationOptions, knownTags] = await Promise.all([
    loadWritableMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
    loadAccessibleActivityTags(payload, user),
  ])

  const isStaff = isCampaignStaff(user)
  const canManageLifecycle = isStaff && view.status !== 'realizado' && view.status !== 'cancelado'
  const chromeSubtitle = view.locationLabel || view.municipality?.name

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <SetCampaignPageChrome
        chrome={
          chromeSubtitle ? { title: view.title, subtitle: chromeSubtitle } : { title: view.title }
        }
      />
      {/* C123 — must stay ABOVE ActivityEditOverlayHost: the bridge replaces
          the whole context, the host merges `openActivityEdit` on top. */}
      <CampaignQuickActionContextBridge
        activitySlug={view.slug}
        municipalitySlug={view.municipality?.slug}
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ActivityStatusBadge status={view.status} />
          {view.deputyPresent ? <Badge>Deputado presente</Badge> : null}
          {view.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
          <span className="text-muted-foreground">
            {view.startAt
              ? formatActivityWhenLabel(view.startAt, { allDay: view.allDay, endAt: view.endAt })
              : 'Data a definir'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStaff ? (
            <ActivityEditOverlayHost
              activityId={view.id}
              municipalityOptions={municipalityOptions}
              organizationOptions={organizationOptions}
              knownTags={knownTags}
            />
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
