import { Inbox } from 'lucide-react'

import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignUserAvatar } from '@/components/campaign/shared/CampaignUserAvatar'
import { Badge } from '@/components/ui/Badge'
import {
  municipalityUpdatePolarityBadgeVariant,
  municipalityUpdatePolarityLabels,
} from '@/lib/schemas/municipalityUpdate'
import type { CampaignUpdatesFeedCard } from '@/utilities/municipality/campaignUpdatesFeedData'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const CampaignUpdatesFeedItem = ({ card }: { card: CampaignUpdatesFeedCard }) => (
  <li className="flex gap-3 rounded-xl border p-4">
    <CampaignUserAvatar
      name={card.author.name}
      avatarUrl={card.author.avatarUrl}
      size="default"
      className="mt-0.5 size-10 shrink-0"
    />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="whitespace-pre-wrap text-sm">{card.body ?? 'Sem texto.'}</p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={municipalityUpdatePolarityBadgeVariant[card.polarity]}>
          {municipalityUpdatePolarityLabels[card.polarity]}
        </Badge>
        {card.urgent ? <Badge variant="destructive">Urgente</Badge> : null}
        {card.adversarySignal ? <Badge variant="outline">Adversário</Badge> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{card.author.name}</span>
        <span aria-hidden="true"> · </span>
        {card.municipality.name}
        <span aria-hidden="true"> · </span>
        {dateTimeFormatter.format(new Date(card.createdAt))}
      </p>
    </div>
  </li>
)

export const CampaignUpdatesFeed = ({ cards }: { cards: CampaignUpdatesFeedCard[] }) => {
  if (cards.length === 0) {
    return (
      <CampaignListEmptyState
        icon={Inbox}
        title="Nenhuma atualização encontrada"
        description="Ajuste o filtro ou registre um novo fato com o botão “+ Nova atualização”."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {cards.map((card) => (
        <CampaignUpdatesFeedItem key={card.id} card={card} />
      ))}
    </ul>
  )
}
