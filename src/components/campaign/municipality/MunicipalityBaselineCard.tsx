import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import {
  formatElectionNumber,
  formatPlacementOrdinal,
  formatVoteSharePercent,
} from '@/lib/electionFormat'
import { DEFAULT_VOTE_RANK_YEAR, getMunicipalityVoteRank } from '@/lib/municipalityVoteRank'
import { computeVoteTrend } from '@/lib/voteTrend'
import type { MunicipalityElectoralBaseline } from '@/utilities/municipalityElectoralBaseline'
import { formatMunicipalityConcentrationHint } from '@/utilities/municipalityLabels'

const seriesVotes = (baseline: MunicipalityElectoralBaseline, year: number): number =>
  baseline.series.find((point) => point.year === year)?.votes ?? 0

export const MunicipalityBaselineCard = ({
  baseline,
  municipalitySlug,
}: {
  baseline: MunicipalityElectoralBaseline | null
  municipalitySlug: string
}) => {
  if (!baseline) {
    return (
      <section
        aria-labelledby="municipality-baseline-title"
        className="flex flex-col gap-2 rounded-xl border p-4"
      >
        <h2 id="municipality-baseline-title" className="text-base font-medium">
          Votação nas eleições anteriores
        </h2>
        <p className="text-sm text-muted-foreground">
          Sem baseline TSE neste ambiente. A concentração e o histórico de votos ficam disponíveis
          quando os resultados forem importados.
        </p>
      </section>
    )
  }

  const latest = baseline.series[baseline.series.length - 1]
  // "Evolução de votos" — série numérica derivada. "Tendência política" é outro
  // conceito (conjuntura, registrada manualmente pela coordenação no município).
  const evolution = computeVoteTrend({
    y2014: seriesVotes(baseline, 2014),
    y2018: seriesVotes(baseline, 2018),
    y2022: seriesVotes(baseline, DEFAULT_VOTE_RANK_YEAR),
  })
  const concentrationHint = formatMunicipalityConcentrationHint()

  return (
    <section
      aria-labelledby="municipality-baseline-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <CampaignHoverTooltip content={concentrationHint}>
          <h2 id="municipality-baseline-title" className="w-fit text-base font-medium">
            Votação de {baseline.candidateName} ({baseline.candidateParty})
          </h2>
        </CampaignHoverTooltip>
        <p className="text-sm text-muted-foreground">
          Votos nominais para deputado federal (1º turno) na geografia deste município — fonte TSE.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        {baseline.series.map((point) => {
          const position = getMunicipalityVoteRank(municipalitySlug, point.year)
          return (
            <div
              key={point.year}
              className={
                point.year === DEFAULT_VOTE_RANK_YEAR
                  ? 'rounded-lg bg-muted/60 px-3 py-2 ring-1 ring-border'
                  : 'rounded-lg bg-muted/40 px-3 py-2'
              }
            >
              <dt className="text-xs font-medium text-muted-foreground">Eleição {point.year}</dt>
              <dd className="text-lg font-medium tabular-nums">
                {formatElectionNumber(point.votes)}
              </dd>
              {position ? (
                <dd
                  className="mt-1 flex flex-col gap-0.5 text-xs tabular-nums text-muted-foreground"
                  aria-label={`${formatVoteSharePercent(position.share)} da votação estadual, ${formatPlacementOrdinal(position.rank)} de ${formatElectionNumber(position.totalUnits)}`}
                >
                  <span>{formatVoteSharePercent(position.share)}</span>
                  <span>{formatPlacementOrdinal(position.rank)}</span>
                </dd>
              ) : (
                <dd className="mt-1 text-xs text-muted-foreground">—</dd>
              )}
            </div>
          )
        })}
      </dl>

      {evolution.status !== 'noBaseline' ? (
        <p className="text-sm text-muted-foreground">Evolução de votos: {evolution.message}</p>
      ) : null}

      {baseline.tally2022 ? (
        <div className="flex flex-col gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <p className="font-medium text-muted-foreground">Comparativos locais</p>
          <p>
            2022: {formatElectionNumber(baseline.tally2022.aptos)} aptos ·{' '}
            {formatElectionNumber(baseline.tally2022.comparecimento)} compareceram ·{' '}
            {formatElectionNumber(baseline.tally2022.votosValidos)} votos válidos
          </p>
          {latest && baseline.tally2022.votosValidos > 0 ? (
            <p>
              Dominância local:{' '}
              {formatVoteSharePercent(latest.votes / baseline.tally2022.votosValidos)} dos válidos
              neste município (distinto da concentração acima).
            </p>
          ) : null}
        </div>
      ) : null}

      {baseline.ticket2022.president != null || baseline.ticket2022.governor != null ? (
        <p className="text-sm text-muted-foreground">
          Chapa 2022:{' '}
          {baseline.ticket2022.president != null
            ? `Lula ${formatElectionNumber(baseline.ticket2022.president)} votos`
            : null}
          {baseline.ticket2022.president != null && baseline.ticket2022.governor != null
            ? ' · '
            : null}
          {baseline.ticket2022.governor != null
            ? `Jerônimo ${formatElectionNumber(baseline.ticket2022.governor)} votos`
            : null}
        </p>
      ) : null}
    </section>
  )
}
