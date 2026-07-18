import Link from 'next/link'
import { PhoneIcon } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { formatBrazilianPhoneInput } from '@/utilities/phone'
import type { SupporterListItemViewModel } from '@/utilities/supporterViewModels'
import { supporterVoteIntentionLabels } from '@/utilities/supporterUi'

export type SupporterListProps = {
  supporters: SupporterListItemViewModel[]
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
        <p className="text-sm text-muted-foreground">
          {supporter.city ?? 'Município não informado'}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          {supporter.nucleusName ? (
            <Link
              href={`/campanha/nucleos/${supporter.nucleusSlug}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {supporter.nucleusName}
            </Link>
          ) : (
            <span className="text-muted-foreground">Sem núcleo vinculado</span>
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

export const SupporterList = ({ supporters }: SupporterListProps) => (
  <>
    <div data-view="mobile-cards" className="flex flex-col gap-4 md:hidden">
      {supporters.map((supporter) => (
        <SupporterCard key={supporter.id} supporter={supporter} />
      ))}
    </div>

    <div data-view="desktop-table" className="hidden overflow-hidden rounded-xl border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Município</TableHead>
            <TableHead>Núcleo</TableHead>
            <TableHead>Intenção</TableHead>
            <TableHead>Telefone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {supporters.map((supporter) => {
            const voteIntentionLabel = supporter.voteIntention
              ? supporterVoteIntentionLabels[supporter.voteIntention]
              : null

            return (
              <TableRow key={supporter.id}>
                <TableCell className="max-w-52 whitespace-normal">
                  <Link
                    href={`/campanha/apoiadores/${supporter.id}`}
                    className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {supporter.name}
                  </Link>
                </TableCell>
                <TableCell>{supporter.city ?? '—'}</TableCell>
                <TableCell className="max-w-48 whitespace-normal">
                  {supporter.nucleusName ? (
                    <Link
                      href={`/campanha/nucleos/${supporter.nucleusSlug}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {supporter.nucleusName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Sem núcleo vinculado</span>
                  )}
                </TableCell>
                <TableCell>
                  {voteIntentionLabel ? (
                    <Badge variant={voteIntentionBadgeVariant(supporter.voteIntention)}>
                      {voteIntentionLabel}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Sem intenção</Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {supporter.phone ? formatBrazilianPhoneInput(supporter.phone) : '—'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  </>
)
