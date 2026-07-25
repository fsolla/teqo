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
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  buildStateDeputyListHref,
  loadStateDeputyListPageData,
  parseStateDeputyListParams,
  type StateDeputyRowViewModel,
} from '@/utilities/stateDeputyData'

type StateDeputiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const stateDeputyColumns: Array<CampaignTableColumn<StateDeputyRowViewModel>> = [
  {
    id: 'name',
    mandatory: true,
    head: <CampaignTableHead>Nome</CampaignTableHead>,
    cell: (row) => (
      <Link
        href={`/campanha/dobradinhas/${row.slug}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: 'party',
    head: <CampaignTableHead>Partido</CampaignTableHead>,
    cellClassName: 'text-muted-foreground',
    cell: (row) => row.party ?? '—',
  },
  {
    id: 'municipalities',
    head: <CampaignTableHead>Municípios</CampaignTableHead>,
    cellClassName: 'tabular-nums',
    cell: (row) => row.municipalityCount,
  },
  {
    id: 'leaderships',
    head: <CampaignTableHead>Lideranças</CampaignTableHead>,
    cellClassName: 'tabular-nums',
    cell: (row) => row.leadershipCount,
  },
]

export default async function StateDeputiesPage({ searchParams }: StateDeputiesPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const state = parseStateDeputyListParams(rawSearchParams)
  const { rows, totalDocs, totalPages } = await loadStateDeputyListPageData(payload, user, state)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Dobradinhas</h1>
          <p className="text-muted-foreground">
            Deputados estaduais com quem a campanha dobra — vincule a municípios e lideranças nas
            fichas correspondentes.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/dobradinhas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova dobradinha
          </Link>
        </Button>
      </header>

      <CampaignListPendingBoundary>
        <CampaignSearchForm
          ariaLabel="Buscar dobradinha por nome"
          placeholder="Buscar por nome…"
          initialQuery={state.q ?? ''}
          basePath="/campanha/dobradinhas"
        />

        <CampaignListResults>
          {rows.length ? (
            <>
              <CampaignTable columns={stateDeputyColumns} rows={rows} rowKey={(row) => row.id} />
              <CampaignListFooter
                totalDocs={totalDocs}
                singular="dobradinha"
                plural="dobradinhas"
                page={state.page}
                totalPages={totalPages}
                hrefForPage={(page) => buildStateDeputyListHref(state, page)}
              />
            </>
          ) : (
            <CampaignListEmptyState
              icon={SearchXIcon}
              title="Nenhuma dobradinha cadastrada"
              description="Cadastre deputados estaduais parceiros para vincular a municípios e lideranças."
            >
              <Button asChild className="min-h-11">
                <Link href="/campanha/dobradinhas/nova">
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  Nova dobradinha
                </Link>
              </Button>
            </CampaignListEmptyState>
          )}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
