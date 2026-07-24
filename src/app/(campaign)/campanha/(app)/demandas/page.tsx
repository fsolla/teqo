import config from '@payload-config'
import { InboxIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignFilterChips } from '@/components/campaign/CampaignFilterChips'
import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/CampaignListPending'
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
import {
  campaignDemandKindLabels,
  campaignDemandStatusLabels,
  campaignDemandStatuses,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadDemandListPageData, parseDemandListParams } from '@/utilities/campaignDemandData'

type DemandsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const statusVariant: Record<
  CampaignDemandStatus,
  'secondary' | 'estimate-pending' | 'destructive' | 'estimate-confirmed'
> = {
  aberta: 'estimate-pending',
  em_analise: 'secondary',
  escalada: 'estimate-pending',
  aprovada: 'estimate-confirmed',
  rejeitada: 'destructive',
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

export default async function DemandsPage({ searchParams }: DemandsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const state = parseDemandListParams(rawSearchParams)
  const { rows, totalDocs, totalPages, openCount } = await loadDemandListPageData(
    payload,
    user,
    state,
  )

  const hrefFor = (status?: CampaignDemandStatus, page = 1) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (state.kind) params.set('kind', state.kind)
    if (page > 1) params.set('page', String(page))
    const query = params.toString()
    return query ? `/campanha/demandas?${query}` : '/campanha/demandas'
  }

  const listBody = rows.length ? (
    <>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Demanda</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Praça</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aberta em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-64 whitespace-normal">
                  <Link
                    href={`/campanha/demandas/${row.slug}`}
                    className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell>{campaignDemandKindLabels[row.kind]}</TableCell>
                <TableCell className="text-muted-foreground">{row.municipalityName}</TableCell>
                <TableCell className="text-muted-foreground">{row.requesterName ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[row.status]}>
                    {campaignDemandStatusLabels[row.status]}
                  </Badge>
                </TableCell>
                <TableCell>{dateFormatter.format(new Date(row.createdAt))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {totalDocs} {totalDocs === 1 ? 'demanda' : 'demandas'}
        </p>
        <CampaignListPagination
          page={state.page}
          totalPages={totalPages}
          hrefForPage={(page) => hrefFor(state.status, page)}
        />
      </div>
    </>
  ) : (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Nenhuma demanda por aqui</EmptyTitle>
        <EmptyDescription>
          Abra uma demanda quando precisar de material, transporte, espaço ou apoio para uma ação.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild className="min-h-11">
          <Link href="/campanha/demandas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova demanda
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Demandas</h1>
          <p className="text-muted-foreground">
            Necessidades da campanha abertas pelas lideranças, revisadas pela assessoria e — quando
            preciso — decididas pelo Coordenador Geral.
          </p>
          <Badge variant="estimate-pending" className="w-fit">
            {openCount} {openCount === 1 ? 'demanda em aberto' : 'demandas em aberto'}
          </Badge>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/demandas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova demanda
          </Link>
        </Button>
      </header>

      <CampaignListPendingBoundary>
        <CampaignFilterChips
          ariaLabel="Filtrar por status"
          chips={[
            { href: hrefFor(undefined), label: 'Todas', active: state.status === undefined },
            ...campaignDemandStatuses.map((status) => ({
              href: hrefFor(status),
              label: campaignDemandStatusLabels[status],
              active: state.status === status,
            })),
          ]}
        />

        <CampaignListResults>{listBody}</CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
