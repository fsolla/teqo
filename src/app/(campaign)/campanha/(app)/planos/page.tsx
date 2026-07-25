import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { ActionPlanFilters } from '@/components/campaign/actionPlan/ActionPlanFilters'
import { ActionPlanList } from '@/components/campaign/actionPlan/ActionPlanList'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import type { ActionPlan } from '@/payload-types'
import { loadActionPlanListPageData } from '@/utilities/actionPlanPageData'
import {
  buildActionPlanFiltersKey,
  buildActionPlanListHref,
  resolveActionPlanListUrl,
} from '@/utilities/actionPlanUi'
import { toActionPlanListViewModel } from '@/utilities/actionPlanViewModels'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'

type ActionPlanListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ActionPlanListPage({ searchParams }: ActionPlanListPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveActionPlanListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) return null
  if (!isCampaignStaff(user)) redirect('/campanha')

  const now = new Date()
  const [{ result, state }, municipalityOptions] = await Promise.all([
    loadActionPlanListPageData(payload, user, rawSearchParams, now),
    loadMunicipalityOptions(payload, user),
  ])
  const resolvedUrl = resolveActionPlanListUrl(rawSearchParams, result.totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)

  const canCreate = isCampaignStaff(user)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Planos de ação</h1>
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

      <CampaignListPendingBoundary>
        <ActionPlanFilters
          key={buildActionPlanFiltersKey(state)}
          state={state}
          municipalityOptions={municipalityOptions}
        />

        <CampaignListResults>
          {result.docs.length ? (
            <>
              <ActionPlanList
                plans={result.docs.map((plan) => toActionPlanListViewModel(plan as ActionPlan))}
              />
              <CampaignListFooter
                totalDocs={result.totalDocs}
                singular="plano encontrado"
                plural="planos encontrados"
                page={state.page}
                totalPages={result.totalPages}
                hrefForPage={(page) => buildActionPlanListHref(state, page)}
              />
            </>
          ) : (
            <CampaignListEmptyState
              icon={SearchXIcon}
              title="Nenhum plano encontrado"
              description="Ajuste os filtros ou a janela selecionada. Você só vê planos dentro do seu escopo."
            >
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/campanha/planos">Limpar filtros</Link>
              </Button>
            </CampaignListEmptyState>
          )}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
