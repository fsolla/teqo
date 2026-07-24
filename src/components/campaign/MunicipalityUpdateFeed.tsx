import { Badge } from '@/components/ui/Badge'
import {
  municipalitySignalTypeLabels,
  municipalityUpdateKindLabels,
} from '@/lib/schemas/municipalityUpdate'
import type { MunicipalityUpdateViewModel } from '@/utilities/municipalityUpdatePageData'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

const kindVariant = {
  semanal: 'secondary',
  urgente: 'destructive',
  nota: 'outline',
  sinal: 'default',
} as const

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
            <Badge variant={kindVariant[update.kind]}>{municipalityUpdateKindLabels[update.kind]}</Badge>
            <span className="text-sm font-medium">{update.authorName}</span>
            <span className="text-sm text-muted-foreground">
              {dateTimeFormatter.format(new Date(update.createdAt))}
            </span>
          </div>
          {update.kind === 'semanal' ? (
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="font-medium">O que funcionou</dt>
                <dd className="whitespace-pre-wrap text-muted-foreground">{update.worked}</dd>
              </div>
              <div>
                <dt className="font-medium">O que não funcionou</dt>
                <dd className="whitespace-pre-wrap text-muted-foreground">{update.failed}</dd>
              </div>
              <div>
                <dt className="font-medium">O que preciso</dt>
                <dd className="whitespace-pre-wrap text-muted-foreground">{update.needs}</dd>
              </div>
            </dl>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{update.body}</p>
          )}
          {update.kind === 'sinal' ? (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {update.signalType ? <Badge variant="outline">{municipalitySignalTypeLabels[update.signalType]}</Badge> : null}
              {update.signalSource ? <span>Fonte: {update.signalSource}</span> : null}
              {update.triangulated ? <span>Triangulado</span> : null}
            </div>
          ) : null}
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
