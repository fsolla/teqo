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
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  loadStateDeputyListPageData,
  parseStateDeputyListParams,
} from '@/utilities/stateDeputyData'

type StateDeputiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StateDeputiesPage({ searchParams }: StateDeputiesPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const state = parseStateDeputyListParams(rawSearchParams)
  const { rows, totalDocs, totalPages } = await loadStateDeputyListPageData(payload, user, state)

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams()
    if (state.q) params.set('q', state.q)
    if (page > 1) params.set('page', String(page))
    const query = params.toString()
    return query ? `/campanha/dobradinhas?${query}` : '/campanha/dobradinhas'
  }

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
          hrefForQuery={(query) =>
            query ? `/campanha/dobradinhas?q=${encodeURIComponent(query)}` : '/campanha/dobradinhas'
          }
        />

        <CampaignListResults>
          {rows.length ? (
            <>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Partido</TableHead>
                      <TableHead>Municípios</TableHead>
                      <TableHead>Lideranças</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/campanha/dobradinhas/${row.slug}`}
                            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.party ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">{row.municipalityCount}</TableCell>
                        <TableCell className="tabular-nums">{row.leadershipCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {totalDocs} {totalDocs === 1 ? 'dobradinha' : 'dobradinhas'}
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
                <EmptyTitle>Nenhuma dobradinha cadastrada</EmptyTitle>
                <EmptyDescription>
                  Cadastre deputados estaduais parceiros para vincular a municípios e lideranças.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild className="min-h-11">
                  <Link href="/campanha/dobradinhas/nova">
                    <PlusIcon data-icon="inline-start" aria-hidden="true" />
                    Nova dobradinha
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
