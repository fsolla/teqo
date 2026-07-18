/**
 * Seeds electionTally / electionCandidateVote / electionCandidate from TSE
 * open data for the 2022 general election (Bahia scope).
 *
 * Provenance (do not strip):
 * - Portal: https://dadosabertos.tse.jus.br/dataset/resultados-2022
 * - Portal: https://dadosabertos.tse.jus.br/dataset/candidatos-2022
 * - votacao_candidato_munzona_2022.zip
 *     https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip
 * - detalhe_votacao_munzona_2022.zip
 *     https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2022.zip
 * - consulta_cand_2022.zip
 *     https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip
 * - License: Creative Commons Atribuição (dados abertos TSE)
 * - electionCandidateVote.votes ← QT_VOTOS_NOMINAIS (votos apurados; validade no tally)
 * - v1: only voteType=nominal (no votacao_partido_munzona / legenda rows)
 *
 * Safety: refuses non-local DATABASE_URL unless ALLOW_REMOTE_DB=true.
 * Idempotent: replace-by-scope (year, office, turn) via drizzle transaction.
 *
 * Usage:
 *   pnpm db:seed:tse
 *   ALLOW_REMOTE_DB=true pnpm db:seed:tse
 *   TSE_CACHE_DIR=./data/tse pnpm db:seed:tse   # reuse downloaded zips
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
const { buildElectionResultsFromCsvRows } = await import('../src/lib/electionResultsBuild.ts')
const { downloadToBuffer, readZipEntry } = await import('../src/lib/electionResultsZip.ts')
const { buildImportBundles, importElectionBundles } = await import(
  '../src/utilities/electionResultsImport.ts'
)

const SOURCES = [
  {
    key: 'votacao_candidato_munzona_2022',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip',
  },
  {
    key: 'detalhe_votacao_munzona_2022',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2022.zip',
  },
  {
    key: 'consulta_cand_2022',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip',
  },
]

const die = (message) => {
  console.error(`\n[seed:tse] ${message}\n`)
  process.exit(1)
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const cacheDir = () => process.env.TSE_CACHE_DIR || join(process.cwd(), 'data', 'tse')

const ensureCachedZip = async ({ key, url }) => {
  const dir = cacheDir()
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${key}.zip`)
  try {
    await access(path)
    console.log(`[seed:tse] cache hit ${path}`)
    const buffer = await readFile(path)
    return { key, url, buffer, hash: sha256(buffer) }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  console.log(`[seed:tse] downloading ${url}`)
  const buffer = await downloadToBuffer(url)
  const hash = sha256(buffer)
  await writeFile(path, buffer)
  console.log(`[seed:tse] saved ${path} (${buffer.length} bytes, sha256=${hash})`)
  return { key, url, buffer, hash }
}

const loadCsvFromZip = async (zipBuffer, fileName) => {
  const entry = await readZipEntry(zipBuffer, (name) => name.endsWith(fileName))
  if (!entry) die(`ZIP entry not found: ${fileName}`)
  console.log(`[seed:tse] parsing ${entry.fileName} (${entry.buffer.length} bytes)`)
  return parseTseCsvBuffer(entry.buffer)
}

const main = async () => {
  assertLocalDatabase(
    'seed:tse',
    'This seed WRITES election reference data and is meant for the local Postgres.\n' +
      '  1. pnpm db:start\n' +
      '  2. set DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo in .env.local',
  )

  const [votacaoZip, detalheZip, candZip] = await Promise.all(SOURCES.map(ensureCachedZip))

  console.log('[seed:tse] provenance:')
  for (const source of [votacaoZip, detalheZip, candZip]) {
    console.log(`  - ${source.url}`)
    console.log(`    sha256=${source.hash}`)
  }

  // Sequential: BA vote CSV alone is hundreds of MB; parallel parse spikes peak RAM.
  const voteBa = await loadCsvFromZip(votacaoZip.buffer, 'votacao_candidato_munzona_2022_BA.csv')
  const voteBr = await loadCsvFromZip(votacaoZip.buffer, 'votacao_candidato_munzona_2022_BR.csv')
  const detalheBa = await loadCsvFromZip(
    detalheZip.buffer,
    'detalhe_votacao_munzona_2022_BA.csv',
  )
  const detalheBr = await loadCsvFromZip(
    detalheZip.buffer,
    'detalhe_votacao_munzona_2022_BR.csv',
  )
  const candBa = await loadCsvFromZip(candZip.buffer, 'consulta_cand_2022_BA.csv')
  const candBr = await loadCsvFromZip(candZip.buffer, 'consulta_cand_2022_BR.csv')

  const built = buildElectionResultsFromCsvRows({
    voteRows: [...voteBa, ...voteBr],
    detalheRows: [...detalheBa, ...detalheBr],
    candBaRows: candBa,
    candBrRows: candBr,
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
    `\n[seed:tse] done. inserted votes=${votes} tallies=${tallies} candidates=${candidates}`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error('[seed:tse] fatal:', error)
  process.exit(1)
})
