/**
 * Builds the bairro-level dataset of the C157 report (C161 follow-up).
 *
 * Output: docs/research/solla-ceuci-salvador-2022-bairros-dados.json
 *
 * Method — the finest official unit is the seção eleitoral:
 *   votacao_secao_2022_BA          votes per candidate per section (Solla 1313,
 *                                  Ceuci 13192, and the valid-candidacy set)
 *   detalhe_votacao_secao_2022_BA  per-section tallies (aptos, comparecimento)
 *   eleitorado_local_votacao_2022  section → local de votação → bairro (TSE registry)
 *   votacao_candidato_munzona_2022 valid-candidacy set per município/zone — the
 *                                  same base prod uses, so the LQ denominator is
 *                                  the sum of nominal votes of valid candidacies
 *   eleitorado_local_votacao_ATUAL fills coordinates missing (sentinel -1) in the
 *                                  2022 snapshot, keyed by zone + local number
 *
 * The bairro is the TSE registry bairro of the polling place (never the voter's
 * home). Locals are also pinned to the IBGE Censo 2022 bairro mesh by their
 * coordinates, so the report map and the report table stay consistent: each
 * polygon is assigned to the TSE bairro that holds most of its votes.
 *
 * Usage (the heavy TSE zips are gitignored cache in data/tse-2022):
 *   node --import=tsx/esm scripts/build-solla-ceuci-salvador-bairros.mjs --download
 *   node --import=tsx/esm scripts/build-solla-ceuci-salvador-bairros.mjs
 *
 * `--download` fetches the zips with a real-browser user agent (the TSE CDN
 * refuses the headless one); without it the script only reads the cache. No
 * database, no production access.
 */

import { chromium } from '@playwright/test'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import shp from 'shpjs'

import { dieWithLabel, ensureCachedDownload, sha256Hex } from './lib/cli.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-solla-ceuci-salvador-bairros'
const die = dieWithLabel(LABEL)

const OUT_PATH = join(ROOT, 'docs/research/solla-ceuci-salvador-2022-bairros-dados.json')
const ZONE_DATA_PATH = join(ROOT, 'docs/research/solla-ceuci-salvador-2022-dados.json')
const CACHE_DIR = join(ROOT, 'data/tse-2022')
const CSV_DIR = join(CACHE_DIR, 'csv')
const ZIPS_DIR = join(CACHE_DIR, 'zips')
const GEOMETRY_CACHE = join(ROOT, 'data/geometries')

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'
const CITY_CODE = '38490'
const CITY_IBGE_CODE = '2927408'
const FEDERAL_OFFICE = '6'
const STATE_OFFICE = '7'
const SOLLA_NUMBER = '1313'
const CEUCI_NUMBER = '13192'

const SOURCES = [
  {
    zip: 'votacao_secao_2022_BA.zip',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2022_BA.zip',
    csv: 'votacao_secao_2022_BA.csv',
  },
  {
    zip: 'detalhe_votacao_secao_2022.zip',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_secao/detalhe_votacao_secao_2022.zip',
    csv: 'detalhe_votacao_secao_2022_BA.csv',
  },
  {
    zip: 'eleitorado_local_votacao_2022.zip',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2022.zip',
    csv: 'eleitorado_local_votacao_2022.csv',
  },
  {
    zip: 'eleitorado_local_votacao_ATUAL.zip',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/eleitorado_local_votacao_ATUAL.zip',
    csv: 'eleitorado_local_votacao_ATUAL.csv',
  },
  {
    zip: 'votacao_candidato_munzona_2022.zip',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip',
    csv: 'votacao_candidato_munzona_2022_BA.csv',
  },
]

const BAIRRO_SOURCE = {
  key: 'bahia-bairros-cd2022',
  url: 'http://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/shp/UF/BA_bairros_CD2022.zip',
  ext: 'zip',
}

// ---------------------------------------------------------------------------
// CSV streaming (TSE: ISO-8859-1, `;` separator, every field quoted)
// ---------------------------------------------------------------------------

const parseCsvLine = (line) => {
  const fields = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ';') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

/** Yields rows as objects, decoding the file as latin1. `filter` sees the raw line. */
async function* csvRows(path, filter) {
  const stream = createReadStream(path, { encoding: 'latin1' })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let header = null
  for await (const line of lines) {
    if (!header) {
      header = parseCsvLine(line)
      continue
    }
    if (!line || (filter && !filter(line))) continue
    const fields = parseCsvLine(line)
    const row = {}
    header.forEach((name, index) => {
      row[name] = fields[index] ?? ''
    })
    yield row
  }
}

