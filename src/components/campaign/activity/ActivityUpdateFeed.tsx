import { MessageSquareTextIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/Empty'
import type { ActivityUpdateViewModel } from '@/utilities/activityViewModels'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'

const UpdateCard = ({ update }: { update: ActivityUpdateViewModel }) => (
  <article>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{update.authorName ?? 'Autor removido'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {update.createdAt ? formatBahiaDateTimeLabel(update.createdAt) : ''}
        </p>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{update.body}</p>
      </CardContent>
    </Card>
  </article>
)

export const ActivityUpdateFeed = ({ updates }: { updates: ActivityUpdateViewModel[] }) => {
  if (!updates.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareTextIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nenhuma atualização registrada</EmptyTitle>
          <EmptyDescription>
            Envie o primeiro reporte para iniciar o histórico cronológico desta atividade.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const sortedUpdates = [...updates].reverse()

  return (
    <div className="flex flex-col gap-4">
      {sortedUpdates.map((update, index) => (
        <UpdateCard key={update.id ?? index} update={update} />
      ))}
    </div>
  )
}
