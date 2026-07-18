import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon, MessageSquareTextIcon } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/Empty'
import type { NucleusUpdatesPageData } from '@/utilities/nucleusUpdatePageData'
import {
  buildNucleusUpdateHref,
  nucleusUpdateKindLabels,
  type NucleusUpdateListState,
  type NucleusUpdateViewModel,
} from '@/utilities/nucleusUpdateUi'

const roleLabels: Record<NucleusUpdateViewModel['authorRole'], string> = {
  geral: 'Coordenação geral',
  coordenador: 'Coordenador',
  lideranca: 'Liderança',
}

const updateFilters: Array<{ label: string; state: NucleusUpdateListState }> = [
  { label: 'Todas', state: { page: 1 } },
  ...Object.entries(nucleusUpdateKindLabels).map(([kind, label]) => ({
    label,
    state: { kind: kind as NucleusUpdateListState['kind'], page: 1 },
  })),
]

const relativeDate = (value: string, now: string): string => {
  const elapsedDays = Math.round(
    (new Date(value).getTime() - new Date(now).getTime()) / (24 * 60 * 60 * 1000),
  )
  return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(elapsedDays, 'day')
}

const UpdateCard = ({ update, now }: { update: NucleusUpdateViewModel; now: string }) => (
  <article>
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={update.kind === 'urgente' ? 'destructive' : 'secondary'}>
            {nucleusUpdateKindLabels[update.kind]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {relativeDate(update.createdAt, now)}
          </span>
        </div>
        <CardTitle className="text-base">{update.authorName}</CardTitle>
        <p className="text-sm text-muted-foreground">{roleLabels[update.authorRole]}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {update.kind === 'semanal' ? (
          <>
            <section>
              <h3 className="font-medium">O que funcionou</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{update.worked}</p>
            </section>
            <section>
              <h3 className="font-medium">O que não funcionou</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{update.failed}</p>
            </section>
            <section>
              <h3 className="font-medium">O que preciso</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{update.needs}</p>
            </section>
            {update.activeVolunteers !== null || update.newSupports !== null ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                {update.activeVolunteers !== null ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">Voluntários ativos</dt>
                    <dd className="font-semibold tabular-nums">{update.activeVolunteers}</dd>
                  </div>
                ) : null}
                {update.newSupports !== null ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">Novos apoios</dt>
                    <dd className="font-semibold tabular-nums">{update.newSupports}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </>
        ) : (
          <p className="whitespace-pre-wrap">{update.body}</p>
        )}
      </CardContent>
    </Card>
  </article>
)

export const NucleusUpdateFeed = ({
  nucleusSlug,
  pageData,
  rawSearchParams,
  now,
}: {
  nucleusSlug: string
  pageData: NucleusUpdatesPageData
  rawSearchParams: Record<string, string | string[] | undefined>
  now: string
}) => (
  <div className="flex flex-col gap-4">
    <nav aria-label="Filtrar atualizações por tipo" className="flex flex-wrap gap-2">
      {updateFilters.map(({ label, state }) => {
        const active = state.kind === pageData.kind
        return (
          <Button key={label} asChild variant={active ? 'default' : 'outline'} className="min-h-11">
            <Link
              href={buildNucleusUpdateHref(nucleusSlug, rawSearchParams, state)}
              aria-current={active ? 'page' : undefined}
            >
              {label}
            </Link>
          </Button>
        )
      })}
    </nav>
    {pageData.updates.length ? (
      <div className="flex flex-col gap-4">
        {pageData.updates.map((update) => (
          <UpdateCard key={update.id} update={update} now={now} />
        ))}
      </div>
    ) : (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareTextIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nenhuma atualização neste filtro</EmptyTitle>
          <EmptyDescription>
            Envie o primeiro reporte para iniciar o histórico cronológico do núcleo.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )}
    {pageData.totalPages > 1 ? (
      <nav
        aria-label="Paginação das atualizações"
        className="flex items-center justify-between gap-3"
      >
        {pageData.page <= 1 ? (
          <Button type="button" variant="outline" className="min-h-11" disabled>
            <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
            Anterior
          </Button>
        ) : (
          <Button asChild variant="outline" className="min-h-11">
            <Link
              href={buildNucleusUpdateHref(nucleusSlug, rawSearchParams, {
                ...(pageData.kind ? { kind: pageData.kind } : {}),
                page: pageData.page - 1,
              })}
            >
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Anterior
            </Link>
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          Página {pageData.page} de {pageData.totalPages}
        </span>
        {pageData.page >= pageData.totalPages ? (
          <Button type="button" variant="outline" className="min-h-11" disabled>
            Próxima
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : (
          <Button asChild variant="outline" className="min-h-11">
            <Link
              href={buildNucleusUpdateHref(nucleusSlug, rawSearchParams, {
                ...(pageData.kind ? { kind: pageData.kind } : {}),
                page: pageData.page + 1,
              })}
            >
              Próxima
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </nav>
    ) : null}
  </div>
)
