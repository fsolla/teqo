/**
 * Builds the static TopoJSON of the zone municipalities — Salvador's 19 ZE
 * (roadmap B8 F2). One feature per catalog `kind: 'zona'` entry, dissolved from
 * the IBGE neighborhood mesh using the official TRE circunscrição list.
 *
 * Provenance (do not strip):
 * - IBGE Malhas de bairros, Censo 2022 (shapefile, UF BA):
 *     https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/shp/UF/BA_bairros_CD2022.zip
 * - Zone → neighborhood assignment: src/lib/municipalityZoneNeighborhoods.ts
 *     (TRE-BA Resolução Administrativa nº 2/2017, Anexo I).
 *
 * APPROXIMATION — the result is NOT an official TSE boundary. The TRE publishes
 * the circunscrição as a list of neighborhoods, so the polygon is only as exact
 * as the neighborhood mesh: where the resolution splits one neighborhood
 * between two zones by a street, the polygon is atomic and goes whole to one of
 * them (see SPLIT_NEIGHBORHOOD_ZONES). Every surface that draws it says so.
 *
 * Safety: does not touch any database — only downloads public IBGE data and
 * writes a versioned artifact under src/lib/geometries/.
 *
 * Usage:
 *   pnpm build:municipality-zone-geometries
 *   pnpm build:municipality-zone-geometries --report   # reconciliation only
 *   GEOMETRIES_CACHE_DIR=./data/geometries pnpm build:municipality-zone-geometries
 */

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import shp from 'shpjs'
import { merge, quantize } from 'topojson-client'
import { topology } from 'topojson-server'
import { presimplify, quantile, simplify } from 'topojson-simplify'

const { municipalityCatalog } = await import('../src/lib/municipalityCatalog.ts')
const { municipalityZoneNeighborhoods } =
  await import('../src/lib/municipalityZoneNeighborhoods.ts')
const { downloadToBuffer } = await import('../src/lib/electionResultsZip.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCE = {
  key: 'bahia-bairros-cd2022',
  url: 'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/shp/UF/BA_bairros_CD2022.zip',
  ext: 'zip',
}

const OUTPUT_PATH = 'src/lib/geometries/bahia-municipality-zones.topo.json'

/** Quantile of triangle area kept after presimplify (higher = more detail). */
const SIMPLIFY_QUANTILE = 0.35
/** Quantization precision for the final topology. */
const QUANTIZE_DIGITS = 1e4

/**
 * Same neighborhood, different name in the two sources — IBGE composites
 * ("Beiru / Tancredo Neves") and spellings the accent folding cannot reach.
 * Identity beats the adjacency rule below: the resolution naming a
 * neighborhood is the fact, adjacency is only the fallback for the ones it
 * never mentions. Both sides are matched normalized and the target must exist
 * in the TRE catalog, or the build fails.
 */
const IBGE_TO_TRE_NEIGHBORHOOD = {
  'BEIRU TANCREDO NEVES': 'Tancredo Neves',
  'CENTRO ADMINISTRATIVO DA BAHIA CAB': 'Centro Administrativo da Bahia',
  'NORDESTE DO AMARALINA': 'Nordeste de Amaralina',
  // Islands have no shared boundary, so the adjacency rule cannot place them —
  // and it does not need to: RA 02/2017 names both in ZE 4.
  'ILHA BOM JESUS DOS PASSOS': 'Ilha de Bom Jesus dos Passos',
  'ILHA DOS FRADES ILHA DE SANTO ANTONIO': 'Ilha dos Frades',
  'VILA RUY BARBOSA JARDIM CRUZEIRO': 'Vila Ruy Barbosa',
}

/**
 * TRE neighborhoods with no polygon of their own because the IBGE mesh draws
 * them inside a neighbor. Only legal within one zone — the build refuses a
 * merge that would move territory across zones.
 */
const TRE_NEIGHBORHOODS_MERGED_INTO = {
  'Jardim Cruzeiro': 'Vila Ruy Barbosa',
}

/**
 * Neighborhoods the resolution splits between two zones by a street. The
 * polygon is atomic without street-level geodata, so it goes whole to the zone
 * named here, and every build reports it.
 */
