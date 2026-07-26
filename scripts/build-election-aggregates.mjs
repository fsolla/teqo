/**
 * Builds the committed per-municipality election baseline artifact consumed by
 * the campaign map and by E8's "conta da cadeira" derived potential/coverage
 * (src/lib/electionAggregates/bahia-federal-baseline.json).
 *
 * Why an artifact instead of runtime queries: the 2014/2018/2022 TSE results
 * are immutable, but the map/E8 used to re-scan statewide city×zone slices
 * (electionCandidateVote has ~100k/73k/52k rows for 2022/2018/2014) on every
 * dashboard/list visit. Precomputing the per-municipality sums — Solla nominal
 * votes, federal T1 valid votes, campo-parties federal nominal votes,
 * federal T1 turnout/blank/null, and 2022 majoritarian (presidente/governador
 * #13) votes+tally — cut by the same `municipalityCatalog` geography used at
 * runtime (Salvador split into zone municipalities, every other municipality
 * whole) removes all historical-year DB work from the request/build path.
 * The same reasoning covers B13's competitive placement
 * (`federalRankByIbgeCode`): ranking him against every other candidate means
 * reading the whole statewide slice, which is exactly what must not happen
 * per request.
 *
 * Why not compute during `pnpm build`: Vercel builds must not depend on the
 * production database CONTENT (TSE seeds are local-only by policy), and the
 * artifact should only change when the electoral scope deliberately changes.
 *
 * Prerequisite: `pnpm db:seed:tse` (2022) + `--year=2018` + `--year=2014` on
 * the LOCAL database.
 *
 * Usage:
 *   pnpm build:election-aggregates
 *
 * Safety: read-only against the local database (assertLocalDatabase guard);
 * writes only src/lib/electionAggregates/.
 */

import { config as loadEnv } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const payloadConfig = (await import('../src/payload.config.ts')).default
const { BASELINE_TICKET_2022, ELECTION_YEAR_2022, FEDERAL_DEPUTY_OFFICE, HISTORICAL_SERIES_YEARS } =
  await import('../src/lib/electionResults.ts')
const { municipalityCatalog } = await import('../src/lib/municipalityCatalog.ts')
const { municipalityElectionGeography } =
  await import('../src/utilities/municipalityElectionGeography.ts')
