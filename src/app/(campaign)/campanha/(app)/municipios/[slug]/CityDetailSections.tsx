import Link from 'next/link'
import type { Payload } from 'payload'

import { getMunicipalityFederalBaseline } from '@/lib/bahiaElectionAggregates'
import {
  formatElectionNumber,
  formatPlacementOrdinal,
  formatVoteSharePercent,
} from '@/lib/electionFormat'
import { BASELINE_TICKET_2022, ELECTION_YEAR_2022 } from '@/lib/electionResults'
import { salvadorCity, salvadorZoneCatalogEntries } from '@/lib/salvadorCity'
import { computeVoteTrend } from '@/lib/voteTrend'
import type { Activity, CampaignUser } from '@/payload-types'
import { activityListSelect } from '@/utilities/activityViewModels'
import {
  cityCompetitiveRank,
  cityFederalBaseline,
  cityVoteShareByYear,
} from '@/utilities/municipality/salvadorCityAggregates'

const CITY_SERIES_YEARS = [2014, 2018, ELECTION_YEAR_2022] as const

const activityDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

const now = () => new Date()

/**
 * B178 — city overview for the virtual Salvador page: the electoral rollup
 * folded from the committed artifact (the city never queries the TSE
 * collections for its history), where the capital is strongest, and the
 * entradas (19 ZEs, demandas, agenda, mapa). Read-only; operation stays per
 * zone.
 */
