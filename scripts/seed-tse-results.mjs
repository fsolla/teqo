/**
 * Seeds electionTally / electionCandidateVote / electionCandidate from TSE
 * open data (Bahia scope). Default year: 2022 (full ticket). Historical years
 * 2014/2018 import only deputado_federal turno 1 (E2 series).
 *
 * Provenance (do not strip):
 * - Portal 2022: https://dadosabertos.tse.jus.br/dataset/resultados-2022
 * - Portal 2018: https://dadosabertos.tse.jus.br/dataset/resultados-2018
 * - Portal 2014: https://dadosabertos.tse.jus.br/dataset/resultados-2014
 * - Portal candidatos: https://dadosabertos.tse.jus.br/dataset/candidatos-{year}
 * - CDN zips: https://cdn.tse.jus.br/estatistica/sead/odsele/{family}/{family}_{year}.zip
 * - License: Creative Commons Atribuição (dados abertos TSE)
 * - electionCandidateVote.votes ← QT_VOTOS_NOMINAIS (votos apurados; validade no tally)
 * - v1: only voteType=nominal (no votacao_partido_munzona / legenda rows)
 *
 * Pinned SHA-256 (update after verifying a fresh download):
 * - 2014/2018: log-only until first verified import in CI/local
 * - 2022: log-only (existing deployments may have cached zips)
 *
 * Safety: refuses non-local DATABASE_URL unless ALLOW_REMOTE_DB=true.
 * Idempotent: replace-by-scope (year, office, turn) via drizzle transaction.
 *
 * Usage:
 *   pnpm db:seed:tse
 *   pnpm db:seed:tse -- --year=2018
 *   pnpm db:seed:tse -- --year=2014
 *   ALLOW_REMOTE_DB=true pnpm db:seed:tse
 *   TSE_CACHE_DIR=./data/tse pnpm db:seed:tse
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const config = (await import('../src/payload.config.ts')).default
const { parseTseCsvBuffer } = await import('../src/lib/electionResultsCsv.ts')
const { buildElectionResultsFromCsvRows, FEDERAL_ONLY_OFFICES } = await import(
  '../src/lib/electionResultsBuild.ts'
)
const { downloadToBuffer, readZipEntry } = await import('../src/lib/electionResultsZip.ts')
const { buildImportBundles, importElectionBundles } = await import(
  '../src/utilities/electionResultsImport.ts'
)

const SUPPORTED_YEARS = [2014, 2018, 2022]

/** Optional integrity pins — null = warn on mismatch only after download. */
const EXPECTED_SHA256 = {
  2014: null,
  2018: null,
  2022: null,
}

const sourcesForYear = (year) => [
  {
    key: `votacao_candidato_munzona_${year}`,
    url: `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_${year}.zip`,
    expectedSha256: EXPECTED_SHA256[year],
  },
  {
    key: `detalhe_votacao_munzona_${year}`,
    url: `https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_${year}.zip`,
    expectedSha256: EXPECTED_SHA256[year],
  },
  {
    key: `consulta_cand_${year}`,
    url: `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_${year}.zip`,
    expectedSha256: EXPECTED_SHA256[year],
  },
]

const csvNamesForYear = (year) => ({
  voteBa: `votacao_candidato_munzona_${year}_BA.csv`,
  voteBr: `votacao_candidato_munzona_${year}_BR.csv`,
  detalheBa: `detalhe_votacao_munzona_${year}_BA.csv`,
  detalheBr: `detalhe_votacao_munzona_${year}_BR.csv`,
  candBa: `consulta_cand_${year}_BA.csv`,
  candBr: `consulta_cand_${year}_BR.csv`,
})

