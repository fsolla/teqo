import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { CampaignSearchForm } from '@/components/campaign/shared/CampaignSearchForm'
import {
  CampaignTable,
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  buildLeadershipListHref,
  loadLeadershipListPageData,
  parseLeadershipListParams,
  type LeadershipRowViewModel,
} from '@/utilities/leadershipData'

type LeadershipsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const leadershipColumns: Array<CampaignTableColumn<LeadershipRowViewModel>> = [
  {
    id: 'name',
    mandatory: true,
    head: <CampaignTableHead>Nome</CampaignTableHead>,
    cell: (row) => (
      <Link
        href={`/campanha/liderancas/${row.id}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: 'supportStatus',
    head: <CampaignTableHead>Status</CampaignTableHead>,
    cell: (row) => (row.supportStatus ? <SupportStatusBadge status={row.supportStatus} /> : '—'),
  },
  {
    id: 'municipalities',
    head: <CampaignTableHead>Municípios</CampaignTableHead>,
    cellClassName: 'max-w-64 whitespace-normal text-muted-foreground',
    cell: (row) => row.municipalityNames.join(', ') || '—',
  },
  {
    id: 'organizations',
    head: <CampaignTableHead>Organizações</CampaignTableHead>,
    cellClassName: 'max-w-56 whitespace-normal text-muted-foreground',
    cell: (row) => row.organizationNames.join(', ') || '—',
  },
  {
    id: 'appAccess',
    head: <CampaignTableHead>Acesso ao app</CampaignTableHead>,
    cell: (row) => (
      <Badge variant={row.hasAppAccess ? 'estimate-confirmed' : 'outline'}>
        {row.hasAppAccess ? 'Com acesso' : 'Sem acesso'}
      </Badge>
    ),
  },
]

export default async function LeadershipsPage({ searchParams }: LeadershipsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const state = parseLeadershipListParams(rawSearchParams)
  const { rows, totalDocs, totalPages } = await loadLeadershipListPageData(payload, user, state)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Lideranças</h1>
          <p className="text-muted-foreground">
            Uma ficha por pessoa — cada liderança pode atuar em vários municípios e organizações.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/liderancas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova liderança
          </Link>
        </Button>
      </header>

      <CampaignListPendingBoundary>
        <CampaignSearchForm
          ariaLabel="Buscar liderança por nome"
          placeholder="Buscar por nome…"
          initialQuery={state.q ?? ''}
          basePath="/campanha/liderancas"
        />

        <CampaignListResults>
          {rows.length ? (
            <>
              <CampaignTable columns={leadershipColumns} rows={rows} rowKey={(row) => row.id} />
              <CampaignListFooter
                totalDocs={totalDocs}
                singular="liderança"
                plural="lideranças"
                page={state.page}
                totalPages={totalPages}
                hrefForPage={(page) => buildLeadershipListHref(state, page)}
              />
            </>
          ) : (
            <CampaignListEmptyState
              icon={SearchXIcon}
              title="Nenhuma liderança encontrada"
              description="Cadastre a primeira liderança ou ajuste a busca. Você só vê lideranças dos seus municípios."
            >
              <Button asChild className="min-h-11">
                <Link href="/campanha/liderancas/nova">
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  Nova liderança
                </Link>
              </Button>
            </CampaignListEmptyState>
          )}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
