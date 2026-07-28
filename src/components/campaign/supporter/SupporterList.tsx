import { PhoneIcon } from 'lucide-react'
import Link from 'next/link'

import { CampaignTable, type CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CampaignColumnVisibility } from '@/lib/campaignColumnVisibility'
import { formatBrazilianPhoneInput } from '@/lib/phone'
import { supporterVoteIntentionLabels } from '@/utilities/supporterUi'
import type { SupporterListItemViewModel } from '@/utilities/supporterViewModels'

export type SupporterListProps = {
  supporters: SupporterListItemViewModel[]
  columnVisibility: CampaignColumnVisibility
}

const voteIntentionBadgeVariant = (
  voteIntention: SupporterListItemViewModel['voteIntention'],
): 'estimate-confirmed' | 'estimate-pending' | 'secondary' | 'outline' => {
  if (voteIntention === 'certo' || voteIntention === 'tende_a_certo') return 'estimate-confirmed'
  if (voteIntention === 'indeciso') return 'estimate-pending'
  if (voteIntention === 'outro') return 'secondary'
  return 'outline'
}

const SupporterCard = ({ supporter }: { supporter: SupporterListItemViewModel }) => {
  const voteIntentionLabel = supporter.voteIntention
    ? supporterVoteIntentionLabels[supporter.voteIntention]
    : null

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">
            <Link
              href={`/campanha/apoiadores/${supporter.id}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {supporter.name}
            </Link>
          </CardTitle>
          {voteIntentionLabel ? (
            <Badge variant={voteIntentionBadgeVariant(supporter.voteIntention)}>
              {voteIntentionLabel}
            </Badge>
          ) : (
            <Badge variant="outline">Sem intenção</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{supporter.city ?? 'Cidade não informada'}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          {supporter.municipalityName ? (
            <Link
              href={`/campanha/municipios/${supporter.municipalitySlug}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {supporter.municipalityName}
            </Link>
          ) : (
            <span className="text-muted-foreground">Sem município vinculado</span>
          )}
        </p>
        {supporter.phone ? (
          <p className="flex items-center gap-2 text-sm tabular-nums">
            <PhoneIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {formatBrazilianPhoneInput(supporter.phone)}
          </p>
        ) : null}
        <Button asChild variant="outline" className="min-h-11 w-full">
          <Link href={`/campanha/apoiadores/${supporter.id}`}>Abrir ficha</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

const supporterColumns: Array<CampaignTableColumn<SupporterListItemViewModel>> = [
  {
    id: 'name',
    label: 'Nome',
    mandatory: true,
    cellClassName: 'max-w-52 whitespace-normal',
    cell: (supporter) => (
      <Link
        href={`/campanha/apoiadores/${supporter.id}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {supporter.name}
      </Link>
    ),
  },
  {
    id: 'city',
    label: 'Cidade',
    cell: (supporter) => supporter.city ?? '—',
  },
  {
    id: 'municipality',
    label: 'Município',
    cellClassName: 'max-w-48 whitespace-normal',
    cell: (supporter) =>
      supporter.municipalityName ? (
        <Link
          href={`/campanha/municipios/${supporter.municipalitySlug}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {supporter.municipalityName}
        </Link>
      ) : (
        <span className="text-muted-foreground">Sem município vinculado</span>
      ),
  },
  {
    id: 'voteIntention',
    label: 'Intenção',
    cell: (supporter) => {
      const voteIntentionLabel = supporter.voteIntention
        ? supporterVoteIntentionLabels[supporter.voteIntention]
        : null
      return voteIntentionLabel ? (
        <Badge variant={voteIntentionBadgeVariant(supporter.voteIntention)}>
          {voteIntentionLabel}
        </Badge>
      ) : (
        <Badge variant="outline">Sem intenção</Badge>
      )
    },
  },
  {
    id: 'phone',
    label: 'Telefone',
    cellClassName: 'tabular-nums',
    cell: (supporter) => (supporter.phone ? formatBrazilianPhoneInput(supporter.phone) : '—'),
  },
]

export const SupporterList = ({ supporters, columnVisibility }: SupporterListProps) => (
  <>
    <div data-view="mobile-cards" className="flex flex-col gap-4 md:hidden">
      {supporters.map((supporter) => (
        <SupporterCard key={supporter.id} supporter={supporter} />
      ))}
    </div>

    <CampaignTable
      className="hidden md:block"
      columns={supporterColumns}
      columnVisibility={columnVisibility}
      rows={supporters}
      rowKey={(supporter) => supporter.id}
    />
  </>
)