const SPLIT_NEIGHBORHOOD_ZONES = {
  // RA 02/2017 cuts Periperi at Rua das Pedrinhas (north = ZE 4, south = ZE 17).
  // It goes to ZE 17, whose other neighborhoods (Alto do Cabrito, Itacaranha,
  // Plataforma, Praia Grande, Rio Sena, São João do Cabrito) wrap it; ZE 4
  // keeps Paripe, Coutos and the islands.
  PERIPERI: 'salvador-ze-17',
}

const REPORT_ONLY = process.argv.includes('--report')

const die = (message) => {
  console.error(`\n[build:municipality-zone-geometries] ${message}\n`)
  process.exit(1)
}

const log = (message) => console.log(`[build:municipality-zone-geometries] ${message}`)

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const cacheDir = () => process.env.GEOMETRIES_CACHE_DIR || join(ROOT, 'data', 'geometries')

const ensureCachedBinary = async ({ key, url, ext }) => {
  const dir = cacheDir()
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${key}.${ext}`)
  try {
    await access(path)
    log(`cache hit ${path}`)
    const buffer = await readFile(path)
    return { url, hash: sha256(buffer), buffer }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  log(`downloading ${url}`)
  const buffer = await downloadToBuffer(url)
  const hash = sha256(buffer)
  await writeFile(path, buffer)
  log(`saved ${path} (${buffer.length} bytes, sha256=${hash})`)
  return { url, hash, buffer }
}

const writeJson = async (relativePath, value) => {
  const path = join(ROOT, relativePath)
  await mkdir(dirname(path), { recursive: true })
  const body = `${JSON.stringify(value)}\n`
  await writeFile(path, body)
  log(`wrote ${relativePath} (${Buffer.byteLength(body)} bytes)`)
}

const simplifyTopology = (topo) => {
  let next = presimplify(topo)
  const minWeight = quantile(next, SIMPLIFY_QUANTILE)
  next = simplify(next, minWeight)
  return quantize(next, QUANTIZE_DIGITS)
}

/** Accent-folded, punctuation-free key; parentheses (the TRE's split notes) drop. */
const normalizeNeighborhood = (name) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()

const polygonCount = (geometry) =>
  geometry?.type === 'MultiPolygon' ? geometry.coordinates.length : geometry ? 1 : 0

const arcIndexes = (arcs, into = new Set()) => {
  for (const item of arcs) {
    if (Array.isArray(item)) arcIndexes(item, into)
    else into.add(item < 0 ? -1 - item : item)
  }
  return into
}

const arcLength = (arc) => {
  let total = 0
  for (let index = 1; index < arc.length; index += 1) {
    const [previousX, previousY] = arc[index - 1]
    const [x, y] = arc[index]
    total += Math.hypot(x - previousX, y - previousY)
  }
  return total
}

/**
 * Places a polygon RA 02/2017 never names in the zone it shares the most
 * boundary with. Validated against the neighborhoods the resolution DOES name
 * under a different label (Beiru/Tancredo Neves, CAB, Nordeste de Amaralina,
 * Vila Ruy Barbosa): the rule reproduces the official zone in all four.
 */
const rankZonesBySharedBoundary = (topo, geometry, zoneSlugByGeometry) => {
  const ownArcs = arcIndexes(geometry.arcs)
  const lengthByZone = new Map()

  for (const other of topo.objects.neighborhoods.geometries) {
    const zone = zoneSlugByGeometry.get(other)
    if (!zone || other === geometry) continue
    const otherArcs = arcIndexes(other.arcs)
    let shared = 0
    for (const arc of ownArcs) if (otherArcs.has(arc)) shared += arcLength(topo.arcs[arc])
    if (shared > 0) lengthByZone.set(zone, (lengthByZone.get(zone) ?? 0) + shared)
  }

  return [...lengthByZone.entries()].sort((left, right) => right[1] - left[1])
}

const main = async () => {
  const zoneEntries = municipalityCatalog.filter((entry) => entry.kind === 'zona')
  if (zoneEntries.length === 0) die('No zone municipalities in the catalog.')
  const zoneIbgeCodes = new Set(zoneEntries.map((entry) => entry.ibgeCode))

  // TRE neighborhood → zone slug. A name in two zones is a documented split.
  const zoneSlugByNeighborhood = new Map()
  const splitNeighborhoods = new Set()
  for (const record of municipalityZoneNeighborhoods) {
    for (const neighborhood of record.neighborhoods) {
      const key = normalizeNeighborhood(neighborhood)
      const previous = zoneSlugByNeighborhood.get(key)
      if (previous && previous !== record.municipalitySlug) {
        const resolved = SPLIT_NEIGHBORHOOD_ZONES[key]
        if (!resolved) {
          die(
            `"${neighborhood}" is listed in ${previous} and ${record.municipalitySlug}; add it to SPLIT_NEIGHBORHOOD_ZONES.`,
          )
        }
        splitNeighborhoods.add(key)
        zoneSlugByNeighborhood.set(key, resolved)
        continue
      }
      if (!previous) zoneSlugByNeighborhood.set(key, record.municipalitySlug)
    }
  }

  const aliasTargets = new Map()
  for (const [ibgeName, treName] of Object.entries(IBGE_TO_TRE_NEIGHBORHOOD)) {
    const treKey = normalizeNeighborhood(treName)
    if (!zoneSlugByNeighborhood.has(treKey)) {
      die(`IBGE_TO_TRE_NEIGHBORHOOD maps "${ibgeName}" to unknown TRE neighborhood "${treName}".`)
    }
    aliasTargets.set(normalizeNeighborhood(ibgeName), treKey)
  }

  for (const [treName, hostName] of Object.entries(TRE_NEIGHBORHOODS_MERGED_INTO)) {
    const treZone = zoneSlugByNeighborhood.get(normalizeNeighborhood(treName))
    const hostZone = zoneSlugByNeighborhood.get(normalizeNeighborhood(hostName))
    if (!treZone) die(`TRE_NEIGHBORHOODS_MERGED_INTO has unknown neighborhood "${treName}".`)
    if (!hostZone) die(`TRE_NEIGHBORHOODS_MERGED_INTO has unknown host "${hostName}".`)
    if (treZone !== hostZone) {
      die(
        `Merging "${treName}" (${treZone}) into "${hostName}" (${hostZone}) would move territory across zones.`,
      )
    }
  }

  const { hash, buffer } = await ensureCachedBinary(SOURCE)
  const features = [await shp(buffer)]
    .flat()
    .flatMap((collection) => collection.features)
    .filter((feature) => zoneIbgeCodes.has(feature.properties?.CD_MUN))
  if (features.length === 0) die('No neighborhood polygons found for the zone municipalities.')
  log(`${features.length} neighborhood polygons in the zone municipalities (sha256=${hash})`)

  // Topology before anything else: the dissolve needs shared arcs to drop
  // interior boundaries instead of leaving slivers, adjacency is read off those
  // same arcs, and simplification then moves both sides of an arc identically.
  const neighborhoodTopology = topology({
    neighborhoods: {
      type: 'FeatureCollection',
      // `id` is what the simplified topology is re-indexed by further down.
      // Neighborhood names are unique in today's mesh but nothing guarantees it,
      // and keying by name would silently collapse two polygons into one.
      features: features.map((feature, index) => ({
        type: 'Feature',
        properties: { id: index, name: feature.properties?.NM_BAIRRO ?? '' },
        geometry: feature.geometry,
      })),
    },
  })
  const geometries = neighborhoodTopology.objects.neighborhoods.geometries

  // Pass 1 — the resolution's own names.
  const zoneSlugByGeometry = new Map()
  const unnamed = []
  for (const geometry of geometries) {
    const key = normalizeNeighborhood(geometry.properties.name)
    const slug = zoneSlugByNeighborhood.get(aliasTargets.get(key) ?? key)
    if (slug) zoneSlugByGeometry.set(geometry, slug)
    else unnamed.push(geometry)
  }

  // Pass 2 — polygons RA 02/2017 never names, by shared boundary.
  const orphans = []
  for (const geometry of unnamed) {
    const ranked = rankZonesBySharedBoundary(neighborhoodTopology, geometry, zoneSlugByGeometry)
    const [winner, runnerUp] = ranked
    if (!winner) {
      orphans.push(geometry.properties.name)
      continue
    }
    zoneSlugByGeometry.set(geometry, winner[0])
    const margin = runnerUp
      ? `+${(((winner[1] - runnerUp[1]) / runnerUp[1]) * 100).toFixed(0)}%`
      : 'only neighbour'
    log(
      `not in RA 02/2017 — "${geometry.properties.name}" → ${winner[0]} by shared boundary (${margin}${
        runnerUp ? ` over ${runnerUp[0]}` : ''
      })`,
    )
  }

  const coveredKeys = new Set(
    geometries.map((geometry) => {
      const key = normalizeNeighborhood(geometry.properties.name)
      return aliasTargets.get(key) ?? key
    }),
  )
  for (const hostName of Object.values(TRE_NEIGHBORHOODS_MERGED_INTO)) {
    if (!coveredKeys.has(normalizeNeighborhood(hostName))) continue
    for (const [treName, host] of Object.entries(TRE_NEIGHBORHOODS_MERGED_INTO)) {
      if (host === hostName) coveredKeys.add(normalizeNeighborhood(treName))
    }
  }
  const neighborhoodsWithoutPolygon = municipalityZoneNeighborhoods.flatMap((record) =>
    record.neighborhoods
      .filter((neighborhood) => !coveredKeys.has(normalizeNeighborhood(neighborhood)))
      .map((neighborhood) => `${record.municipalitySlug}: ${neighborhood}`),
  )

  const geometriesByZone = new Map()
  for (const [geometry, slug] of zoneSlugByGeometry) {
    geometriesByZone.set(slug, [...(geometriesByZone.get(slug) ?? []), geometry])
  }
  log(
    `assigned ${zoneSlugByGeometry.size}/${geometries.length} polygons to ${geometriesByZone.size}/${zoneEntries.length} zones`,
  )
  if (splitNeighborhoods.size > 0) {
    log(
      `split by RA 02/2017, kept whole: ${[...splitNeighborhoods]
        .map((key) => `${key} → ${SPLIT_NEIGHBORHOOD_ZONES[key]}`)
        .join(', ')}`,
    )
  }
  if (orphans.length > 0) {
    log(`polygons with no zone (${orphans.length}):`)
    for (const name of [...orphans].sort()) console.log(`    - ${name}`)
  }
  if (neighborhoodsWithoutPolygon.length > 0) {
    log(`TRE neighborhoods with no polygon (${neighborhoodsWithoutPolygon.length}):`)
    for (const entry of neighborhoodsWithoutPolygon.sort()) console.log(`    - ${entry}`)
  }
  if (orphans.length > 0 || neighborhoodsWithoutPolygon.length > 0) {
    die(
      'Reconciliation is incomplete — extend IBGE_TO_TRE_NEIGHBORHOOD / TRE_NEIGHBORHOODS_MERGED_INTO until every polygon has a zone and every neighborhood has a polygon.',
    )
  }

  if (REPORT_ONLY) {
    log('--report: reconciliation complete, artifact not written.')
    return
  }

  // Simplification keeps geometry order and properties, so the zone buckets
  // above still address the right shapes.
  const simplified = simplifyTopology(neighborhoodTopology)
  const simplifiedById = new Map(
    simplified.objects.neighborhoods.geometries.map((geometry) => [
      geometry.properties.id,
      geometry,
    ]),
  )

  const zoneFeatures = zoneEntries.map((entry) => {
    const members = (geometriesByZone.get(entry.slug) ?? []).map((geometry) =>
      simplifiedById.get(geometry.properties.id),
    )
    if (members.length === 0 || members.some((member) => !member)) {
      die(`Missing neighborhood geometry for ${entry.slug}.`)
    }

    const geometry = merge(simplified, members)
    if (!geometry || geometry.coordinates.length === 0) {
      die(`Dissolve produced an empty polygon for ${entry.slug}.`)
    }

    return {
      type: 'Feature',
      properties: {
        municipalitySlug: entry.slug,
        name: entry.name,
        zoneNumber: entry.zoneNumber,
        ibgeCode: entry.ibgeCode,
      },
      geometry,
    }
  })

  // Already simplified above — the final pass only quantizes, so the artifact
  // stores short integers instead of the floats `merge` hands back.
  await writeJson(
    OUTPUT_PATH,
    quantize(
      topology({ municipalityZones: { type: 'FeatureCollection', features: zoneFeatures } }),
      QUANTIZE_DIGITS,
    ),
  )

  for (const feature of zoneFeatures) {
    const pieces = polygonCount(feature.geometry)
    log(
      `${feature.properties.municipalitySlug}: ${
        geometriesByZone.get(feature.properties.municipalitySlug).length
      } neighborhoods → ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`,
    )
  }
  log(`done — ${zoneFeatures.length} zone polygons.`)
}

await main()
