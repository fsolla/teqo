'use client'

import Link from 'next/link'

import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { MunicipalityV2DeclaredVotesCell } from '@/components/campaign/municipality/MunicipalityV2DeclaredVotesCell'
import { MunicipalityV2EstimatedVotesCell } from '@/components/campaign/municipality/MunicipalityV2EstimatedVotesCell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { MunicipalityV2NetworkViewModel } from '@/utilities/municipality/municipalityV2NetworkView'

type MunicipalityV2NetworkListProps = {
  network: MunicipalityV2NetworkViewModel
}

export const MunicipalityV2NetworkList = ({ network }: MunicipalityV2NetworkListProps) => {
  if (network.rows.length === 0) {
    return (
      <p className="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
        Nenhuma liderança vinculada a este município ainda.
      </p>
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Declarado</TableHead>
              <TableHead className="text-right">Estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {network.rows.map((row) => (
              <TableRow key={row.leadershipID}>
                <TableCell>
                  <Link
                    href={`/campanha/liderancas/${row.leadershipID}`}
                    className="min-h-11 content-center font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {row.supportStatus ? <SupportStatusBadge status={row.supportStatus} /> : null}
                </TableCell>
                <TableCell className="text-right">
                  <MunicipalityV2DeclaredVotesCell
                    municipalityID={network.municipalityID}
                    leadershipID={row.leadershipID}
                    leadershipName={row.name}
                    declaredVotes={row.declaredVotes}
                    variant="popover"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <MunicipalityV2EstimatedVotesCell
                    pledgeID={row.pledgeID}
                    leadershipName={row.name}
                    declaredVotes={row.declaredVotes}
                    estimatedVotes={row.estimatedVotes}
                    variant="popover"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {network.rows.map((row) => (
          <li
            key={row.leadershipID}
            className="flex flex-col gap-2 rounded-xl border px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/campanha/liderancas/${row.leadershipID}`}
                className="min-h-11 content-center font-medium text-primary underline-offset-4 hover:underline"
              >
                {row.name}
              </Link>
              {row.supportStatus ? <SupportStatusBadge status={row.supportStatus} /> : null}
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Declarado</dt>
                <dd>
                  <MunicipalityV2DeclaredVotesCell
                    municipalityID={network.municipalityID}
                    leadershipID={row.leadershipID}
                    leadershipName={row.name}
                    declaredVotes={row.declaredVotes}
                    variant="sheet"
                  />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Estimado</dt>
                <dd>
                  <MunicipalityV2EstimatedVotesCell
                    pledgeID={row.pledgeID}
                    leadershipName={row.name}
                    declaredVotes={row.declaredVotes}
                    estimatedVotes={row.estimatedVotes}
                    variant="sheet"
                  />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {network.totalCount > network.rows.length ? (
        <p className="text-xs text-muted-foreground">
          Mostrando {formatElectionNumber(network.rows.length)} de{' '}
          {formatElectionNumber(network.totalCount)} lideranças — use Ver todas para o cadastro
          completo.
        </p>
      ) : null}
    </>
  )
}
