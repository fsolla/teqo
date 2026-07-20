/**
 * Builds static Bahia municipality name → TSE city code (CD_MUNICIPIO) mapping.
 *
 * Provenance (do not strip):
 * - TSE open data — Results 2022, detalhe da apuração por município e zona, UF BA:
 *     https://dadosabertos.tse.jus.br/dataset/resultados-2022
 *     https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2022.zip
 *     Entry: detalhe_votacao_munzona_2022_BA.csv
 *
 * Safety: does not touch any database — only downloads public TSE CSV and writes
 * versioned artifacts under src/lib/ and tests/fixtures/.
 *
 * Usage:
 *   pnpm build:tse-city-codes
 *   TSE_CACHE_DIR=./data/tse pnpm build:tse-city-codes
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { canonicalizeMunicipalityName, UnknownMunicipalityError } = await import(
  '../src/lib/electionResults.ts'
)
const { bahiaMunicipalities } = await import('../src/lib/bahiaTerritories.ts')
const { parseTseCsvBuffer } = await import('../src/lib/electionResultsCsv.ts')
const { downloadToBuffer, readZipEntry } = await import('../src/lib/electionResultsZip.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCE = {
  key: 'detalhe_votacao_munzona_2022',
  url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2022.zip',
  csvName: 'detalhe_votacao_munzona_2022_BA.csv',
}

const die = (message) => {
  console.error(`\n[build:tse-city-codes] ${message}\n`)
  process.exit(1)
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const cacheDir = () => process.env.TSE_CACHE_DIR || join(ROOT, 'data', 'tse')

const ensureCachedZip = async () => {
  const dir = cacheDir()
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${SOURCE.key}.zip`)
  try {
    await access(path)
    console.log(`[build:tse-city-codes] cache hit ${path}`)
    const buffer = await readFile(path)
    return { url: SOURCE.url, hash: sha256(buffer), buffer }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  console.log(`[build:tse-city-codes] downloading ${SOURCE.url}`)
  const buffer = await downloadToBuffer(SOURCE.url)
  const hash = sha256(buffer)
  await writeFile(path, buffer)
  console.log(`[build:tse-city-codes] saved ${path} (${buffer.length} bytes, sha256=${hash})`)
  return { url: SOURCE.url, hash, buffer }
}

const writeJson = async (relativePath, value) => {
  const path = join(ROOT, relativePath)
  await mkdir(dirname(path), { recursive: true })
  const body = `${JSON.stringify(value, null, 2)}\n`
  await writeFile(path, body)
  console.log(`[build:tse-city-codes] wrote ${relativePath} (${Buffer.byteLength(body)} bytes)`)
}

const writeText = async (relativePath, body) => {
  const path = join(ROOT, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, body)
  console.log(`[build:tse-city-codes] wrote ${relativePath} (${Buffer.byteLength(body)} bytes)`)
}

const buildCityCodesModule = (entries, provenance) => {
  const lines = entries
    .map(([name, code]) => `  ${JSON.stringify(name)}: ${JSON.stringify(code)},`)
    .join('\n')

  return `/**
 * Official Bahia municipality name → TSE city code (CD_MUNICIPIO) mapping.
 *
 * Source (TSE open data — Results 2022, detalhe da apuração por município e zona, UF BA; accessed ${provenance.accessed}):
 * ${provenance.url}
 * Download SHA-256: ${provenance.downloadSha256}
 * CSV entry: ${provenance.csvName}
 *
 * This is the TSE electoral municipality code — NOT the IBGE 7-digit codarea
 * (see bahiaMunicipalityCodes.ts). Election collections filter by this code.
 *
 * Municipality spellings follow the canonical application names in bahiaTerritories.
 * TSE variants were reconciled via canonicalizeMunicipalityName. Coverage is
 * independently checked by the official test evidence fixture.
 */

import { isBahiaMunicipality } from '@/lib/bahiaTerritories'

