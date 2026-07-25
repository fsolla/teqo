import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListEmptyState } from '@/components/campaign/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { CampaignSearchForm } from '@/components/campaign/CampaignSearchForm'
import {
  CampaignTable,
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/CampaignTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { organizationKindLabels } from '@/lib/schemas/organization'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  buildOrganizationListHref,
  loadOrganizationListPageData,
  parseOrganizationListParams,
  type OrganizationRowViewModel,
} from '@/utilities/organizationData'

type OrganizationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const organizationColumns: Array<CampaignTableColumn<OrganizationRowViewModel>> = [
  {
    id: 'name',
    mandatory: true,
    head: <CampaignTableHead>Nome</CampaignTableHead>,
    cell: (row) => (
      <Link
        href={`/campanha/organizacoes/${row.slug}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: 'kind',
    head: <CampaignTableHead>Tipo</CampaignTableHead>,
    cell: (row) => <Badge variant="secondary">{organizationKindLabels[row.kind]}</Badge>,
  },
  {
    id: 'municipalities',
    head: <CampaignTableHead>Praças de atuação</CampaignTableHead>,
    cellClassName: 'max-w-64 whitespace-normal text-muted-foreground',
    cell: (row) => row.municipalityNames.join(', ') || '—',
  },
  {
    id: 'leaderships',
    head: <CampaignTableHead>Lideranças</CampaignTableHead>,
    cellClassName: 'tabular-nums',
    cell: (row) => row.leadershipCount,
  },
]

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const state = parseOrganizationListParams(rawSearchParams)
  const { rows, totalDocs, totalPages } = await loadOrganizationListPageData(payload, user, state)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Organizações</h1>
          <p className="text-muted-foreground">
            Sindicatos, associações e movimentos que apoiam a campanha — com suas lideranças e
            Planos de Ação.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/organizacoes/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova organização
          </Link>
        </Button>
      </header>

      <CampaignListPendingBoundary>
        <CampaignSearchForm
          ariaLabel="Buscar organização por nome"
          placeholder="Buscar por nome…"
          initialQuery={state.q ?? ''}
          basePath="/campanha/organizacoes"
        />

        <CampaignListResults>
          {rows.length ? (
            <>
              <CampaignTable columns={organizationColumns} rows={rows} rowKey={(row) => row.id} />
              <CampaignListFooter
                totalDocs={totalDocs}
                singular="organização"
                plural="organizações"
                page={state.page}
                totalPages={totalPages}
                hrefForPage={(page) => buildOrganizationListHref(state, page)}
              />
            </>
          ) : (
            <CampaignListEmptyState
              icon={SearchXIcon}
              title="Nenhuma organização cadastrada"
              description="Cadastre sindicatos, associações e movimentos para vincular lideranças e Planos de Ação."
            >
              <Button asChild className="min-h-11">
                <Link href="/campanha/organizacoes/nova">
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  Nova organização
                </Link>
              </Button>
            </CampaignListEmptyState>
          )}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