const {
  loadCampoFederalVotesByCityZone,
  loadCandidateVotesByCityZone,
  loadFederalVotesByCityZoneAndCandidate,
  loadOfficeTallyByCityZone,
  loadValidVotesByCityZone,
  sumCandidateVotesForGeography,
  sumOfficeTallyForGeography,
  sumVotesForGeography,
} = await import('../src/utilities/municipalityElectoralBaseline.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DIR = join(ROOT, 'src', 'lib', 'electionAggregates')
const OUTPUT_FILE = join(OUTPUT_DIR, 'bahia-federal-baseline.json')

assertLocalDatabase(
  'build:election-aggregates',
  'This script only reads the LOCAL seeded TSE data (pnpm db:seed:tse).',
)

const payload = await getPayload({ config: payloadConfig })

/** CLI reader — satisfies the election-data read assertion (admin realm). */
const cliReader = { collection: 'users' }

const candidateNumber = BASELINE_TICKET_2022.candidate.candidateNumber
const municipalities = {}
for (const entry of municipalityCatalog) {
  municipalities[entry.slug] = {
    votesByYear: {},
    validVotesByYear: {},
    campoFederalVotesByYear: {},
    federalTallyByYear: {},
  }
}

for (const year of HISTORICAL_SERIES_YEARS) {
  const [candidateVotes, validVotes, campoVotes, federalTally] = await Promise.all([
    loadCandidateVotesByCityZone(payload, cliReader, { year, candidateNumber }),
    loadValidVotesByCityZone(payload, cliReader, { year }),
    loadCampoFederalVotesByCityZone(payload, cliReader, { year }),
    loadOfficeTallyByCityZone(payload, cliReader, {
      year,
      office: FEDERAL_DEPUTY_OFFICE,
      turn: '1',
    }),
  ])

  if (candidateVotes.size === 0) {
    console.error(
      `[build:election-aggregates] No nominal votes found for ${year}. ` +
        `Seed the local database first: pnpm db:seed:tse -- --year=${year}`,
    )
    process.exit(1)
  }

  let yearTotal = 0
  let campoTotal = 0
  for (const entry of municipalityCatalog) {
    const geography = municipalityElectionGeography(entry)
    const votes = sumVotesForGeography(candidateVotes, geography)
    const valid = sumVotesForGeography(validVotes, geography)
    const campo = sumVotesForGeography(campoVotes, geography)
    const tally = sumOfficeTallyForGeography(federalTally, geography)
    municipalities[entry.slug].votesByYear[String(year)] = votes
    municipalities[entry.slug].validVotesByYear[String(year)] = valid
    municipalities[entry.slug].campoFederalVotesByYear[String(year)] = campo
    municipalities[entry.slug].federalTallyByYear[String(year)] = tally
    yearTotal += votes
    campoTotal += campo
  }
  console.log(
    `[build:election-aggregates] ${year}: ${yearTotal} votes for #${candidateNumber} ` +
      `(campo total: ${campoTotal}).`,
  )
}

// 2022-only: majoritarian (presidente/governador #13) votes + tally, used for
// "teto do campo" and roll-off — no majoritária seeded for 2014/2018 (E8 audit).
const majoritarianOffices = [
  {
    key: 'president',
    office: 'presidente',
    candidateNumber: BASELINE_TICKET_2022.president.candidateNumber,
  },
  {
    key: 'governor',
    office: 'governador',
    candidateNumber: BASELINE_TICKET_2022.governor.candidateNumber,
  },
]

const majoritarianByOffice = {}
for (const { key, office, candidateNumber: officeCandidateNumber } of majoritarianOffices) {
  const [votes, tally] = await Promise.all([
    loadCandidateVotesByCityZone(payload, cliReader, {
      year: ELECTION_YEAR_2022,
      office,
      turn: '1',
      candidateNumber: officeCandidateNumber,
    }),
    loadOfficeTallyByCityZone(payload, cliReader, { year: ELECTION_YEAR_2022, office, turn: '1' }),
  ])
  majoritarianByOffice[key] = { votes, tally }
}

let presidentTotal = 0
for (const entry of municipalityCatalog) {
  const geography = municipalityElectionGeography(entry)
  const president = {
    votes: sumVotesForGeography(majoritarianByOffice.president.votes, geography),
    ...sumOfficeTallyForGeography(majoritarianByOffice.president.tally, geography),
  }
  const governor = {
    votes: sumVotesForGeography(majoritarianByOffice.governor.votes, geography),
    ...sumOfficeTallyForGeography(majoritarianByOffice.governor.tally, geography),
  }
  municipalities[entry.slug].majoritarian2022 = { president, governor }
  presidentTotal += president.votes
}
console.log(
  `[build:election-aggregates] 2022 majoritarian: ${presidentTotal} votes for president #${BASELINE_TICKET_2022.president.candidateNumber}.`,
)

// B13 "posição no município": where the candidate placed among every federal
// deputy voted inside each municipality. Keyed by IBGE code rather than by
// catalog slug because the competitive question only has an answer for a whole
// city — Salvador's 19 zone municipalities are one placement, and the map
// paints one polygon for them anyway.
const geographiesByIbgeCode = new Map()
for (const entry of municipalityCatalog) {
  const geographies = geographiesByIbgeCode.get(entry.ibgeCode) ?? []
  geographies.push(municipalityElectionGeography(entry))
  geographiesByIbgeCode.set(entry.ibgeCode, geographies)
}

const federalRankByIbgeCode = {}
for (const year of HISTORICAL_SERIES_YEARS) {
  const votesByCityZoneAndCandidate = await loadFederalVotesByCityZoneAndCandidate(
    payload,
    cliReader,
    { year },
  )

  for (const [ibgeCode, geographies] of geographiesByIbgeCode) {
    const byCandidate = new Map()
    for (const geography of geographies) {
      for (const [number, votes] of sumCandidateVotesForGeography(
        votesByCityZoneAndCandidate,
        geography,
      )) {
        byCandidate.set(number, (byCandidate.get(number) ?? 0) + votes)
      }
    }

    const ownVotes = byCandidate.get(candidateNumber) ?? 0
    // No votes here means no placement — a last place would read as a fact
    // when it is really absence of data.
    if (ownVotes <= 0) continue

    let ahead = 0
    let candidates = 0
    for (const votes of byCandidate.values()) {
      if (votes <= 0) continue
      candidates += 1
      if (votes > ownVotes) ahead += 1
    }

    federalRankByIbgeCode[ibgeCode] ??= {}
    // Competition rank: tied candidates share a placement.
    federalRankByIbgeCode[ibgeCode][String(year)] = { rank: ahead + 1, candidates }
  }

  const ranked = Object.values(federalRankByIbgeCode).filter(
    (byYear) => byYear[String(year)] !== undefined,
  ).length
  console.log(
    `[build:election-aggregates] ${year}: placement computed for ${ranked}/${geographiesByIbgeCode.size} IBGE municipalities.`,
  )
}

const artifact = {
  provenance:
    'Derived from TSE open data seeded by pnpm db:seed:tse; regenerate with pnpm build:election-aggregates.',
  candidateNumber,
  candidateName: BASELINE_TICKET_2022.candidate.name,
  years: [...HISTORICAL_SERIES_YEARS],
  municipalities,
  federalRankByIbgeCode,
}

await mkdir(OUTPUT_DIR, { recursive: true })
await writeFile(OUTPUT_FILE, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(
  `[build:election-aggregates] Wrote ${OUTPUT_FILE} (${municipalityCatalog.length} municipalities × ${HISTORICAL_SERIES_YEARS.length} years).`,
)
process.exit(0)
