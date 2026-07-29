/**
 * Builds static Bahia municipality + identity-territory TopoJSON and the
 * name→IBGE-code table for the campaign map (roadmap B2).
 *
 * Provenance (do not strip):
 * - IBGE Malhas API v3 (UF BA=29, municipal intrarregião, qualidade intermediaria):
 *     https://servicodados.ibge.gov.br/api/v3/malhas/estados/29?formato=application/vnd.geo+json&intrarregiao=municipio&qualidade=intermediaria
 * - IBGE Localidades API v1 (municipality id + name for BA):
 *     https://servicodados.ibge.gov.br/api/v1/localidades/estados/29/municipios
 * - Identity-territory composition: src/lib/bahiaTerritories.ts (SECULT/SEPLAN;
 *     territory polygons are dissolved from IBGE municipality meshes — decision
 *     2026-07-18). IDE Bahia / SEI territory polygons remain a validation
 *     reference only:
 *     https://metadados.ide.ba.gov.br/geonetwork/srv/api/records/90b140bf-17df-496f-b048-5783fdf02864
 *
 * Safety: does not touch any database — only downloads public IBGE JSON and
 * writes versioned artifacts under src/lib/ and tests/fixtures/.
 *
 * Usage:
 *   pnpm build:geometries
 *   GEOMETRIES_CACHE_DIR=./data/geometries pnpm build:geometries
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dieWithLabel, ensureCachedDownload, sha256Hex, writeRepoFile } from './lib/cli.mjs'

import { merge } from 'topojson-client'
import { topology } from 'topojson-server'

import {
  describeGroundScale,
  SIMPLIFY_TOLERANCE_M2,
  simplifyToGroundScale,
} from './lib/topology.mjs'

const { canonicalizeMunicipalityName, UnknownMunicipalityError } =
  await import('../src/lib/electionResults.ts')
const { bahiaMunicipalities, bahiaIdentityTerritoryRecords } =
  await import('../src/lib/bahiaTerritories.ts')
const { downloadToBuffer } = await import('../src/lib/electionResultsZip.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCES = {
  malhas: {
    key: 'bahia-malhas-municipios-intermediaria',
    url: 'https://servicodados.ibge.gov.br/api/v3/malhas/estados/29?formato=application/vnd.geo+json&intrarregiao=municipio&qualidade=intermediaria',
    ext: 'geojson',
  },
  localidades: {
    key: 'bahia-localidades-municipios',
    url: 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/29/municipios',
    ext: 'json',
  },
}

const die = dieWithLabel('build:geometries')

const cacheDir = () => process.env.GEOMETRIES_CACHE_DIR || join(ROOT, 'data', 'geometries')

const ensureCachedJson = ({ key, url, ext }) =>
  ensureCachedDownload({
    label: 'build:geometries',
    key,
    url,
    ext,
    cacheDir: cacheDir(),
    download: downloadToBuffer,
  })

const writeJson = (relativePath, value) =>
  writeRepoFile({
    label: 'build:geometries',
    root: ROOT,
    relativePath,
    body:
      typeof value === 'string'
        ? value
        : `${JSON.stringify(value)}
`,
  })

const buildMunicipalityCodesModule = (entries, provenance) => {
  const lines = entries
    .map(([name, code]) => `  ${JSON.stringify(name)}: ${JSON.stringify(code)},`)
    .join('\n')

  return `/**
 * Official Bahia municipality name → IBGE 7-digit code (codarea) mapping.
 *
 * Source (IBGE Localidades API v1 — municípios da UF BA; accessed ${provenance.accessed}):
 * ${provenance.localidadesUrl}
 * Download SHA-256: ${provenance.localidadesSha256}
 *
 * Mesh provenance (IBGE Malhas API v3 — qualidade intermediaria; accessed ${provenance.accessed}):
 * ${provenance.malhasUrl}
 * Download SHA-256: ${provenance.malhasSha256}
 *
 * Municipality spellings follow the canonical application names in bahiaTerritories.
 * IBGE variants (Araçás, Iuiu, Muquém do São Francisco, Santa Terezinha) were
 * reconciled via canonicalizeMunicipalityName. Coverage is independently checked
 * by the official test evidence fixture.
 */

import { isBahiaMunicipality } from '@/lib/bahiaTerritories'

export const bahiaMunicipalityCodes: Readonly<Record<string, string>> = {
${lines}
}

export const codeForMunicipality = (name: string): string | undefined => {
  if (!isBahiaMunicipality(name)) return undefined
  return bahiaMunicipalityCodes[name]
}

const municipalityByCode = new Map(
  Object.entries(bahiaMunicipalityCodes).map(([name, code]) => [code, name]),
)

export const municipalityForCode = (codarea: string): string | undefined =>
  municipalityByCode.get(codarea)
