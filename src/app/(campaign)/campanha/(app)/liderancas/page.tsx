import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { SupportStatusBadge } from '@/components/campaign/SupportStatusBadge'
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
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadLeadershipListPageData, parseLeadershipListParams } from '@/utilities/leadershipData'

type LeadershipsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LeadershipsPage({ searchParams }: LeadershipsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const state = parseLeadershipListParams(rawSearchParams)
  const { rows, totalDocs, totalPages } = await loadLeadershipListPageData(payload, user, state)

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams()
    if (state.q) params.set('q', state.q)
    if (page > 1) params.set('page', String(page))
    const query = params.toString()
    return query ? `/campanha/liderancas?${query}` : '/campanha/liderancas'
  }

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Lideranças</h1>
          <p className="text-muted-foreground">
            Uma ficha por pessoa — cada liderança pode atuar em várias Praças e organizações.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/liderancas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova liderança
          </Link>
        </Button>
      </header>

      <form role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={state.q ?? ''}
          placeholder="Buscar por nome…"
          aria-label="Buscar liderança por nome"
          className="min-h-11 w-full max-w-md rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/30"
        />
        <Button type="submit" variant="secondary" className="min-h-11">
          Buscar
        </Button>
      </form>

      {rows.length ? (
        <>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Praças</TableHead>
                  <TableHead>Organizações</TableHead>
                  <TableHead>Acesso ao app</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/campanha/liderancas/${row.id}`}
                        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.supportStatus ? <SupportStatusBadge status={row.supportStatus} /> : '—'}
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                      {row.municipalityNames.join(', ') || '—'}
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                      {row.organizationNames.join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.hasAppAccess ? 'estimate-confirmed' : 'outline'}>
                        {row.hasAppAccess ? 'Com acesso' : 'Sem acesso'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {totalDocs} {totalDocs === 1 ? 'liderança' : 'lideranças'}
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
            <EmptyTitle>Nenhuma liderança encontrada</EmptyTitle>
            <EmptyDescription>
              Cadastre a primeira liderança ou ajuste a busca. Você só vê lideranças das suas
              Praças.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild className="min-h-11">
              <Link href="/campanha/liderancas/nova">
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Nova liderança
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </CampaignPageShell>
  )
}