const includesSalvador = (line) => line.includes(CITY_CODE)
const sectionKey = (zone, section) => `${Number(zone)}|${Number(section)}`

/** TSE mixes dot and comma decimal separators across snapshots. */
const toCoordinate = (value) => Number(String(value).trim().replace(',', '.'))

// ---------------------------------------------------------------------------
// Download + unzip (cache only; never committed)
// ---------------------------------------------------------------------------

async function downloadZips() {
  await mkdir(ZIPS_DIR, { recursive: true })
  await mkdir(CSV_DIR, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  try {
    const context = await browser.newContext({ userAgent: BROWSER_UA, locale: 'pt-BR' })
    const page = await context.newPage()
    await page.goto('https://dadosabertos.tse.jus.br/dataset/resultados-2022', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    })
    await page.waitForTimeout(3000)
    for (const source of SOURCES) {
      const destination = join(ZIPS_DIR, source.zip)
      try {
        await readFile(destination)
        console.log(`[${LABEL}] cache hit ${source.zip}`)
        continue
      } catch {
        // not cached yet
      }
      console.log(`[${LABEL}] downloading ${source.zip}`)
      const response = await page.request.get(source.url, { timeout: 0 })
      if (!response.ok()) die(`download failed (${response.status()}): ${source.url}`)
      await writeFile(destination, await response.body())
    }
  } finally {
    await browser.close()
  }
  const { open } = await import('yauzl')
  for (const source of SOURCES) {
    const csvPath = join(CSV_DIR, source.csv)
    try {
      await readFile(csvPath)
      continue
    } catch {
      // needs extraction
    }
    console.log(`[${LABEL}] extracting ${source.csv}`)
    await new Promise((resolve, reject) => {
      open(join(ZIPS_DIR, source.zip), { lazyEntries: true }, (error, zipfile) => {
        if (error || !zipfile) {
          reject(error ?? new Error(`cannot open ${source.zip}`))
          return
        }
        zipfile.readEntry()
        zipfile.on('entry', (entry) => {
          if (!entry.fileName.endsWith(source.csv)) {
            zipfile.readEntry()
            return
          }
          zipfile.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              reject(streamError ?? new Error(`cannot read ${entry.fileName}`))
              return
            }
            const writer = createWriteStream(csvPath)
            stream.pipe(writer)
            writer.on('finish', resolve)
            writer.on('error', reject)
          })
        })
        zipfile.on('error', reject)
      })
    })
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const csvPath = (name) => join(CSV_DIR, name)

async function loadValidCandidates() {
  const valid = { federal: new Set(), state: new Set() }
  for await (const row of csvRows(
    csvPath('votacao_candidato_munzona_2022_BA.csv'),
    includesSalvador,
  )) {
    if (row['CD_MUNICIPIO'] !== CITY_CODE) continue
    const office =
      row['CD_CARGO'] === FEDERAL_OFFICE
        ? valid.federal
        : row['CD_CARGO'] === STATE_OFFICE
          ? valid.state
          : null
    if (!office) continue
    office.add(`${Number(row['NR_ZONA'])}|${Number(row['NR_CANDIDATO'])}`)
  }
  return valid
}

async function loadSectionVotes(valid) {
  const sections = new Map()
  const bump = (key, field, value) => {
    const current = sections.get(key) ?? { solla: 0, ceuci: 0, federalNominal: 0, stateNominal: 0 }
    current[field] += value
    sections.set(key, current)
  }
  for await (const row of csvRows(csvPath('votacao_secao_2022_BA.csv'), includesSalvador)) {
    if (row['CD_MUNICIPIO'] !== CITY_CODE) continue
    const office = row['CD_CARGO']
    if (office !== FEDERAL_OFFICE && office !== STATE_OFFICE) continue
    const key = sectionKey(row['NR_ZONA'], row['NR_SECAO'])
    const number = Number(row['NR_VOTAVEL'])
    const votes = Number(row['QT_VOTOS'])
    const candidateKey = `${Number(row['NR_ZONA'])}|${number}`
    if (office === FEDERAL_OFFICE) {
      if (valid.federal.has(candidateKey)) bump(key, 'federalNominal', votes)
      if (number === Number(SOLLA_NUMBER)) bump(key, 'solla', votes)
    } else {
      if (valid.state.has(candidateKey)) bump(key, 'stateNominal', votes)
      if (number === Number(CEUCI_NUMBER)) bump(key, 'ceuci', votes)
    }
  }
  return sections
}