export const bahiaTseCityCodes: Readonly<Record<string, string>> = {
${lines}
}

export const tseCityCodeForMunicipality = (name: string): string | undefined => {
  if (!isBahiaMunicipality(name)) return undefined
  return bahiaTseCityCodes[name]
}

const municipalityByTseCityCode = new Map(
  Object.entries(bahiaTseCityCodes).map(([name, code]) => [code, name]),
)

export const municipalityForTseCityCode = (cityCode: string): string | undefined =>
  municipalityByTseCityCode.get(cityCode)
`
}

const main = async () => {
  const { url, hash, buffer } = await ensureCachedZip()
  const entry = await readZipEntry(buffer, SOURCE.csvName)
  if (!entry) die(`Missing ${SOURCE.csvName} in TSE zip`)
  const rows = parseTseCsvBuffer(entry.buffer)

  /** @type {Map<string, string>} canonical name → TSE city code */
  const codeByCanonical = new Map()
  /** @type {Map<string, string>} TSE city code → canonical name */
  const canonicalByCode = new Map()

  for (const row of rows) {
    if ((row.SG_UF ?? '').trim().toUpperCase() !== 'BA') continue
    const rawCode = (row.CD_MUNICIPIO ?? '').trim()
    if (!rawCode) continue
    let canonical
    try {
      canonical = canonicalizeMunicipalityName(row.NM_MUNICIPIO ?? '')
    } catch (error) {
      if (!(error instanceof UnknownMunicipalityError)) throw error
      die(`TSE name without canonical mapping: "${row.NM_MUNICIPIO}"`)
    }
    const existing = codeByCanonical.get(canonical)
    if (existing && existing !== rawCode) {
      die(`Conflicting TSE codes for ${canonical}: ${existing} vs ${rawCode}`)
    }
    const existingName = canonicalByCode.get(rawCode)
    if (existingName && existingName !== canonical) {
      die(`Conflicting municipalities for TSE code ${rawCode}: ${existingName} vs ${canonical}`)
    }
    codeByCanonical.set(canonical, rawCode)
    canonicalByCode.set(rawCode, canonical)
  }

  if (codeByCanonical.size !== 417) {
    die(`Expected 417 Bahia municipalities; parsed ${codeByCanonical.size} from TSE CSV`)
  }

  const missing = bahiaMunicipalities.filter((city) => !codeByCanonical.has(city))
  if (missing.length > 0) {
    die(`Missing TSE city codes for: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`)
  }

  const accessed = new Date().toISOString().slice(0, 10)
  const provenance = { accessed, url, downloadSha256: hash, csvName: SOURCE.csvName }

  const codeEntries = [...codeByCanonical.entries()].sort(([left], [right]) =>
    left.localeCompare(right, 'pt-BR'),
  )

  await writeText('src/lib/bahiaTseCityCodes.ts', buildCityCodesModule(codeEntries, provenance))

  const assignmentRows = codeEntries
    .map(([municipality, code]) => `M\t${municipality}\t${code}\n`)
    .join('')
  const evidenceSha256 = createHash('sha256').update(assignmentRows).digest('hex')

  await writeJson('tests/fixtures/bahia-tse-city-codes.official.json', {
    provenance: {
      description:
        'Test-only evidence of Bahia municipality→TSE city code pairs derived independently from the TSE 2022 detalhe_votacao_munzona BA CSV. It was not generated from src/lib/bahiaTseCityCodes.ts.',
      source: {
        portal: 'https://dadosabertos.tse.jus.br/dataset/resultados-2022',
        url,
        downloadSha256: hash,
        csvName: SOURCE.csvName,
      },
    },
    municipalityCount: 417,
    assignments: codeEntries.map(([municipality, code]) => ({ municipality, code })),
    evidenceSha256,
  })

  console.log('[build:tse-city-codes] done — Salvador TSE code:', codeByCanonical.get('Salvador'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
