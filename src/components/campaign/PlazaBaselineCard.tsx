import { computeVoteTrend } from '@/lib/electionInsights'
import type { PlazaElectoralBaseline } from '@/utilities/plazaElectoralBaseline'

const voteFormatter = new Intl.NumberFormat('pt-BR')

const seriesVotes = (baseline: PlazaElectoralBaseline, year: number): number =>
  baseline.series.find((point) => point.year === year)?.votes ?? 0

export const PlazaBaselineCard = ({ baseline }: { baseline: PlazaElectoralBaseline | null }) => {
  if (!baseline) {
    return (
      <section
        aria-labelledby="plaza-baseline-title"
        className="flex flex-col gap-2 rounded-xl border p-4"
      >
        <h2 id="plaza-baseline-title" className="text-base font-medium">
          Votação nas eleições anteriores
        </h2>
        <p className="text-sm text-muted-foreground">
          Sem dados TSE importados para esta Praça. Rode o seed eleitoral no ambiente para habilitar
          o baseline.
        </p>
      </section>
    )
  }

  const latest = baseline.series[baseline.series.length - 1]
  // "Evolução de votos" — série numérica derivada. "Tendência política" é outro
  // conceito (conjuntura, registrada manualmente pela coordenação na Praça).
  const evolution = computeVoteTrend({
    y2014: seriesVotes(baseline, 2014),
    y2018: seriesVotes(baseline, 2018),
    y2022: seriesVotes(baseline, 2022),
  })

  return (
    <section
      aria-labelledby="plaza-baseline-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="plaza-baseline-title" className="text-base font-medium">
          Votação de {baseline.candidateName} ({baseline.candidateParty})
        </h2>
        <p className="text-sm text-muted-foreground">
          Votos nominais para deputado federal (1º turno) na geografia desta Praça — fonte TSE.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        {baseline.series.map((point) => (
          <div key={point.year} className="rounded-lg bg-muted/40 px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">Eleição {point.year}</dt>
            <dd className="text-lg font-medium tabular-nums">
              {voteFormatter.format(point.votes)}
            </dd>
          </div>
        ))}
      </dl>

      {evolution.status !== 'noBaseline' ? (
        <p className="text-sm text-muted-foreground">Evolução de votos: {evolution.message}</p>
      ) : null}

      {baseline.tally2022 ? (
        <p className="text-sm text-muted-foreground">
          2022: {voteFormatter.format(baseline.tally2022.aptos)} aptos ·{' '}
          {voteFormatter.format(baseline.tally2022.comparecimento)} compareceram ·{' '}
          {voteFormatter.format(baseline.tally2022.votosValidos)} votos válidos
          {latest && baseline.tally2022.votosValidos > 0
            ? ` · ${((latest.votes / baseline.tally2022.votosValidos) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% dos válidos`
            : ''}
        </p>
      ) : null}

      {baseline.ticket2022.president != null || baseline.ticket2022.governor != null ? (
        <p className="text-sm text-muted-foreground">
          Chapa 2022:{' '}
          {baseline.ticket2022.president != null
            ? `Lula ${voteFormatter.format(baseline.ticket2022.president)} votos`
            : null}
          {baseline.ticket2022.president != null && baseline.ticket2022.governor != null
            ? ' · '
            : null}
          {baseline.ticket2022.governor != null
            ? `Jerônimo ${voteFormatter.format(baseline.ticket2022.governor)} votos`
            : null}
        </p>
      ) : null}
    </section>
  )
}
