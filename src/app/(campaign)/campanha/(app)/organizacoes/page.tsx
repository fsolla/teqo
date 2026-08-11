import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { OrganizationFilters } from '@/components/campaign/organization/OrganizationFilters'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignTable, type CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { toCampaignColumnPickerColumns } from '@/lib/campaignColumnVisibility'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { organizationKindLabels } from '@/lib/schemas/organization'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  buildOrganizationListHref,
  loadOrganizationListPageData,
  parseOrganizationListParams,
  type OrganizationRowViewModel,
} from '@/utilities/organizationData'

export const metadata = campaignPageMetadataFromCatalog('organizacoes')

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
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const state = parseOrganizationListParams(rawSearchParams)
  const { rows, totalDocs, totalPages } = await loadOrganizationListPageData(payload, user, state)
  const columnVisibility = await readCampaignColumnVisibility('organizacoes')

  return (
    <CampaignPageShell>
      <div className="flex justify-end pt-4 md:pt-0">
        <Button asChild className="min-h-11">
          <Link href="/campanha/organizacoes/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova organização
          </Link>
        </Button>
      </div>

      <CampaignListPendingBoundary>
        <OrganizationFilters
          state={state}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={toCampaignColumnPickerColumns(organizationColumns)}
            />
          }
        />

        <CampaignListResults>
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
          {rows.length ? (
            <CampaignListFooter
              totalDocs={totalDocs}
              singular="organização"
              plural="organizações"
              page={state.page}
              totalPages={totalPages}
              hrefForPage={(page) => buildOrganizationListHref(state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
