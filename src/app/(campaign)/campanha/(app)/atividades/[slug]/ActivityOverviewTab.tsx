import { PlusIcon } from 'lucide-react'
import Link from 'next/link'

import { ActivityResultForm } from '@/components/campaign/activity/ActivityResultForm'
import { CampaignListPagination } from '@/components/campaign/shared/CampaignListPagination'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import { activityOriginLabels } from '@/lib/schemas/activity'
import { campaignDemandKindLabels, campaignDemandStatusLabels } from '@/lib/schemas/campaignDemand'
import type { getActivityDetailPageData } from '@/utilities/activityDetailPageData'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

type ActivityDetailView = Awaited<ReturnType<typeof getActivityDetailPageData>>

const hrefForLinkedDemandsPage = (activitySlug: string, page: number) => {
  const params = new URLSearchParams({ tab: 'overview' })
  if (page > 1) params.set('demandsPage', String(page))
  return `/campanha/atividades/${activitySlug}?${params.toString()}`
}

/** The "Visão geral" tab: details, team/orgs, linked demands and the result block. */
export const ActivityOverviewTab = ({
  view,
  isStaff,
}: {
  view: ActivityDetailView
  isStaff: boolean
}) => (
  <div className="flex flex-col gap-4">
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
              <dt className="text-muted-foreground">Município</dt>
              <dd>
                {view.municipality ? (
                  <Link
                    href={`/campanha/municipios/${view.municipality.slug}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {view.municipality.name}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Local</dt>
              <dd>{view.locality ?? '—'}</dd>
            </div>
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
            <div>
              <dt className="text-muted-foreground">Origem da atividade</dt>
              <dd>{activityOriginLabels[view.origin]}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipe e organizações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Assessores responsáveis</p>
            {view.advisors.length ? (
              <ul role="list" className="flex flex-col gap-1">
                {view.advisors.map((advisor) => (
                  <li key={advisor.id}>{advisor.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nenhum assessor vinculado.</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">Organizações apoiadoras</p>
            {view.organizations.length ? (
              <ul role="list" className="flex flex-wrap gap-1.5 pt-1">
                {view.organizations.map((organization) => (
                  <li key={organization.id}>
                    <Badge variant="outline">{organization.name}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nenhuma organização vinculada.</p>
            )}
          </div>
          <p className="text-muted-foreground">
            {view.taskProgress.done}/{view.taskProgress.total} tarefas concluídas
          </p>
          {view.createdByName ? (
            <p className="text-muted-foreground">Criado por {view.createdByName}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Demandas vinculadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Custo estimado: {currencyFormatter.format(view.demandCostTotal)}
            {view.totalDocs > 0 ? (
              <>
                {' '}
                · {view.totalDocs} {view.totalDocs === 1 ? 'demanda' : 'demandas'}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {view.totalDocs > view.demands.length ? (
            <Button asChild variant="ghost" className="min-h-11">
              <Link href={`/campanha/demandas?activity=${view.id}`}>Ver todas</Link>
            </Button>
          ) : null}
          {view.municipality ? (
            <Button asChild variant="outline" className="min-h-11 shrink-0">
              <Link
                href={`/campanha/demandas/nova?activity=${view.id}&municipality=${view.municipality.id}`}
              >
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Adicionar demanda
              </Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {view.demands.length ? (
          <>
            <ul role="list" className="divide-y">
              {view.demands.map((demand) => (
                <li
                  key={demand.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/campanha/demandas/${demand.slug}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {demand.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {campaignDemandKindLabels[demand.kind]} ·{' '}
                      {campaignDemandStatusLabels[demand.status]}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {demand.cost == null
                      ? 'Custo não registrado'
                      : currencyFormatter.format(demand.cost)}
                  </span>
                </li>
              ))}
            </ul>
            <CampaignListPagination
              page={view.page}
              totalPages={view.totalPages}
              hrefForPage={(page) => hrefForLinkedDemandsPage(view.slug, page)}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma demanda vinculada a esta atividade.
          </p>
        )}
      </CardContent>
    </Card>

    {view.status === 'realizado' && isStaff ? (
      <ActivityResultForm
        activityId={view.id}
        initialSummary={view.result?.summary ?? null}
        recordedByName={view.result?.recordedByName ?? null}
        recordedAt={view.result?.recordedAt ?? null}
      />
    ) : view.result ? (
      <Card>
        <CardHeader>
          <CardTitle>Resultado da atividade</CardTitle>
          <p className="text-sm text-muted-foreground">
            {[
              view.result.recordedByName
                ? `Registrado por ${view.result.recordedByName}`
                : 'Registrado',
              view.result.recordedAt
                ? `em ${formatBahiaDateTimeLabel(view.result.recordedAt)}`
                : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </p>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{view.result.summary}</p>
        </CardContent>
      </Card>
    ) : null}
  </div>
)
