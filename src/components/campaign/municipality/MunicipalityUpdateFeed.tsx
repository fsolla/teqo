import { Badge } from '@/components/ui/Badge'
import {
  municipalityUpdatePolarityBadgeVariant,
  municipalityUpdatePolarityLabels,
} from '@/lib/schemas/municipalityUpdate'
import type { MunicipalityUpdateViewModel } from '@/utilities/municipality/municipalityUpdatePageData'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const MunicipalityUpdateFeed = ({ updates }: { updates: MunicipalityUpdateViewModel[] }) => {
  if (!updates.length) {
    return (
      <p className="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
        Nenhuma atualização registrada ainda.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {updates.map((update) => (
        <li key={update.id} className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={municipalityUpdatePolarityBadgeVariant[update.polarity]}>
              {municipalityUpdatePolarityLabels[update.polarity]}
            </Badge>
            {update.urgent ? <Badge variant="destructive">Urgente</Badge> : null}
            {update.adversarySignal ? <Badge variant="outline">Adversário</Badge> : null}
            <span className="text-sm font-medium">{update.authorName}</span>
            <span className="text-sm text-muted-foreground">
              {dateTimeFormatter.format(new Date(update.createdAt))}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {update.body ?? 'Sem texto.'}
          </p>
          {update.activeVolunteers != null || update.newSupports != null ? (
            <p className="text-sm text-muted-foreground">
              {update.activeVolunteers != null
                ? `${numberFormatter.format(update.activeVolunteers)} voluntários ativos`
                : null}
              {update.activeVolunteers != null && update.newSupports != null ? ' · ' : null}
              {update.newSupports != null
                ? `${numberFormatter.format(update.newSupports)} novos apoios`
                : null}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
