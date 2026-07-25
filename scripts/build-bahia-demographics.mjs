/**
 * Builds static Bahia municipality demographics from IBGE SIDRA (Censo 2022).
 *
 * Provenance:
 * - SIDRA table 9514 — População residente, por sexo, idade e forma de declaração da idade (2022, N6):
 *     https://apisidra.ibge.gov.br/values/t/9514/n3/29/n6/all/v/93/p/2022
 * - SIDRA table 9515 — Idade mediana (2022, N6):
 *     https://apisidra.ibge.gov.br/values/t/9515/n3/29/n6/all/v/10613/p/2022
 *
 * Safety: does not touch any database — only downloads public SIDRA JSON and writes
 * versioned artifacts under src/lib/ and tests/fixtures/.
 *
 * Usage:
 *   pnpm build:demographics
 *   DEMOGRAPHICS_CACHE_DIR=./data/demographics pnpm build:demographics
 */

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { bahiaMunicipalityCodes } = await import('../src/lib/bahiaMunicipalityCodes.ts')
const { downloadToBuffer } = await import('../src/lib/electionResultsZip.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCES = {
  femalePopulation: {
    key: 'sidra-9514-ba-municipios-mulheres',
    url: 'https://apisidra.ibge.gov.br/values/t/9514/n3/29/n6/all/v/93/p/2022/c2/5/c287/100362',
  },
  medianAge: {
    key: 'sidra-9515-ba-municipios-idade-mediana',
    url: 'https://apisidra.ibge.gov.br/values/t/9515/n3/29/n6/all/v/10613/p/2022',
  },
}

/** SIDRA classification 287 (Idade) category ids grouped for the app bands. */
const AGE_BAND_CATEGORY_IDS = {
  '0-17': [93070, 93084, 93085, 6572, 6573, 6574],
  '18-29': [6575, 6576, 6577, 6578, 6579, 6580, 6581, 93088],
  '30-59': [93089, 93090, 93091, 93092, 93093, 93094],
  '60+': [93095, 93096, 93097, 93098, 49108, 49109, 60040, 60041, 6653],
}

const AGE_CATEGORY_TO_BAND = Object.fromEntries(
  Object.entries(AGE_BAND_CATEGORY_IDS).flatMap(([band, ids]) =>
    ids.map((id) => [String(id), band]),
  ),
)