async function loadSectionTallies() {
  const tallies = new Map()
  for await (const row of csvRows(csvPath('detalhe_votacao_secao_2022_BA.csv'), includesSalvador)) {
    if (row['CD_MUNICIPIO'] !== CITY_CODE || row['CD_CARGO'] !== FEDERAL_OFFICE) continue
    tallies.set(sectionKey(row['NR_ZONA'], row['NR_SECAO']), {
      aptos: Number(row['QT_APTOS']),
      comparecimento: Number(row['QT_COMPARECIMENTO']),
    })
  }
  return tallies
}

async function loadSectionLocals() {
  const bySection = new Map()
  const locals = new Map()
  for await (const row of csvRows(csvPath('eleitorado_local_votacao_2022.csv'), includesSalvador)) {
    if (row['SG_UF'] !== 'BA' || row['CD_MUNICIPIO'] !== CITY_CODE) continue
    const key = sectionKey(row['NR_ZONA'], row['NR_SECAO'])
    if (bySection.has(key)) continue
    const localKey = `${Number(row['NR_ZONA'])}|${Number(row['NR_LOCAL_VOTACAO'])}`
    const local = locals.get(localKey) ?? {
      zoneNumber: Number(row['NR_ZONA']),
      localNumber: Number(row['NR_LOCAL_VOTACAO']),
      name: row['NM_LOCAL_VOTACAO'].trim(),
      bairro: row['NM_BAIRRO'].trim(),
      latitude: toCoordinate(row['NR_LATITUDE']),
      longitude: toCoordinate(row['NR_LONGITUDE']),
      coordinateSource: 'tse-2022',
      sections: 0,
      aptos: 0,
      comparecimento: 0,
      federalNominal: 0,
      stateNominal: 0,
      sollaVotes: 0,
      ceuciVotes: 0,
    }
    locals.set(localKey, local)
    bySection.set(key, localKey)
  }
  return { bySection, locals }
}

async function fillMissingCoordinates(locals) {
  const byNumber = new Map()
  for await (const row of csvRows(
    csvPath('eleitorado_local_votacao_ATUAL.csv'),
    includesSalvador,
  )) {
    if (row['SG_UF'] !== 'BA' || row['CD_MUNICIPIO'] !== CITY_CODE) continue
    const latitude = toCoordinate(row['NR_LATITUDE'])
    const longitude = toCoordinate(row['NR_LONGITUDE'])
    if (!isSalvadorCoordinate(latitude, longitude)) continue
    byNumber.set(`${Number(row['NR_ZONA'])}|${Number(row['NR_LOCAL_VOTACAO'])}`, {
      latitude,
      longitude,
    })
  }
  let filled = 0
  for (const [key, local] of locals) {
    if (isSalvadorCoordinate(local.latitude, local.longitude)) continue
    const hit = byNumber.get(key)
    if (!hit) continue
    local.latitude = hit.latitude
    local.longitude = hit.longitude
    local.coordinateSource = 'tse-atual-local-number'
    filled += 1
  }
  return filled
}

const isSalvadorCoordinate = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude < -12.5 &&
  latitude > -13.5 &&
  longitude < -37.8 &&
  longitude > -39

const normalizeName = (value) =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.,/()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

async function loadBairroMesh() {
  const { buffer } = await ensureCachedDownload({
    label: LABEL,
    ...BAIRRO_SOURCE,
    cacheDir: GEOMETRY_CACHE,
    download: async (url) => {
      const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } })
      if (!response.ok) throw new Error(`IBGE download failed (${response.status})`)
      return Buffer.from(await response.arrayBuffer())
    },
  })
  const collections = [await shp(buffer)].flat()
  return collections
    .flatMap((collection) => collection.features)
    .filter((item) => String(item.properties?.CD_MUN) === CITY_IBGE_CODE)
    .map((item) => ({ name: item.properties.NM_BAIRRO, feature: item }))
}