export const CityOverviewTab = async ({
  payload,
  user,
}: {
  payload: Payload
  user: CampaignUser
}) => {
  const baseline = cityFederalBaseline()
  const series = CITY_SERIES_YEARS.map((year) => ({
    year,
    votes: baseline.votesByYear[String(year)] ?? 0,
    share: cityVoteShareByYear(year),
    competitive: cityCompetitiveRank(year),
  }))
  const evolution = computeVoteTrend({
    y2014: series[0]!.votes,
    y2018: series[1]!.votes,
    y2022: series[2]!.votes,
  })
  const tally2022 = baseline.federalTallyByYear[String(ELECTION_YEAR_2022)]
  const majoritarian = baseline.majoritarian2022

  const topZones = salvadorZoneCatalogEntries()
    .map((entry) => ({
      entry,
      votes:
        getMunicipalityFederalBaseline(entry.slug).votesByYear[String(ELECTION_YEAR_2022)] ?? 0,
    }))
    .sort((left, right) => right.votes - left.votes)
    .slice(0, 5)

  const cityZoneIDs = (
    await payload.find({
      collection: 'municipality',
      where: { slug: { in: salvadorCity.zoneSlugs } },
      depth: 0,
      limit: 0,
      pagination: false,
      user,
      overrideAccess: false,
    })
  ).docs.map((doc) => doc.id)

  // Same upcoming shape as the Agenda tab ("confirmado" + not started), scoped
  // to the city's zones and filtered by the actor's access.
  const upcoming = cityZoneIDs.length
    ? ((
        await payload.find({
          collection: 'activity',
          where: {
            and: [
              { municipality: { in: cityZoneIDs } },
              { status: { equals: 'confirmado' } },
              { startAt: { greater_than_equal: now().toISOString() } },
            ],
          },
          depth: 0,
          limit: 3,
          pagination: false,
          sort: 'startAt',
          select: activityListSelect,
          user,
          overrideAccess: false,
        })
      ).docs as Activity[])
    : []

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="city-baseline-title"
        className="flex flex-col gap-4 rounded-xl border p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="city-baseline-title" className="text-base font-medium">
            Votação de {BASELINE_TICKET_2022.candidate.name} ({BASELINE_TICKET_2022.candidate.party}
            )
          </h2>
          <p className="text-sm text-muted-foreground">
            Soma das 19 zonas eleitorais · votos nominais para deputado federal (1º turno) — fonte
            TSE.
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          {series.map(({ year, votes, share, competitive }) => (
            <div
              key={year}
              className={
                year === ELECTION_YEAR_2022
                  ? 'rounded-lg bg-muted/60 px-3 py-2 ring-1 ring-border'
                  : 'rounded-lg bg-muted/40 px-3 py-2'
              }
            >
              <dt className="text-xs font-medium text-muted-foreground">Eleição {year}</dt>
              <dd className="text-lg font-medium tabular-nums">{formatElectionNumber(votes)}</dd>
              <dd
                className="mt-1 flex flex-col gap-0.5 text-xs tabular-nums text-muted-foreground"
                aria-label={`${formatVoteSharePercent(share)} da votação estadual${competitive ? `, ${formatPlacementOrdinal(competitive.rank)} de ${formatElectionNumber(competitive.candidates)} na capital` : ''}`}
              >
                <span>{formatVoteSharePercent(share)}</span>
                {competitive ? (
                  <span>
                    {formatPlacementOrdinal(competitive.rank)} de{' '}
                    {formatElectionNumber(competitive.candidates)}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {evolution.status !== 'noBaseline' ? (
          <p className="text-sm text-muted-foreground">Evolução de votos: {evolution.message}</p>
        ) : null}

        {tally2022 ? (
          <div className="flex flex-col gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <p className="font-medium text-muted-foreground">Comparativos locais</p>
            <p>
              2022: {formatElectionNumber(tally2022.comparecimento)} compareceram ·{' '}
              {formatElectionNumber(tally2022.votosValidos)} votos válidos
            </p>
            {tally2022.votosValidos > 0 ? (
              <p>
                Dominância local:{' '}
                {formatVoteSharePercent(
                  (baseline.votesByYear[String(ELECTION_YEAR_2022)] ?? 0) / tally2022.votosValidos,
                )}{' '}
                dos válidos na capital (distinto da concentração acima).
              </p>
            ) : null}
          </div>
        ) : null}

        {majoritarian ? (
          <p className="text-sm text-muted-foreground">
            Chapa 2022: Lula {formatElectionNumber(majoritarian.president.votes)} votos · Jerônimo{' '}
            {formatElectionNumber(majoritarian.governor.votes)} votos
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="city-zones-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="city-zones-title" className="text-base font-medium">
            Onde na capital o candidato é mais forte ({ELECTION_YEAR_2022})
          </h2>
          <p className="text-sm text-muted-foreground">
            A operação da campanha é por zona — esta é a leitura agregada, não uma unidade nova.
          </p>
        </div>
        <ol className="flex flex-col">
          {topZones.map(({ entry, votes }) => (
            <li key={entry.slug} className="flex items-center justify-between gap-3 py-1.5">
              <Link
                href={`/campanha/municipios/${entry.slug}`}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                ZE {entry.zoneNumber}
              </Link>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatElectionNumber(votes)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="city-entries-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <h2 id="city-entries-title" className="text-base font-medium">
          Entradas da capital
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">As 19 zonas</p>
            <p className="text-sm text-muted-foreground">
              Para operar, entre numa zona eleitoral — cada uma tem ficha, dossiê e linha próprias.
            </p>
            <Link
              href="/campanha/municipios?q=salvador"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Ver as 19 zonas na lista
            </Link>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Demandas</p>
            <p className="text-sm text-muted-foreground">
              As demandas são registradas por zona eleitoral.
            </p>
            <Link
              href="/campanha/demandas"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Ver Demandas
            </Link>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Agenda na capital</p>
            {cityZoneIDs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                A capital não está no seu recorte de atuação.
              </p>
            ) : upcoming.length ? (
              <ol className="flex flex-col gap-1">
                {upcoming.map((activity) => (
                  <li key={activity.id} className="text-sm">
                    <Link
                      href={`/campanha/atividades/${activity.slug}`}
                      className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      <span className="font-medium tabular-nums text-foreground">
                        {activity.startAt
                          ? activityDateFormatter.format(new Date(activity.startAt))
                          : null}
                      </span>{' '}
                      {activity.title}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma atividade confirmada nas zonas da capital.
              </p>
            )}
            <Link
              href="/campanha/atividades"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Ver Agenda
            </Link>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Mapa</p>
            <p className="text-sm text-muted-foreground">
              No mapa, Salvador continua pintada por zona; a cidade segue como base não-interativa.
            </p>
            <Link
              href="/campanha"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Ver mapa
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

/** B178 — demands of the capital link out, same pattern as the municipality page. */
export const CityDemandsTab = () => (
  <section className="rounded-xl border px-4 py-6">
    <p className="text-sm text-muted-foreground">
      As demandas da capital aparecem em{' '}
      <Link href="/campanha/demandas" className="text-primary underline-offset-4 hover:underline">
        Demandas
      </Link>
      . Elas são registradas por zona eleitoral — a capital é uma leitura agregada das 19 zonas.
    </p>
  </section>
)
