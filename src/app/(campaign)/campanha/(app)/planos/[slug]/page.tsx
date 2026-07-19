import config from '@payload-config'
import { PencilIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  CancelActionPlanDialog,
  MarkActionPlanRealizedDialog,
} from '@/components/campaign/ActionPlanLifecycleDialog'
import { ActionPlanStatusBadge } from '@/components/campaign/ActionPlanStatusBadge'
import { ActionPlanTabNav } from '@/components/campaign/ActionPlanTabNav'
import { ActionPlanTaskChecklist } from '@/components/campaign/ActionPlanTaskChecklist'
import { ActionPlanUpdateFeed } from '@/components/campaign/ActionPlanUpdateFeed'
import { ActionPlanUpdateForm } from '@/components/campaign/ActionPlanUpdateForm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPlanKindLabels } from '@/lib/schemas/actionPlan'
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

  const canEdit = user.role === 'geral' || user.role === 'coordenador'
  const canManageLifecycle =
    canEdit && view.status !== 'realizado' && view.status !== 'cancelado'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
              <ActionPlanStatusBadge status={view.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <Badge variant="secondary">{actionPlanKindLabels[view.kind]}</Badge>
              <span>
                {view.startAt ? formatBahiaDateTimeLabel(view.startAt) : 'Data a definir'}
              </span>
              {view.territoryLabel ? <span>· {view.territoryLabel}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
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

      {activeTab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {view.description ? (
                <p className="whitespace-pre-wrap">{view.description}</p>
              ) : (
                <p className="text-muted-foreground">Sem descrição.</p>
              )}
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Início</dt>
                  <dd>{view.startAt ? formatBahiaDateTimeLabel(view.startAt) : 'A definir'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Término</dt>
                  <dd>{view.endAt ? formatBahiaDateTimeLabel(view.endAt) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Prazo de conclusão</dt>
                  <dd>{view.deadline ? formatBahiaDateTimeLabel(view.deadline) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Responsável</dt>
                  <dd>{view.responsibleName ?? 'Não definido'}</dd>
                </div>
              </dl>
              {view.territoryNotes ? (
                <div>
                  <p className="text-muted-foreground">Observações do território</p>
                  <p className="whitespace-pre-wrap">{view.territoryNotes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coordenação</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {view.coordinators.length ? (
                <ul role="list" className="flex flex-col gap-1">
                  {view.coordinators.map((coordinator) => (
                    <li key={coordinator.id}>{coordinator.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Nenhum coordenador vinculado.</p>
              )}
              <p className="text-muted-foreground">
                {view.taskProgress.done}/{view.taskProgress.total} tarefas concluídas
              </p>
              {view.createdByName ? (
                <p className="text-muted-foreground">Criado por {view.createdByName}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

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
