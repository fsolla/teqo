/**
 * Builds the committed per-municipality election baseline artifact consumed by
 * the campaign map (src/lib/electionAggregates/bahia-federal-baseline.json).
 *
 * Why an artifact instead of runtime queries: the 2014/2018/2022 TSE results
 * are immutable, but the map used to re-scan statewide city×zone slices on
 * every dashboard visit. Precomputing the per-municipality sums (Solla nominal
 * votes + federal T1 valid votes, cut by the same `municipalityCatalog`
 * geography used at runtime — Salvador split into zone municipalities, every
 * other municipality whole) removes all historical-year DB work.
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

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const payloadConfig = (await import('../src/payload.config.ts')).default
const { BASELINE_TICKET_2022, HISTORICAL_SERIES_YEARS } = await import(
  '../src/lib/electionResults.ts'
)
const { municipalityCatalog } = await import('../src/lib/municipalityCatalog.ts')
const { municipalityElectionGeography } = await import(
  '../src/utilities/municipalityElectionGeography.ts'
)
const {
  loadCandidateVotesByCityZone,
  loadValidVotesByCityZone,
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
  municipalities[entry.slug] = { votesByYear: {}, validVotesByYear: {} }
}

for (const year of HISTORICAL_SERIES_YEARS) {
  const [candidateVotes, validVotes] = await Promise.all([
    loadCandidateVotesByCityZone(payload, cliReader, { year, candidateNumber }),
    loadValidVotesByCityZone(payload, cliReader, { year }),
  ])

  if (candidateVotes.size === 0) {
    console.error(
      `[build:election-aggregates] No nominal votes found for ${year}. ` +
        `Seed the local database first: pnpm db:seed:tse -- --year=${year}`,
    )
    process.exit(1)
  }

  let yearTotal = 0
  for (const entry of municipalityCatalog) {
    const geography = municipalityElectionGeography(entry)
    const votes = sumVotesForGeography(candidateVotes, geography)
    const valid = sumVotesForGeography(validVotes, geography)
    municipalities[entry.slug].votesByYear[String(year)] = votes
    municipalities[entry.slug].validVotesByYear[String(year)] = valid
    yearTotal += votes
  }
  console.log(`[build:election-aggregates] ${year}: ${yearTotal} votes for #${candidateNumber}.`)
}

const artifact = {
  provenance:
    'Derived from TSE open data seeded by pnpm db:seed:tse; regenerate with pnpm build:election-aggregates.',
  candidateNumber,
  candidateName: BASELINE_TICKET_2022.candidate.name,
  years: [...HISTORICAL_SERIES_YEARS],
  municipalities,
}

await mkdir(OUTPUT_DIR, { recursive: true })
await writeFile(OUTPUT_FILE, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(
  `[build:election-aggregates] Wrote ${OUTPUT_FILE} (${municipalityCatalog.length} municipalities × ${HISTORICAL_SERIES_YEARS.length} years).`,
)
process.exit(0)
