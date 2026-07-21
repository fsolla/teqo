import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import Link from 'next/link'

import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import {
  formatPlazaGeographyLabel,
  plazaKindLabels,
  plazaPriorityLabels,
} from '@/utilities/plazaUi'
import type { PlazaAdvisorSummary, PlazaListViewModel } from '@/utilities/plazaViewModels'

const voteFormatter = new Intl.NumberFormat('pt-BR')
const dateFormatter = new Intl.DateTimeFormat('pt-BR')

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const AdvisorAvatars = ({ names }: { names: string[] }) => {
  if (!names.length) return <span className="text-muted-foreground">Sem assessor</span>

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {names.slice(0, 3).map((name) => (
          <Avatar key={name} className="size-8 border-2 border-background">
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="sr-only">{names.join(', ')}</span>
    </div>
  )
}

export type PlazaListProps = {
  plazas: PlazaListViewModel[]
  advisorNamesById: ReadonlyMap<number, PlazaAdvisorSummary>
  isStaffView: boolean
}

export const PlazaList = ({ plazas, advisorNamesById, isStaffView }: PlazaListProps) => {
  const advisorNames = (plaza: PlazaListViewModel): string[] =>
    plaza.advisorIDs.flatMap((id) => {
      const advisor = advisorNamesById.get(id)
      return advisor ? [advisor.name] : []
    })

  return (
    <>
      <div data-view="mobile-cards" className="flex flex-col gap-4 md:hidden">
        {plazas.map((plaza) => {
          const names = advisorNames(plaza)
          return (
            <article key={plaza.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{plaza.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatPlazaGeographyLabel(plaza)}
                  </p>
                </div>
                {plaza.priority === 'alta' && isStaffView ? (
                  <Badge variant="destructive">{plazaPriorityLabels.alta}</Badge>
                ) : null}
              </div>
              {isStaffView ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Votos estimados</dt>
                    <dd className="font-medium tabular-nums">
                      {plaza.pledges.pledgeCount
                        ? voteFormatter.format(plaza.pledges.effectiveTotal)
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Assessoria</dt>
                    <dd>{names.length ? names.join(', ') : 'Sem assessor'}</dd>
                  </div>
                </dl>
              ) : null}
              <Button asChild variant="outline" className="min-h-11 w-full">
                <Link href={`/campanha/pracas/${plaza.slug}`}>Abrir Praça</Link>
              </Button>
            </article>
          )
        })}
      </div>

      <div data-view="desktop-table" className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Praça</TableHead>
              <TableHead>Território de identidade</TableHead>
              <TableHead>Tipo</TableHead>
              {isStaffView ? (
                <>
                  <TableHead>Assessores</TableHead>
                  <TableHead>Votos estimados</TableHead>
                  <TableHead>Última atualização</TableHead>
                  <TableHead>Cobertura</TableHead>
                </>
              ) : (
                <TableHead>Última atualização</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {plazas.map((plaza) => {
              const names = advisorNames(plaza)
              const hasAdvisor = plaza.advisorIDs.length > 0

              return (
                <TableRow key={plaza.id}>
                  <TableCell className="max-w-52 whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/campanha/pracas/${plaza.slug}`}
                        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {plaza.name}
                      </Link>
                      {plaza.priority === 'alta' && isStaffView ? (
                        <Badge variant="destructive">{plazaPriorityLabels.alta}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                    {plaza.region}
                  </TableCell>
                  <TableCell>{plazaKindLabels[plaza.kind]}</TableCell>
                  {isStaffView ? (
                    <>
                      <TableCell>
                        <AdvisorAvatars names={names} />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium tabular-nums">
                          {plaza.pledges.pledgeCount
                            ? voteFormatter.format(plaza.pledges.effectiveTotal)
                            : '—'}
                        </span>
                        {plaza.pledges.missingEstimateCount > 0 ? (
                          <Badge variant="estimate-pending" className="mt-1 block w-fit">
                            {plaza.pledges.missingEstimateCount}{' '}
                            {plaza.pledges.missingEstimateCount === 1
                              ? 'declaração sem estimativa'
                              : 'declarações sem estimativa'}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {plaza.lastUpdateAt
                          ? dateFormatter.format(new Date(plaza.lastUpdateAt))
                          : 'Sem atualização'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={hasAdvisor ? 'estimate-confirmed' : 'estimate-pending'}>
                          {hasAdvisor ? (
                            <CircleCheckIcon data-icon="inline-start" aria-hidden="true" />
                          ) : (
                            <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
                          )}
                          {hasAdvisor ? 'Coberta' : 'Sem assessor'}
                        </Badge>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell>
                      {plaza.lastUpdateAt
                        ? dateFormatter.format(new Date(plaza.lastUpdateAt))
                        : 'Sem atualização'}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