const die = (message) => {
  console.error(`\n[seed:tse] ${message}\n`)
  process.exit(1)
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const parseYearArg = () => {
  const explicit = process.argv.find((arg) => arg.startsWith('--year='))
  if (!explicit) return 2022
  const year = Number(explicit.slice('--year='.length))
  if (!SUPPORTED_YEARS.includes(year)) {
    die(`Unsupported --year=${year}. Supported: ${SUPPORTED_YEARS.join(', ')}`)
  }
  return year
}

const cacheDir = () => process.env.TSE_CACHE_DIR || join(process.cwd(), 'data', 'tse')

const ensureCachedZip = async ({ key, url, expectedSha256 }) => {
  const dir = cacheDir()
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${key}.zip`)
  let buffer
  try {
    await access(path)
    console.log(`[seed:tse] cache hit ${path}`)
    buffer = await readFile(path)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    console.log(`[seed:tse] downloading ${url}`)
    buffer = await downloadToBuffer(url)
    await writeFile(path, buffer)
    console.log(`[seed:tse] saved ${path} (${buffer.length} bytes)`)
  }

  const hash = sha256(buffer)
  if (expectedSha256 && hash !== expectedSha256) {
    die(
      `SHA-256 mismatch for ${key}\n  expected=${expectedSha256}\n  actual=${hash}\n  Delete ${path} and retry.`,
    )
  }
  return { key, url, buffer, hash }
}

const loadCsvFromZip = async (zipBuffer, fileName) => {
  const entry = await readZipEntry(zipBuffer, (name) => name.endsWith(fileName))
  if (!entry) die(`ZIP entry not found: ${fileName}`)
  console.log(`[seed:tse] parsing ${entry.fileName} (${entry.buffer.length} bytes)`)
  return parseTseCsvBuffer(entry.buffer)
}

const main = async () => {
  const year = parseYearArg()
  const historicalOnly = year === 2014 || year === 2018

  assertLocalDatabase(
    'seed:tse',
    'This seed WRITES election reference data and is meant for the local Postgres.\n' +
      '  1. pnpm db:start\n' +
      '  2. set DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo in .env.local',
  )

  const sources = sourcesForYear(year)
  const [votacaoZip, detalheZip, candZip] = await Promise.all(sources.map(ensureCachedZip))

  console.log(`[seed:tse] year=${year} scope=${historicalOnly ? 'deputado_federal T1 BA' : 'full ticket BA'}`)
  console.log('[seed:tse] provenance:')
  for (const source of [votacaoZip, detalheZip, candZip]) {
    console.log(`  - ${source.url}`)
    console.log(`    sha256=${source.hash}`)
  }

  const csv = csvNamesForYear(year)

  // Sequential: BA vote CSV alone is hundreds of MB; parallel parse spikes peak RAM.
  const voteBa = await loadCsvFromZip(votacaoZip.buffer, csv.voteBa)
  const voteBr = historicalOnly ? [] : await loadCsvFromZip(votacaoZip.buffer, csv.voteBr)
  const detalheBa = await loadCsvFromZip(detalheZip.buffer, csv.detalheBa)
  const detalheBr = historicalOnly ? [] : await loadCsvFromZip(detalheZip.buffer, csv.detalheBr)
  const candBa = await loadCsvFromZip(candZip.buffer, csv.candBa)
  const candBr = historicalOnly ? [] : await loadCsvFromZip(candZip.buffer, csv.candBr)

  const built = buildElectionResultsFromCsvRows({
    voteRows: [...voteBa, ...voteBr],
    tallyRows: [...detalheBa, ...detalheBr],
    candBaRows: candBa,
    candBrRows: candBr,
    year,
    ...(historicalOnly ? { offices: FEDERAL_ONLY_OFFICES } : {}),
  })

  if (built.unknownMunicipalities.length > 0) {
    die(
      `Municípios TSE sem mapeamento canônico (${built.unknownMunicipalities.length}):\n  - ` +
        built.unknownMunicipalities.slice(0, 20).join('\n  - ') +
        (built.unknownMunicipalities.length > 20 ? '\n  - …' : ''),
    )
  }

  console.log(
    `[seed:tse] parsed votes=${built.votes.length} tallies=${built.tallies.length} candidates=${built.candidates.length}`,
  )

  const bundles = buildImportBundles(built)
  console.log(`[seed:tse] importing ${bundles.length} scopes…`)

  const payload = await getPayload({ config })
  const counts = await importElectionBundles(payload, bundles)

  let votes = 0
  let tallies = 0
  let candidates = 0
  for (const count of counts) {
    votes += count.votesInserted
    tallies += count.talliesInserted
    candidates += count.candidatesInserted
    console.log(
      `  ${count.scope.office} turn=${count.scope.turn}: votes=${count.votesInserted} tallies=${count.talliesInserted} candidates=${count.candidatesInserted}`,
    )
  }

  console.log(
    `\n[seed:tse] done (year=${year}). inserted votes=${votes} tallies=${tallies} candidates=${candidates}`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error('[seed:tse] fatal:', error)
  process.exit(1)
})
