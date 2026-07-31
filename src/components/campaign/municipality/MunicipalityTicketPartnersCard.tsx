import Link from 'next/link'
import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/Badge'
import { formatElectionNumber } from '@/lib/electionFormat'
import {
  ticketPartnerOfficeLabels,
  ticketPartnerTierLabels,
  type TicketPartnerResult,
  type TicketPartnerTier,
} from '@/lib/ticketPartnerOpportunities'

const tierBadgeVariants: Record<TicketPartnerTier, ComponentProps<typeof Badge>['variant']> = {
  aliado: 'support-engaged',
  aliadoHistorico: 'tse',
  neutro: 'outline',
  adversario: 'support-negative',
}

const votesLabel = (votes: number) =>
  `${formatElectionNumber(votes)} ${votes === 1 ? 'voto' : 'votos'}`

/**
 * A6 — ranked dobradinha opportunities for 2026 in this municipality's
 * geography. Until the TSE publishes the 2026 candidacies and the Fase 5
 * reconcile marks who runs again, the card says so instead of listing anyone.
 * The write path stays in the operational vertical (`/campanha/dobradinhas`) —
 * this insight suggests, it never registers.
 */
export const MunicipalityTicketPartnersCard = ({ result }: { result: TicketPartnerResult }) => (
  <section
    aria-labelledby="municipality-ticket-partners-title"
    className="flex flex-col gap-4 rounded-xl border p-4"
  >
    <div className="flex flex-col gap-1">
      <h2 id="municipality-ticket-partners-title" className="text-base font-medium">
        Dobradinhas potenciais para 2026
      </h2>
      <p className="text-sm text-muted-foreground">
        Candidatos a deputado federal e estadual que concorrem de novo em 2026, ranqueados por
        alinhamento com a chapa e pela força eleitoral aqui em 2022 (votos nominais TSE, 1º turno).
      </p>
    </div>

    {result.status === 'pending2026' ? (
      <p className="text-sm text-muted-foreground">
        Indisponível até as candidaturas de 2026: quando o TSE publicar o registro (previsto para
        depois de 15/08) e a conciliação marcar quem concorre de novo, a lista aparece aqui
        automaticamente.
      </p>
    ) : result.opportunities.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        Nenhum candidato que retorna em 2026 teve votos nominais nesta geografia em 2022.
      </p>
    ) : (
      <ol className="flex flex-col">
        {result.opportunities.map((opportunity, index) => (
          <li
            key={`${opportunity.office}-${opportunity.candidateNumber}`}
            className="flex items-center gap-3 border-t border-border/60 py-2.5 first:border-t-0 first:pt-0 last:pb-0"
          >
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {index + 1}º
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {opportunity.name}
                {opportunity.elected2022 ? (
                  <span className="font-normal text-muted-foreground"> · eleito em 2022</span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {ticketPartnerOfficeLabels[opportunity.office]} ·{' '}
                {opportunity.party ?? 'Sem partido'} · {votesLabel(opportunity.votes2022)} em 2022
              </span>
            </div>
            <Badge variant={tierBadgeVariants[opportunity.tier]}>
              {ticketPartnerTierLabels[opportunity.tier]}
            </Badge>
          </li>
        ))}
      </ol>
    )}

    <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
      Dobradinha fechada é decisão da coordenação — registre e priorize em{' '}
      <Link
        href="/campanha/dobradinhas"
        className="text-primary underline-offset-4 hover:underline"
      >
        Dobradinhas
      </Link>
      .
    </p>
  </section>
)
