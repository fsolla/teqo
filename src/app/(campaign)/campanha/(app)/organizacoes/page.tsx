import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { OfflineBoundary } from '@/components/campaign/opsSync/OfflineBoundary'
import { OpsListLocal } from '@/components/campaign/opsSync/OpsListLocal'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignSearchForm } from '@/components/campaign/shared/CampaignSearchForm'
import { CampaignTable, type CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { OpsListPage } from '@/components/campaign/shared/OpsListPage'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { resolveListUnifiedEnabled } from '@/lib/opsListRegistry/opsListFlag'
import { organizationKindLabels } from '@/lib/schemas/organization'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  buildOrganizationListHref,
  loadOrganizationListPageData,
  resolveOrganizationListUrl,
  type OrganizationRowViewModel,
} from '@/utilities/organizationData'

type OrganizationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const organizationColumns: Array<CampaignTableColumn<OrganizationRowViewModel>> = [
  {
    id: 'name',
    label: 'Nome',
    mandatory: true,
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
    label: 'Tipo',
    cell: (row) => <Badge variant="secondary">{organizationKindLabels[row.kind]}</Badge>,
  },
  {
    id: 'municipalities',
    label: 'Municípios de atuação',
    cellClassName: 'max-w-64 whitespace-normal text-muted-foreground',
    cell: (row) => row.municipalityNames.join(', ') || '—',
  },
  {
    id: 'leaderships',
    label: 'Lideranças',
    cellClassName: 'tabular-nums',
    cell: (row) => row.leadershipCount,
  },
]

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveOrganizationListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const { rows, totalDocs, totalPages } = await loadOrganizationListPageData(
    payload,
    user,
    canonicalUrl.state,
  )
  const resolvedUrl = resolveOrganizationListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl
  const columnVisibility = await readCampaignColumnVisibility('organizacoes')

  const toolbarNode = (
    <CampaignSearchForm
      ariaLabel="Buscar organização por nome"
      placeholder="Buscar por nome…"
      initialQuery={state.q ?? ''}
      basePath="/campanha/organizacoes"
      // Canonical serialization of the ACTIVE filters minus q/page, so a
      // search submit preserves `?kind=` instead of silently dropping it.
      filterParams={buildOrganizationListHref({ ...state, q: undefined }, 1).replace(
        /^\/campanha\/organizacoes\??/,
        '',
      )}
    />
  )

  const tableNode = (
    <CampaignTable
      columns={organizationColumns}
      columnVisibility={columnVisibility}
      rows={rows}
      rowKey={(row) => row.id}
      empty={
        <CampaignListEmptyState
          icon={SearchXIcon}
          title="Nenhuma organização cadastrada"
          description="Cadastre sindicatos, associações e movimentos para vincular lideranças e atividades."
        >
          <Button asChild className="min-h-11">
            <Link href="/campanha/organizacoes/nova">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Nova organização
            </Link>
          </Button>
        </CampaignListEmptyState>
      }
    />
  )

  const footerNode = rows.length ? (
    <CampaignListFooter
      totalDocs={totalDocs}
      singular="organização"
      plural="organizações"
      page={state.page}
      totalPages={totalPages}
      hrefForPage={(page) => buildOrganizationListHref(state, page)}
    />
  ) : null

  const main = resolveListUnifiedEnabled() ? (
    <OpsListPage
      overview={null}
      toolbar={toolbarNode}
      table={tableNode}
      empty={null}
      footer={footerNode}
    />
  ) : (
    <CampaignListPendingBoundary>
      {toolbarNode}
      <CampaignListResults>
        {tableNode}
        {footerNode}
      </CampaignListResults>
    </CampaignListPendingBoundary>
  )

  return (
    <CampaignPageShell>
      <OfflineBoundary fallback={<OpsListLocal slug="organizacoes" />}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Organizações</h1>
            <p className="text-muted-foreground">
              Sindicatos, associações e movimentos que apoiam a campanha — com suas lideranças e
              atividades.
            </p>
          </div>
          <Button asChild className="min-h-11">
            <Link href="/campanha/organizacoes/nova">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Nova organização
            </Link>
          </Button>
        </header>

        {main}
      </OfflineBoundary>
    </CampaignPageShell>
  )
}
