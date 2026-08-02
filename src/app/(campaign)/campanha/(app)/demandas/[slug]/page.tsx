import config from '@payload-config'
import { ArrowLeftIcon, PaperclipIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { DemandWorkflowCard } from '@/components/campaign/demand/DemandWorkflowCard'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { CampaignQuickActionContextSync } from '@/components/campaign/shell/CampaignQuickActionContextSync'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  campaignDemandKindLabels,
  campaignDemandStatusLabels,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { loadDemandDetail } from '@/utilities/campaignDemandData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { attachDemandReceiptFormAction, setDemandCostFormAction } from './formActions'

type DemandDetailPageProps = {
  params: Promise<{ slug: string }>
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

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default async function DemandDetailPage({ params }: DemandDetailPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const demand = await loadDemandDetail(payload, user, slug)
  if (!demand) notFound()

  return (
    <CampaignPageShell>
      <CampaignQuickActionContextSync
        municipalitySlug={demand.municipalitySlug}
        municipalityId={demand.municipalityId > 0 ? demand.municipalityId : undefined}
        demandSlug={demand.slug}
      />
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/demandas">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para demandas
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{demand.title}</h1>
          <Badge variant={statusVariant[demand.status]}>
            {campaignDemandStatusLabels[demand.status]}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          {campaignDemandKindLabels[demand.kind]} ·{' '}
          <Link
            href={`/campanha/municipios/${demand.municipalitySlug}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {demand.municipalityName}
          </Link>
          {demand.activity ? (
            <>
              {' '}
              · Atividade:{' '}
              <Link
                href={`/campanha/atividades/${demand.activity.slug}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {demand.activity.title}
              </Link>
            </>
          ) : null}
          {demand.requesterName ? ` · Solicitada por ${demand.requesterName}` : ''} · Aberta em{' '}
          {dateTimeFormatter.format(new Date(demand.createdAt))}
        </p>
      </header>

      {demand.description ? (
        <section aria-label="Descrição da demanda" className="rounded-xl border p-4">
          <p className="whitespace-pre-wrap text-sm">{demand.description}</p>
        </section>
      ) : null}

      {demand.decisionNote && (demand.status === 'aprovada' || demand.status === 'rejeitada') ? (
        <section aria-label="Decisão" className="rounded-xl border p-4">
          <h2 className="text-sm font-medium">Nota da decisão</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {demand.decisionNote}
          </p>
          {demand.decidedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Decidida em {dateTimeFormatter.format(new Date(demand.decidedAt))}
            </p>
          ) : null}
        </section>
      ) : null}

      <DemandWorkflowCard
        demandID={demand.id}
        status={demand.status}
        canDecideEscalated={isCampaignUnrestricted(user)}
        currentCost={demand.cost}
        updatedAt={demand.updatedAt}
        costFormAction={setDemandCostFormAction}
        receiptFormAction={attachDemandReceiptFormAction}
      />

      <section
        aria-labelledby="demand-internal-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <h2 id="demand-internal-title" className="text-base font-medium">
          Controle interno
        </h2>
        <p className="text-sm text-muted-foreground">
          Custo: {demand.cost != null ? currencyFormatter.format(demand.cost) : 'não registrado'}
        </p>
        {demand.receipts.length ? (
          <ul className="flex flex-col gap-1">
            {demand.receipts.map((receipt) => (
              <li key={receipt.id} className="flex items-center gap-2 text-sm">
                <PaperclipIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                {receipt.url ? (
                  <a
                    href={receipt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {receipt.filename ?? `Comprovante ${receipt.id}`}
                  </a>
                ) : (
                  <span>{receipt.filename ?? `Comprovante ${receipt.id}`}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum comprovante anexado.</p>
        )}
        {demand.statusHistory.length ? (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Histórico</h3>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {demand.statusHistory.map((entry, index) => (
                <li key={`${entry.status}-${index}`}>
                  {campaignDemandStatusLabels[entry.status]}
                  {entry.authorName ? ` — ${entry.authorName}` : ''}
                  {entry.createdAt
                    ? ` · ${dateTimeFormatter.format(new Date(entry.createdAt))}`
                    : ''}
                  {entry.note ? ` · ${entry.note}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </CampaignPageShell>
  )
}
