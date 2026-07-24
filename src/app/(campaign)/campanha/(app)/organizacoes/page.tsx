import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/CampaignListPending'
import { CampaignSearchForm } from '@/components/campaign/CampaignSearchForm'
import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { organizationKindLabels } from '@/lib/schemas/organization'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  loadOrganizationListPageData,
  parseOrganizationListParams,
} from '@/utilities/organizationData'

type OrganizationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const state = parseOrganizationListParams(rawSearchParams)
  const { rows, totalDocs, totalPages } = await loadOrganizationListPageData(payload, user, state)

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams()
    if (state.q) params.set('q', state.q)
    if (state.kind) params.set('kind', state.kind)
    if (page > 1) params.set('page', String(page))
    const query = params.toString()
    return query ? `/campanha/organizacoes?${query}` : '/campanha/organizacoes'
  }

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
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Praças de atuação</TableHead>
                      <TableHead>Lideranças</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/campanha/organizacoes/${row.slug}`}
                            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{organizationKindLabels[row.kind]}</Badge>
                        </TableCell>
                        <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                          {row.municipalityNames.join(', ') || '—'}
                        </TableCell>
                        <TableCell className="tabular-nums">{row.leadershipCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {totalDocs} {totalDocs === 1 ? 'organização' : 'organizações'}
                </p>
                <CampaignListPagination
                  page={state.page}
                  totalPages={totalPages}
                  hrefForPage={hrefForPage}
                />
              </div>
            </>
          ) : (
            <Empty className="min-h-72 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Nenhuma organização cadastrada</EmptyTitle>
                <EmptyDescription>
                  Cadastre sindicatos, associações e movimentos para vincular lideranças e Planos de
                  Ação.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild className="min-h-11">
                  <Link href="/campanha/organizacoes/nova">
                    <PlusIcon data-icon="inline-start" aria-hidden="true" />
                    Nova organização
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
