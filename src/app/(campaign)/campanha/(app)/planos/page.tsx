import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { ActionPlanFilters } from '@/components/campaign/ActionPlanFilters'
import { ActionPlanList } from '@/components/campaign/ActionPlanList'
import { ActionPlanPagination } from '@/components/campaign/ActionPlanPagination'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import type { ActionPlan } from '@/payload-types'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadActionPlanListPageData } from '@/utilities/actionPlanPageData'
import { buildActionPlanFiltersKey, resolveActionPlanListUrl } from '@/utilities/actionPlanUi'
import { toActionPlanListViewModel } from '@/utilities/actionPlanViewModels'

type ActionPlanListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ActionPlanListPage({ searchParams }: ActionPlanListPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveActionPlanListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) return null

  const now = new Date()
  const { result, state } = await loadActionPlanListPageData(payload, user, rawSearchParams, now)
  const resolvedUrl = resolveActionPlanListUrl(rawSearchParams, result.totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)

  const canCreate = user.role === 'geral' || user.role === 'coordenador'

  return (
    <div className="mr-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Planos de ação</h1>
          <p className="text-muted-foreground">
            Organize caminhadas, comícios, panfletagens e demais ações de campanha.
          </p>
        </div>
        {canCreate ? (
          <Button asChild className="min-h-11">
            <Link href="/campanha/planos/novo">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Novo plano
            </Link>
          </Button>
        ) : null}
      </header>

      <ActionPlanFilters key={buildActionPlanFiltersKey(state)} state={state} />

      {result.docs.length ? (
        <>
          <ActionPlanList
            plans={result.docs.map((plan) => toActionPlanListViewModel(plan as ActionPlan))}
          />
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {result.totalDocs} {result.totalDocs === 1 ? 'plano encontrado' : 'planos encontrados'}
            </p>
            <ActionPlanPagination state={state} totalPages={result.totalPages} />
          </div>
        </>
      ) : (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Nenhum plano encontrado</EmptyTitle>
            <EmptyDescription>
              Ajuste os filtros ou a janela selecionada. Você só vê planos dentro do seu escopo.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/campanha/planos">Limpar filtros</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}