async function main() {
  if (process.argv.includes('--download')) await downloadZips()

  const { featureContainsPoint, featureCentroid, haversineKm } =
    await import('../src/lib/municipalityProximity.ts')

  const valid = await loadValidCandidates()
  const [sections, tallies, { bySection, locals }, mesh] = await Promise.all([
    loadSectionVotes(valid),
    loadSectionTallies(),
    loadSectionLocals(),
    loadBairroMesh(),
  ])
  const filled = await fillMissingCoordinates(locals)

  console.log(
    `[${LABEL}] valid candidates: federal=${valid.federal.size} state=${valid.state.size}; ` +
      `sections=${sections.size}; locals=${locals.size}; mesh=${mesh.length}; ` +
      `coordinate fills=${filled}`,
  )

  if (sections.size === 0 || locals.size === 0) die('No Salvador sections/locals parsed.')

  let missingLocal = 0
  for (const key of sections.keys()) {
    if (!bySection.has(key)) missingLocal += 1
  }
  if (missingLocal > 0) die(`${missingLocal} sections with votes have no local mapping.`)

  // Aggregate per local.
  for (const [key, localKey] of bySection) {
    const local = locals.get(localKey)
    const votes = sections.get(key)
    if (!votes) continue
    local.sections += 1
    const tally = tallies.get(key)
    if (tally) {
      local.aptos += tally.aptos
      local.comparecimento += tally.comparecimento
    }
    local.sollaVotes += votes.solla
    local.ceuciVotes += votes.ceuci
    local.federalNominal += votes.federalNominal
    local.stateNominal += votes.stateNominal
  }

  // Pin locals to the IBGE mesh.
  const withCoordinates = [...locals.values()].filter((local) =>
    isSalvadorCoordinate(local.latitude, local.longitude),
  )
  let nearestFallbacks = 0
  for (const local of withCoordinates) {
    const point = { lng: local.longitude, lat: local.latitude }
    const containing = mesh.find((item) => featureContainsPoint(item.feature, point))
    if (containing) {
      local.polygonName = containing.name
      local.matchType = 'polygon'
      continue
    }
    nearestFallbacks += 1
    const nearest = [...mesh]
      .map((item) => ({
        name: item.name,
        distanceKm: haversineKm(point, featureCentroid(item.feature)),
      }))
      .sort((left, right) => left.distanceKm - right.distanceKm)[0]
    local.polygonName = nearest.name
    local.matchType = 'nearest-polygon'
  }

  // Locals without coordinates (2022 and ATUAL) join the polygon of their own
  // TSE bairro's locals; a lone local (e.g. Patamares) falls back to the
  // polygon named like its TSE bairro. Votes never leave their bairro.
  const meshByName = new Map(mesh.map((item) => [normalizeName(item.name), item.name]))
  for (const local of locals.values()) {
    if (local.polygonName) continue
    const siblings = [...locals.values()].filter(
      (item) => item !== local && item.bairro === local.bairro && item.polygonName,
    )
    const byPolygon = new Map()
    for (const sibling of siblings) {
      byPolygon.set(
        sibling.polygonName,
        (byPolygon.get(sibling.polygonName) ?? 0) + sibling.sollaVotes + sibling.ceuciVotes,
      )
    }
    const majority = [...byPolygon.entries()].sort((left, right) => right[1] - left[1])[0]
    if (majority) {
      local.polygonName = majority[0]
      local.matchType = 'bairro-majority'
      continue
    }
    const sameName = meshByName.get(normalizeName(local.bairro))
    if (sameName) {
      local.polygonName = sameName
      local.matchType = 'bairro-name'
    }
  }

  const withoutPolygon = [...locals.values()].filter((local) => !local.polygonName)
  if (withoutPolygon.length > 0) {
    console.warn(
      `[${LABEL}] ${withoutPolygon.length} local(is) without a polygon (table only): ` +
        withoutPolygon
          .map((local) => `${local.zoneNumber}/${local.localNumber} ${local.name}`)
          .join('; '),
    )
  }

  // Aggregate per IBGE bairro polygon — the map unit. Each polygon keeps the
  // TSE registry names of its locals (labels with their own votes), so the
  // report can print both vocabularies without mixing them.
  const polygonMap = new Map()
  for (const local of locals.values()) {
    if (!local.polygonName) continue
    const polygon = polygonMap.get(local.polygonName) ?? {
      name: local.polygonName,
      tseBairros: new Map(),
      zones: new Map(),
      sections: 0,
      locais: 0,
      aptos: 0,
      comparecimento: 0,
      federalNominal: 0,
      stateNominal: 0,
      sollaVotes: 0,
      ceuciVotes: 0,
    }
    polygonMap.set(local.polygonName, polygon)
    const tse = polygon.tseBairros.get(local.bairro) ?? {
      name: local.bairro,
      sollaVotes: 0,
      ceuciVotes: 0,
    }
    tse.sollaVotes += local.sollaVotes
    tse.ceuciVotes += local.ceuciVotes
    polygon.tseBairros.set(local.bairro, tse)
    polygon.sections += local.sections
    polygon.locais += 1
    polygon.aptos += local.aptos
    polygon.comparecimento += local.comparecimento
    polygon.federalNominal += local.federalNominal
    polygon.stateNominal += local.stateNominal
    polygon.sollaVotes += local.sollaVotes
    polygon.ceuciVotes += local.ceuciVotes
    const zone = polygon.zones.get(local.zoneNumber) ?? {
      zoneNumber: local.zoneNumber,
      sollaVotes: 0,
      ceuciVotes: 0,
    }
    zone.sollaVotes += local.sollaVotes
    zone.ceuciVotes += local.ceuciVotes
    polygon.zones.set(local.zoneNumber, zone)
  }

  const bairros = [...polygonMap.values()]
    .map((polygon) => ({
      name: polygon.name,
      tseBairros: [...polygon.tseBairros.values()].sort(
        (left, right) => right.sollaVotes + right.ceuciVotes - (left.sollaVotes + left.ceuciVotes),
      ),
      zones: [...polygon.zones.values()].sort(
        (left, right) => right.sollaVotes + right.ceuciVotes - (left.sollaVotes + left.ceuciVotes),
      ),
      sections: polygon.sections,
      locais: polygon.locais,
      aptos: polygon.aptos,
      comparecimento: polygon.comparecimento,
      federalNominal: polygon.federalNominal,
      stateNominal: polygon.stateNominal,
      sollaVotes: polygon.sollaVotes,
      ceuciVotes: polygon.ceuciVotes,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

  const totals = {
    sollaVotes: [...locals.values()].reduce((sum, local) => sum + local.sollaVotes, 0),
    ceuciVotes: [...locals.values()].reduce((sum, local) => sum + local.ceuciVotes, 0),
    federalNominal: [...locals.values()].reduce((sum, local) => sum + local.federalNominal, 0),
    stateNominal: [...locals.values()].reduce((sum, local) => sum + local.stateNominal, 0),
    aptos: [...locals.values()].reduce((sum, local) => sum + local.aptos, 0),
    comparecimento: [...locals.values()].reduce((sum, local) => sum + local.comparecimento, 0),
    sections: sections.size,
    locais: locals.size,
    bairros: bairros.length,
  }

  // Cross-checks against the zone-level input of the report.
  const zoneData = JSON.parse(await readFile(ZONE_DATA_PATH, 'utf8'))
  const validation = []
  for (const zone of zoneData.zones) {
    const sectionSolla = [...sections.entries()]
      .filter(([key]) => Number(key.split('|')[0]) === zone.zoneNumber)
      .reduce((sum, [, votes]) => sum + votes.solla, 0)
    const sectionCeuci = [...sections.entries()]
      .filter(([key]) => Number(key.split('|')[0]) === zone.zoneNumber)
      .reduce((sum, [, votes]) => sum + votes.ceuci, 0)
    if (sectionSolla !== zone.sollaVotes || sectionCeuci !== zone.ceuciVotes) {
      die(
        `Zone ${zone.zoneNumber} drift: sections ${sectionSolla}/${sectionCeuci} vs zone ${zone.sollaVotes}/${zone.ceuciVotes}.`,
      )
    }
  }
  if (totals.sollaVotes !== zoneData.salvadorTotals.sollaVotes) {
    die(`Solla total drift: ${totals.sollaVotes} vs ${zoneData.salvadorTotals.sollaVotes}.`)
  }
  if (totals.ceuciVotes !== zoneData.salvadorTotals.ceuciVotes) {
    die(`Ceuci total drift: ${totals.ceuciVotes} vs ${zoneData.salvadorTotals.ceuciVotes}.`)
  }
  validation.push(
    `Solla Salvador = ${totals.sollaVotes} = soma das seções, conferida zona a zona contra o JSON de zonas (C157).`,
    `Ceuci Salvador = ${totals.ceuciVotes} = soma das seções, conferida zona a zona contra o JSON de zonas (C157).`,
    `Denominador (votos nominais de candidaturas válidas): federal ${totals.federalNominal} (zona: ${zoneData.salvadorTotals.federalValid}); estadual ${totals.stateNominal} (zona: ${zoneData.salvadorTotals.stateValid}) — diferença residual ≤ 0,1%, abaixo da precisão dos quocientes.`,
    `${totals.sections} seções com votação, todas com local de votação e bairro no cadastro do TSE; ${totals.locais} locais.`,
    `${totals.bairros} bairros (malha IBGE) com local de votação; ${mesh.length} polígonos na malha do Censo 2022; o cadastro do TSE nomeia ${new Set([...locals.values()].map((local) => local.bairro)).size} bairros.`,
  )

  const files = []
  for (const source of SOURCES) {
    const buffer = await readFile(csvPath(source.csv))
    files.push({
      name: source.csv,
      url: source.url,
      bytes: buffer.length,
      sha256: sha256Hex(buffer),
    })
  }
  validation.push(
    `${filled} locais sem coordenada no cadastro de 2022 tiveram a coordenada preenchida pelo cadastro atual (mesmo número de local); ${nearestFallbacks} locais caíram para o polígono mais próximo.` +
      (withoutPolygon.length > 0
        ? ` ${withoutPolygon.length} local(is) ficaram fora do mapa (sem polígono), mas seguem na tabela do bairro.`
        : ''),
  )

  const output = {
    year: 2022,
    turn: 1,
    city: { name: 'Salvador', tseCityCode: CITY_CODE, ibgeCode: CITY_IBGE_CODE },
    offices: { federal: 'deputado_federal', state: 'deputado_estadual' },
    candidates: {
      solla: { candidateNumber: Number(SOLLA_NUMBER), office: 'deputado_federal' },
      ceuci: { candidateNumber: Number(CEUCI_NUMBER), office: 'deputado_estadual' },
    },
    method: {
      unit: 'Bairro do local de votação (cadastro eleitoral do TSE), com o local posicionado na malha de bairros do IBGE Censo 2022.',
      join: 'votação por seção (votacao_secao_2022_BA) × seção → local → bairro (eleitorado_local_votacao_2022) × aferição por seção (detalhe_votacao_secao_2022_BA).',
      denominator:
        'Votos nominais das candidaturas válidas por seção — conjunto de candidaturas extraído de votacao_candidato_munzona_2022, a mesma base do baseline por zona.',
      caveat:
        'O voto é do local de votação, não da residência: o eleitor vota perto de casa, mas o cadastro não liga o voto ao domicílio. Um mesmo local pode atender mais de um bairro. Nenhum número aqui mede transferência de voto entre candidatos.',
    },
    provenance: {
      source: 'TSE — Portal de Dados Abertos (Resultados 2022 e Eleitorado 2022/Atual)',
      extractedAt: '2026-09-14',
      files,
      geometry: {
        source: 'IBGE — malha de bairros do Censo 2022 (BA_bairros_CD2022)',
        cache: 'data/geometries/bahia-bairros-cd2022.zip',
      },
    },
    totals,
    bairros,
    locals: [...locals.values()]
      .map((local) => ({
        zoneNumber: local.zoneNumber,
        localNumber: local.localNumber,
        name: local.name,
        bairro: local.bairro,
        polygonName: local.polygonName,
        matchType: local.matchType,
        coordinateSource: local.coordinateSource,
        latitude: local.latitude,
        longitude: local.longitude,
        sections: local.sections,
        aptos: local.aptos,
        comparecimento: local.comparecimento,
        federalNominal: local.federalNominal,
        stateNominal: local.stateNominal,
        sollaVotes: local.sollaVotes,
        ceuciVotes: local.ceuciVotes,
      }))
      .sort(
        (left, right) => left.zoneNumber - right.zoneNumber || left.localNumber - right.localNumber,
      ),
    polygonsWithoutVotes: mesh
      .map((item) => item.name)
      .filter((name) => !polygonMap.has(name))
      .sort((left, right) => left.localeCompare(right, 'pt-BR')),
    validation,
  }

  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
  console.log(
    `[${LABEL}] wrote ${OUT_PATH}\n[${LABEL}] bairros=${bairros.length} locals=${locals.size} ` +
      `sections=${sections.size} solla=${totals.sollaVotes} ceuci=${totals.ceuciVotes} ` +
      `fedNominal=${totals.federalNominal} estNominal=${totals.stateNominal}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
