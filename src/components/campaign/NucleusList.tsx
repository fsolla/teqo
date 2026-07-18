import Link from 'next/link'
import { CircleCheckIcon, CircleAlertIcon } from 'lucide-react'

import { NucleusCard } from '@/components/campaign/NucleusCard'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
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
import { organizationKindLabels } from '@/utilities/nucleusUi'
import type { NucleusListViewModel } from '@/utilities/nucleusViewModels'

export type NucleusListProps = {
  nuclei: NucleusListViewModel[]
}

const voteFormatter = new Intl.NumberFormat('pt-BR')

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const getTerritory = (nucleus: NucleusListViewModel): string =>
  [nucleus.neighborhood, nucleus.locality, nucleus.city, nucleus.region].filter(Boolean).join(' · ')

const getOrganization = (nucleus: NucleusListViewModel): string =>
  nucleus.organizationLabel ?? organizationKindLabels[nucleus.organizationKind]

const CoordinatorAvatars = ({ nucleus }: { nucleus: NucleusListViewModel }) => {
  const names = nucleus.coordinators.map(({ name }) => name)

  if (!names.length) return <span className="text-muted-foreground">Sem coordenador</span>

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

export const NucleusList = ({ nuclei }: NucleusListProps) => (
  <>
    <div data-view="mobile-cards" className="flex flex-col gap-4 md:hidden">
      {nuclei.map((nucleus) => (
        <NucleusCard
          key={nucleus.id}
          name={nucleus.name}
          territory={getTerritory(nucleus)}
          organization={getOrganization(nucleus)}
          tseZones={nucleus.tseZones}
          confirmedVoteEstimate={nucleus.confirmedVoteEstimate}
          hasPendingEstimate={nucleus.proposedVoteEstimate != null}
          lastUpdateLabel={
            nucleus.lastUpdateAt
              ? `Atualizada em ${new Intl.DateTimeFormat('pt-BR').format(new Date(nucleus.lastUpdateAt))}`
              : 'Nenhuma atualização registrada'
          }
          actions={
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link href={`/campanha/nucleos/${nucleus.slug}`}>Abrir núcleo</Link>
            </Button>
          }
        />
      ))}
    </div>

    <div data-view="desktop-table" className="hidden overflow-hidden rounded-xl border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Território</TableHead>
            <TableHead>Zonas TSE</TableHead>
            <TableHead>Coordenadores</TableHead>
            <TableHead>Estimativa</TableHead>
            <TableHead>Última atualização</TableHead>
            <TableHead>Cobertura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nuclei.map((nucleus) => {
            const hasCoordinator = Boolean(nucleus.coordinators?.length)

            return (
              <TableRow key={nucleus.id}>
                <TableCell className="max-w-52 whitespace-normal">
                  <Link
                    href={`/campanha/nucleos/${nucleus.slug}`}
                    className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {nucleus.name}
                  </Link>
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal">
                  <span className="font-medium">{getOrganization(nucleus)}</span>
                  <span className="block text-muted-foreground">{getTerritory(nucleus)}</span>
                </TableCell>
                <TableCell>
                  {nucleus.tseZones.length ? (
                    <div className="flex flex-wrap gap-1">
                      {nucleus.tseZones.map((zoneNumber) => (
                        <TseZoneBadge key={zoneNumber} zoneNumber={zoneNumber} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Nenhuma ZE vinculada</span>
                  )}
                </TableCell>
                <TableCell>
                  <CoordinatorAvatars nucleus={nucleus} />
                </TableCell>
                <TableCell>
                  <span className="font-medium tabular-nums">
                    {nucleus.confirmedVoteEstimate == null
                      ? 'Sem confirmação'
                      : voteFormatter.format(nucleus.confirmedVoteEstimate)}
                  </span>
                  {nucleus.proposedVoteEstimate != null ? (
                    <Badge variant="estimate-pending" className="mt-1 block w-fit">
                      Sugestão pendente
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  {nucleus.lastUpdateAt
                    ? new Intl.DateTimeFormat('pt-BR').format(new Date(nucleus.lastUpdateAt))
                    : 'Sem atualização'}
                </TableCell>
                <TableCell>
                  <Badge variant={hasCoordinator ? 'estimate-confirmed' : 'estimate-pending'}>
                    {hasCoordinator ? (
                      <CircleCheckIcon data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
                    )}
                    {hasCoordinator ? 'Coberto' : 'Sem coordenador'}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  </>
)