`
}

const main = async () => {
  const malhas = await ensureCachedJson(SOURCES.malhas)
  const localidades = await ensureCachedJson(SOURCES.localidades)

  console.log('[build:geometries] provenance:')
  console.log(`  - ${malhas.url}`)
  console.log(`    sha256=${malhas.hash}`)
  console.log(`  - ${localidades.url}`)
  console.log(`    sha256=${localidades.hash}`)

  if (!Array.isArray(localidades.json) || localidades.json.length !== 417) {
    die(`Expected 417 IBGE localidades; got ${localidades.json?.length ?? 'non-array'}`)
  }
  if (malhas.json?.type !== 'FeatureCollection' || malhas.json.features?.length !== 417) {
    die(`Expected 417 IBGE malha features; got ${malhas.json?.features?.length ?? 'invalid'}`)
  }

  /** @type {Map<string, string>} canonical name → IBGE codarea */
  const codeByCanonical = new Map()
  /** @type {Map<string, string>} IBGE codarea → canonical name */
  const canonicalByCodarea = new Map()

  for (const row of localidades.json) {
    const codarea = String(row.id)
    if (!/^\d{7}$/.test(codarea) || !codarea.startsWith('29')) {
      die(`Unexpected IBGE municipality id: ${row.id}`)
    }
    let canonical
    try {
      canonical = canonicalizeMunicipalityName(row.nome)
    } catch (error) {
      if (!(error instanceof UnknownMunicipalityError)) throw error
      die(`IBGE name without canonical mapping: "${row.nome}"`)
    }
    if (codeByCanonical.has(canonical)) {
      die(`Duplicate canonical municipality from IBGE: ${canonical}`)
    }
    codeByCanonical.set(canonical, codarea)
    canonicalByCodarea.set(codarea, canonical)
  }

  const missing = bahiaMunicipalities.filter((name) => !codeByCanonical.has(name))
  if (missing.length > 0) {
    die(`Canonical municipalities missing from IBGE localidades:\n  - ${missing.join('\n  - ')}`)
  }
  if (codeByCanonical.size !== 417) {
    die(`Expected 417 canonical mappings; got ${codeByCanonical.size}`)
  }

  const municipalityFeatures = []
  for (const feature of malhas.json.features) {
    const codarea = String(feature.properties?.codarea ?? '')
    const name = canonicalByCodarea.get(codarea)
    if (!name) die(`Malha feature codarea not in localidades: ${codarea}`)
    municipalityFeatures.push({
      type: 'Feature',
      properties: { codarea, name },
      geometry: feature.geometry,
    })
  }
  municipalityFeatures.sort((left, right) =>
    left.properties.name.localeCompare(right.properties.name, 'pt-BR'),
  )

  let municipalityTopo = topology({
    municipalities: { type: 'FeatureCollection', features: municipalityFeatures },
  })
  municipalityTopo = simplifyToGroundScale(
    municipalityTopo,
    SIMPLIFY_TOLERANCE_M2.bahiaMunicipalities,
  )
  console.log(`[build:geometries] ${describeGroundScale(municipalityTopo)}`)

  const geometriesByCodarea = new Map(
    municipalityTopo.objects.municipalities.geometries.map((geometry) => [
      geometry.properties.codarea,
      geometry,
    ]),
  )

  const territoryFeatures = bahiaIdentityTerritoryRecords.map((territory) => {
    const memberGeometries = territory.municipalities.map((name) => {
      const code = codeByCanonical.get(name)
      const geometry = geometriesByCodarea.get(code)
      if (!geometry)
        die(`Missing municipality geometry for ${name} (${code}) in territory ${territory.code}`)
      return geometry
    })
    return {
      type: 'Feature',
      properties: { code: territory.code, name: territory.name },
      geometry: merge(municipalityTopo, memberGeometries),
    }
  })

  let territoryTopo = topology({
    territories: { type: 'FeatureCollection', features: territoryFeatures },
  })
  territoryTopo = simplifyToGroundScale(
    territoryTopo,
    SIMPLIFY_TOLERANCE_M2.bahiaIdentityTerritories,
  )
  console.log(`[build:geometries] ${describeGroundScale(territoryTopo)}`)

  const accessed = new Date().toISOString().slice(0, 10)
  const provenance = {
    accessed,
    malhasUrl: malhas.url,
    malhasSha256: malhas.hash,
    localidadesUrl: localidades.url,
    localidadesSha256: localidades.hash,
  }

  const codeEntries = [...codeByCanonical.entries()].sort(([left], [right]) =>
    left.localeCompare(right, 'pt-BR'),
  )

  await writeJson('src/lib/geometries/bahia-municipalities.topo.json', municipalityTopo)
  await writeJson('src/lib/geometries/bahia-identity-territories.topo.json', territoryTopo)
  await writeJson(
    'src/lib/bahiaMunicipalityCodes.ts',
    buildMunicipalityCodesModule(codeEntries, provenance),
  )

  const assignmentRows = codeEntries
    .map(([municipality, code]) => `M\t${municipality}\t${code}\n`)
    .join('')
  const evidenceSha256 = sha256Hex(assignmentRows)

  const fixture = {
    provenance: {
      description:
        'Test-only evidence for the Bahia municipality name→IBGE-code table. Rows are the canonical application spellings paired with IBGE 7-digit codes from the Localidades API; mesh SHA-256 documents the Malhas download used to build the committed TopoJSON.',
      localidadesSource: {
        url: localidades.url,
        downloadSha256: localidades.hash,
      },
      malhasSource: {
        url: malhas.url,
        quality: 'intermediaria',
        downloadSha256: malhas.hash,
      },
      territoryComposition:
        'Identity-territory polygons are dissolved from IBGE municipality meshes using bahiaIdentityTerritoryRecords (SECULT/SEPLAN composition). IDE Bahia / SEI territory polygons are a validation reference only.',
      accessed,
      normalization:
        'IBGE Localidades nomes were reconciled to canonical application spellings via canonicalizeMunicipalityName (Araçás→Araças, Iuiu→Iuiú, Muquém do São Francisco→Muquém de São Francisco, Santa Terezinha→Santa Teresinha). The evidence SHA-256 covers every canonical municipality→codarea assignment.',
    },
    municipalityCount: 417,
    assignments: codeEntries.map(([municipality, code]) => ({ municipality, code })),
    evidenceSha256,
  }

  await writeJson(
    'tests/fixtures/bahia-municipality-codes.official.json',
    `${JSON.stringify(fixture, null, 2)}\n`,
  )

  console.log('[build:geometries] done')
  console.log(`  municipalities: ${municipalityFeatures.length}`)
  console.log(`  territories: ${territoryFeatures.length}`)
  console.log(`  evidenceSha256: ${evidenceSha256}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