const die = (message) => {
  console.error(`\n[build:demographics] ${message}\n`)
  process.exit(1)
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const cacheDir = () => process.env.DEMOGRAPHICS_CACHE_DIR || join(ROOT, 'data', 'demographics')

const ensureCachedJson = async ({ key, url }) => {
  const dir = cacheDir()
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${key}.json`)
  try {
    await access(path)
    console.log(`[build:demographics] cache hit ${path}`)
    const buffer = await readFile(path)
    return { url, hash: sha256(buffer), json: JSON.parse(buffer.toString('utf8')) }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  console.log(`[build:demographics] downloading ${url}`)
  const buffer = await downloadToBuffer(url)
  const hash = sha256(buffer)
  await writeFile(path, buffer)
  console.log(`[build:demographics] saved ${path} (${buffer.length} bytes, sha256=${hash})`)
  return { url, hash, json: JSON.parse(buffer.toString('utf8')) }
}

const writeText = async (relativePath, body) => {
  const path = join(ROOT, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, body)
  console.log(`[build:demographics] wrote ${relativePath} (${Buffer.byteLength(body)} bytes)`)
}

const parseSidraValue = (value) => {
  if (value === '...' || value === '-' || value === 'X' || value == null || value === '') return 0
  const parsed = Number.parseInt(String(value).replace(/\./g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

const municipalityRows = (rows) =>
  rows.filter((row) => row?.NC === '6' && String(row?.D1C ?? '').startsWith('29'))

const buildDemographicsByCode = ({ ageCategoryRows, femaleRows, medianRows }) => {
  const byCode = new Map()

  for (const { categoryId, rows } of ageCategoryRows) {
    const band = AGE_CATEGORY_TO_BAND[String(categoryId)]
    if (!band) continue

    for (const row of municipalityRows(rows)) {
      const code = String(row.D1C)
      const current = byCode.get(code) ?? {
        population: 0,
        ageBands: { '0-17': 0, '18-29': 0, '30-59': 0, '60+': 0 },
        femalePopulation: 0,
        medianAge: null,
      }
      current.ageBands[band] += parseSidraValue(row.V)
      byCode.set(code, current)
    }
  }

  for (const row of municipalityRows(femaleRows)) {
    const code = String(row.D1C)
    const current = byCode.get(code)
    if (!current) continue
    current.femalePopulation = parseSidraValue(row.V)
  }

  for (const row of municipalityRows(medianRows)) {
    const code = String(row.D1C)
    const current = byCode.get(code)
    if (!current) continue
    const median = Number.parseFloat(String(row.V).replace(',', '.'))
    current.medianAge = Number.isFinite(median) ? median : null
  }

  for (const record of byCode.values()) {
    record.population = Object.values(record.ageBands).reduce((sum, value) => sum + value, 0)
    record.sexShareFemale = record.population > 0 ? record.femalePopulation / record.population : 0
    delete record.femalePopulation
  }

  return byCode
}

const buildModuleSource = (demographicsByCode, provenance) => {
  const entries = [...demographicsByCode.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const lines = entries
    .map(([code, record]) => {
      const bands = Object.entries(record.ageBands)
        .map(([band, value]) => `${JSON.stringify(band)}: ${value}`)
        .join(', ')
      const median = record.medianAge == null ? 'null' : JSON.stringify(record.medianAge)
      const sexShare = record.sexShareFemale.toFixed(6)
      return `  ${JSON.stringify(code)}: { population: ${record.population}, ageBands: { ${bands} }, sexShareFemale: ${sexShare}, medianAge: ${median} },`
    })
    .join('\n')

  return `/**
 * IBGE Censo 2022 municipality demographics for Bahia (codarea → indicators).
 *
 * Source (SIDRA table 9514 — população por idade, UF BA N6; accessed ${provenance.accessed}):
 * ${provenance.ageCategoryUrls.join('\n * ')}
 * Download SHA-256: ${provenance.ageCategorySha256.join(', ')}
 *
 * Source (SIDRA table 9514 — população feminina total, UF BA N6; accessed ${provenance.accessed}):
 * ${provenance.femaleUrl}
 * Download SHA-256: ${provenance.femaleSha256}
 *
 * Source (SIDRA table 9515 — idade mediana, UF BA N6; accessed ${provenance.accessed}):
 * ${provenance.medianUrl}
 * Download SHA-256: ${provenance.medianSha256}
 *
 * Age bands aggregate SIDRA classification 287 categories documented in scripts/build-bahia-demographics.mjs.
 * Coverage is independently checked by tests/fixtures/bahia-municipality-demographics.official.json.
 */

import { codeForMunicipality } from '@/lib/bahiaMunicipalityCodes'

export type MunicipalityAgeBandKey = '0-17' | '18-29' | '30-59' | '60+'

export type MunicipalityDemographics = {
  population: number
  ageBands: Record<MunicipalityAgeBandKey, number>
  sexShareFemale: number
  medianAge: number | null
}

export const bahiaMunicipalityDemographics: Readonly<Record<string, MunicipalityDemographics>> = {
${lines}
}

export const demographicsForCode = (codarea: string): MunicipalityDemographics | undefined =>
  bahiaMunicipalityDemographics[codarea]

export const demographicsForMunicipalityName = (
  municipality: string,
): MunicipalityDemographics | undefined => {
  const code = codeForMunicipality(municipality)
  return code ? demographicsForCode(code) : undefined
}
`
}

const buildFixture = (demographicsByCode) => {
  const assignments = [...demographicsByCode.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, record]) => ({
      code,
      population: record.population,
      ageBands: record.ageBands,
      sexShareFemale: Number(record.sexShareFemale.toFixed(6)),
      medianAge: record.medianAge,
    }))

  const evidenceRows = assignments
    .map(
      ({ code, population, ageBands, sexShareFemale, medianAge }) =>
        `D\t${code}\t${population}\t${ageBands['0-17']}\t${ageBands['18-29']}\t${ageBands['30-59']}\t${ageBands['60+']}\t${sexShareFemale}\t${medianAge ?? ''}\n`,
    )
    .join('')

  return {
    municipalityCount: assignments.length,
    assignments,
    evidenceSha256: sha256(Buffer.from(evidenceRows, 'utf8')),
  }
}

const main = async () => {
  const accessed = new Date().toISOString().slice(0, 10)
  const uniqueCategoryIds = [
    ...new Set(Object.values(AGE_BAND_CATEGORY_IDS).flatMap((ids) => ids)),
  ].sort((left, right) => left - right)

  const ageCategoryDownloads = []
  for (const categoryId of uniqueCategoryIds) {
    const download = await ensureCachedJson({
      key: `sidra-9514-ba-idade-${categoryId}`,
      url: `https://apisidra.ibge.gov.br/values/t/9514/n3/29/n6/all/v/93/p/2022/c2/6794/c287/${categoryId}`,
    })
    ageCategoryDownloads.push({ categoryId, ...download })
  }

  const female = await ensureCachedJson(SOURCES.femalePopulation)
  const median = await ensureCachedJson(SOURCES.medianAge)

  const demographicsByCode = buildDemographicsByCode({
    ageCategoryRows: ageCategoryDownloads.map(({ categoryId, json }) => ({
      categoryId,
      rows: json,
    })),
    femaleRows: female.json,
    medianRows: median.json,
  })

  const expectedCodes = new Set(Object.values(bahiaMunicipalityCodes))
  if (demographicsByCode.size !== expectedCodes.size) {
    die(
      `expected ${expectedCodes.size} municipality rows, got ${demographicsByCode.size} from SIDRA`,
    )
  }

  for (const code of expectedCodes) {
    if (!demographicsByCode.has(code)) {
      die(`missing demographics for codarea ${code}`)
    }
    const record = demographicsByCode.get(code)
    if (record.population <= 0) {
      die(`non-positive population for codarea ${code}`)
    }
  }

  const provenance = {
    accessed,
    ageCategoryUrls: ageCategoryDownloads.map(({ url }) => url),
    ageCategorySha256: ageCategoryDownloads.map(({ hash }) => hash),
    femaleUrl: female.url,
    femaleSha256: female.hash,
    medianUrl: median.url,
    medianSha256: median.hash,
  }

  await writeText(
    'src/lib/bahiaMunicipalityDemographics.ts',
    buildModuleSource(demographicsByCode, provenance),
  )
  await writeText(
    'tests/fixtures/bahia-municipality-demographics.official.json',
    `${JSON.stringify(buildFixture(demographicsByCode), null, 2)}\n`,
  )

  console.log(
    `[build:demographics] done — ${demographicsByCode.size} municipalities, total population ${[...demographicsByCode.values()].reduce((sum, row) => sum + row.population, 0)}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
