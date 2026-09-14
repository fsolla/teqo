/**
 * One-off report generator (C157): Solla × Ceuci in Salvador, 2022 TSE.
 *
 * Produces, from the committed input JSON and the committed geometries:
 *   - docs/research/analise-sobreposicao-solla-ceuci-salvador-2022.md
 *   - docs/research/analise-sobreposicao-solla-ceuci-salvador-2022.pdf
 *
 * Why a script instead of a Payload route: the deliverable is a printable
 * document for the campaign staff, and the project's standing decision is
 * CSS/HTML print over a server-side PDF library (docs/plans/dossie-municipio.md).
 * Chromium comes from the already-installed @playwright/test — no new dependency.
 *
 * Data: docs/research/solla-ceuci-salvador-2022-dados.json (public TSE 2022,
 * provenance inside). The script re-checks Solla zone by zone against the
 * committed federal artifact before rendering, so the report can never drift
 * from the app's own baseline.
 *
 * Geometry: Salvador zones from src/lib/geometries/bahia-municipality-zones.topo.json
 * (committed); Salvador neighborhoods from the IBGE Censo 2022 shapefile,
 * downloaded once to the gitignored data/geometries cache (the same source the
 * zone build uses). Each neighborhood is painted with the numbers of the zone
 * that contains its centroid — the votes themselves exist only per zone.
 *
 * Usage (no pnpm alias on purpose: a package.json change would force the full
 * CI suite for a one-off report):
 *   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-solla-ceuci-salvador-report.mjs
 *
 * Safety: read-only; no database, no network when the geometry cache exists.
 */

import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import shp from 'shpjs'
import { feature } from 'topojson-client'

import { dieWithLabel, ensureCachedDownload } from './lib/cli.mjs'
import {
  buildReportSummary,
  buildZoneMetrics,
  ZONE_CLASSES,
} from './lib/sollaCeuciSalvadorMetrics.mjs'

const { discreteChoroplethFill, NO_DATA_FILL } = await import('../src/lib/choroplethColorScale.ts')
const { featureCentroid, featureContainsPoint, haversineKm } =
  await import('../src/lib/municipalityProximity.ts')
const { municipalityZoneNeighborhoods } =
  await import('../src/lib/municipalityZoneNeighborhoods.ts')
const { downloadToBuffer } = await import('../src/lib/electionResultsZip.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-solla-ceuci-salvador-report'
const die = dieWithLabel(LABEL)

const DATA_PATH = join(ROOT, 'docs/research/solla-ceuci-salvador-2022-dados.json')
const ARTIFACT_PATH = join(ROOT, 'src/lib/electionAggregates/bahia-federal-baseline.json')
const ZONE_TOPOLOGY_PATH = join(ROOT, 'src/lib/geometries/bahia-municipality-zones.topo.json')
const REPORT_BASE = 'docs/research/analise-sobreposicao-solla-ceuci-salvador-2022'
const CACHE_DIR = join(ROOT, 'data/geometries')

const BAIRRO_SOURCE = {
  key: 'bahia-bairros-cd2022',
  url: 'http://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/shp/UF/BA_bairros_CD2022.zip',
  ext: 'zip',
}

const int = new Intl.NumberFormat('pt-BR')
const nf = (value) => int.format(Math.round(value))
const dec = (value, digits = 2) => value.toFixed(digits).replace('.', ',')
const pct = (value, digits = 1) => `${dec(value * 100, digits)}%`
const list = (values) => values.map((value) => `ZE ${value}`).join(', ')
const zoneList = (zones) => zones.map((zone) => zone.zoneNumber)

const htmlEscape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

// ---------------------------------------------------------------------------
// Input data
// ---------------------------------------------------------------------------

const data = JSON.parse(await readFile(DATA_PATH, 'utf8'))
const artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8'))

for (const zone of data.zones) {
  const baseline = artifact.municipalities[`salvador-ze-${zone.zoneNumber}`]
  const committed = baseline?.votesByYear?.['2022']
  if (committed !== zone.sollaVotes) {
    die(
      `Solla drift in ZE ${zone.zoneNumber}: committed artifact has ${committed}, ` +
        `report input has ${zone.sollaVotes}.`,
    )
  }
}

const metrics = buildZoneMetrics({ zones: data.zones, salvadorTotals: data.salvadorTotals })
const summary = buildReportSummary({
  metrics,
  candidates: data.candidates,
  salvadorTotals: data.salvadorTotals,
})
const metricsByZone = new Map(metrics.map((zone) => [zone.zoneNumber, zone]))

const neighborhoodsByZone = new Map(
  municipalityZoneNeighborhoods.map((record) => [record.zoneNumber, record.neighborhoods]),
)

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const zoneTopology = JSON.parse(await readFile(ZONE_TOPOLOGY_PATH, 'utf8'))
const zoneFeatures = feature(zoneTopology, zoneTopology.objects.municipalityZones).features
if (zoneFeatures.length !== 19) die(`Expected 19 Salvador zones, got ${zoneFeatures.length}.`)

const { buffer: bairroBuffer, hash: bairroHash } = await ensureCachedDownload({
  label: LABEL,
  ...BAIRRO_SOURCE,
  cacheDir: CACHE_DIR,
  download: downloadToBuffer,
})

const bairroCollections = [await shp(bairroBuffer)].flat()
const bairros = bairroCollections
  .flatMap((collection) => collection.features)
  .filter((item) => String(item.properties?.CD_MUN) === data.city.ibgeCode)
if (bairros.length === 0) die('No Salvador neighborhoods in the IBGE mesh.')

const zoneBySlug = new Map(zoneFeatures.map((zone) => [zone.properties.municipalitySlug, zone]))

let nearestFallbacks = 0
for (const bairro of bairros) {
  const centroid = featureCentroid(bairro)
  const containing = zoneFeatures.find((zone) => featureContainsPoint(zone, centroid))
  if (containing) {
    bairro.zoneSlug = containing.properties.municipalitySlug
    continue
  }

  nearestFallbacks += 1
  const nearest = [...zoneFeatures]
    .map((zone) => ({
      slug: zone.properties.municipalitySlug,
      distanceKm: haversineKm(centroid, featureCentroid(zone)),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0]
  bairro.zoneSlug = nearest.slug
  console.log(
    `[${LABEL}] "${bairro.properties?.NM_BAIRRO}" has no zone at its centroid — ` +
      `nearest ${nearest.slug} (${nearest.distanceKm.toFixed(1)} km).`,
  )
}

const zoneNumberBySlug = new Map(
  [...zoneBySlug.keys()].map((slug) => [slug, Number(slug.replace('salvador-ze-', ''))]),
)
for (const bairro of bairros) {
  const zoneNumber = zoneNumberBySlug.get(bairro.zoneSlug)
  if (!Number.isFinite(zoneNumber)) die(`Bad zone slug ${bairro.zoneSlug}.`)
  bairro.zoneNumber = zoneNumber
}

// ---------------------------------------------------------------------------
// Projection (local equirectangular; the mesh is ~30 km wide, no d3 needed)
// ---------------------------------------------------------------------------

const ringPositions = (geometry) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.flatMap((rings) => rings.flat())
}

const positions = bairros.flatMap((bairro) => ringPositions(bairro.geometry))
const bounds = positions.reduce(
  (acc, [lng, lat]) => [
    Math.min(acc[0], lng),
    Math.min(acc[1], lat),
    Math.max(acc[2], lng),
    Math.max(acc[3], lat),
  ],
  [Infinity, Infinity, -Infinity, -Infinity],
)

const VIEW_WIDTH = 1000
const VIEW_PADDING = 8
const lat0 = (bounds[1] + bounds[3]) / 2
const lngScale = Math.cos((lat0 * Math.PI) / 180)
const mapWidth = (bounds[2] - bounds[0]) * lngScale
const mapHeight = bounds[3] - bounds[1]
const mapScale = (VIEW_WIDTH - VIEW_PADDING * 2) / mapWidth
const VIEW_HEIGHT = Math.round(VIEW_PADDING * 2 + mapHeight * mapScale)

const project = (lng, lat) => [
  VIEW_PADDING + (lng - bounds[0]) * lngScale * mapScale,
  VIEW_PADDING + (bounds[3] - lat) * mapScale,
]

const pathOf = (geometry) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let path = ''
  for (const rings of polygons) {
    for (const ring of rings) {
      ring.forEach(([lng, lat], index) => {
        const [x, y] = project(lng, lat)
        path += `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      path += 'Z'
    }
  }
  return path
}

const centroidPoint = (item) => {
  const { lng, lat } = featureCentroid(item)
  return project(lng, lat)
}

// ---------------------------------------------------------------------------
// SVG building blocks
// ---------------------------------------------------------------------------

const zoneLabelSvg = () =>
  zoneFeatures
    .map((zone) => {
      const [x, y] = centroidPoint(zone)
      const zoneNumber = Number(zone.properties.municipalitySlug.replace('salvador-ze-', ''))
      return `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" class="zone-label">${zoneNumber}</text>`
    })
    .join('')

const bairroOutlineSvg = (stroke, width) =>
  bairros
    .map(
      (bairro) =>
        `<path d="${pathOf(bairro.geometry)}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`,
    )
    .join('')

const legendSwatch = (color, label, border = '#d4d4d8') =>
  `<span class="legend-item"><span class="legend-swatch" style="background:${color};border-color:${border}"></span>${label}</span>`

const quantileClasses = (values, classCount = 5) => {
  const sorted = [...values].sort((left, right) => right - left)
  const byValue = new Map()
  sorted.forEach((value, index) => {
    if (byValue.has(value)) return
    const rankClass = Math.min(classCount - 1, Math.floor((index * classCount) / sorted.length))
    byValue.set(value, classCount - 1 - rankClass)
  })
  return byValue
}

const classRanges = (values, classCount = 5) => {
  const sorted = [...values].sort((left, right) => left - right)
  const ranges = []
  for (let index = 0; index < classCount; index += 1) {
    const start = Math.floor((index * sorted.length) / classCount)
    const end = Math.floor(((index + 1) * sorted.length) / classCount) - 1
    ranges.push({ min: sorted[start], max: sorted[end] })
  }
  return ranges
}

const renderZoneChoropleth = ({ values, title, caption, legendTitle }) => {
  const entries = [...values.values()]
  const classes = quantileClasses(entries)
  const ranges = classRanges(entries)
  const fills = zoneFeatures
    .map((zone) => {
      const zoneNumber = Number(zone.properties.municipalitySlug.replace('salvador-ze-', ''))
      const value = values.get(zoneNumber) ?? 0
      const classIndex = classes.get(value) ?? 0
      const fill = value > 0 ? discreteChoroplethFill(classIndex, 5) : NO_DATA_FILL
      return `<path d="${pathOf(zone.geometry)}" fill="${fill}" stroke="#52525b" stroke-width="1.1"/>`
    })
    .join('')

  const legend = ranges
    .map((range, index) =>
      legendSwatch(discreteChoroplethFill(index, 5), `${nf(range.min)}–${nf(range.max)}`),
    )
    .join('')

  return `
    <figure class="map">
      <figcaption><strong>${htmlEscape(title)}</strong><span>${htmlEscape(caption)}</span></figcaption>
      <svg viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="img" aria-label="${htmlEscape(title)}">
        ${bairroOutlineSvg('rgba(255,255,255,0.5)', 0.45)}
        ${fills}
        ${zoneLabelSvg()}
      </svg>
      <div class="legend"><span class="legend-title">${htmlEscape(legendTitle)}</span>${legend}</div>
    </figure>`
}

const renderZoneClassMap = () => {
  const fills = zoneFeatures
    .map((zoneFeature) => {
      const zoneNumber = Number(zoneFeature.properties.municipalitySlug.replace('salvador-ze-', ''))
      const zoneMetric = metricsByZone.get(zoneNumber)
      const fill = zoneMetric?.zoneClass.color ?? NO_DATA_FILL
      return `<path d="${pathOf(zoneFeature.geometry)}" fill="${fill}" stroke="#3f3f46" stroke-width="1.1"/>`
    })
    .join('')

  const legend = Object.values(ZONE_CLASSES)
    .map((zoneClass) => {
      const count = metrics.filter((zone) => zone.zoneClass.key === zoneClass.key).length
      return legendSwatch(zoneClass.color, `${zoneClass.label} (${count})`)
    })
    .join('')

  return `
    <figure class="map">
      <figcaption><strong>Classes de sobreposição por zona eleitoral</strong><span>Cruzamento do quociente local (LQ) de cada candidato: acima ou abaixo da média dele em Salvador.</span></figcaption>
      <svg viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="img" aria-label="Classes de sobreposição por zona">
        ${bairroOutlineSvg('rgba(255,255,255,0.5)', 0.45)}
        ${fills}
        ${zoneLabelSvg()}
      </svg>
      <div class="legend">${legend}</div>
    </figure>`
}

const renderBairroClassMap = () => {
  const fills = bairros
    .map((bairro) => {
      const zone = metricsByZone.get(bairro.zoneNumber)
      const fill = zone?.zoneClass.color ?? NO_DATA_FILL
      return `<path d="${pathOf(bairro.geometry)}" fill="${fill}" stroke="#ffffff" stroke-width="0.4"/>`
    })
    .join('')

  const zoneBorders = zoneFeatures
    .map(
      (zone) =>
        `<path d="${pathOf(zone.geometry)}" fill="none" stroke="#3f3f46" stroke-width="1.2"/>`,
    )
    .join('')

  const legend = Object.values(ZONE_CLASSES)
    .map((zoneClass) => legendSwatch(zoneClass.color, zoneClass.label))
    .join('')

  return `
    <figure class="map">
      <figcaption><strong>Salvador por bairros — classes da zona eleitoral de cada bairro</strong><span>Malha de bairros do IBGE (Censo 2022); cada bairro recebe a classe da ZE que contém seu centroide. As linhas grossas são os limites das 19 ZE. Os votos existem por zona, não por bairro.</span></figcaption>
      <svg viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="img" aria-label="Bairros de Salvador por classe de sobreposição">
        ${fills}
        ${zoneBorders}
        ${zoneLabelSvg()}
      </svg>
      <div class="legend">${legend}</div>
    </figure>`
}

const renderBars = () => {
  const rows = [...metrics].sort((left, right) => right.combinedVotes - left.combinedVotes)
  const maxValue = Math.max(...metrics.map((zone) => Math.max(zone.sollaVotes, zone.ceuciVotes)))
  const barMaxWidth = 760
  const rowHeight = 27
  const top = 34
  const height = top + rows.length * rowHeight + 12

  const bars = rows
    .map((zone, index) => {
      const y = top + index * rowHeight
      const sollaWidth = (zone.sollaVotes / maxValue) * barMaxWidth
      const ceuciWidth = (zone.ceuciVotes / maxValue) * barMaxWidth
      return `
        <text x="46" y="${y + 13}" class="chart-label" text-anchor="end">ZE ${zone.zoneNumber}</text>
        <rect x="56" y="${y + 2}" width="${sollaWidth.toFixed(1)}" height="9" rx="1.5" fill="#c51414"/>
        <text x="${(60 + sollaWidth).toFixed(1)}" y="${y + 10}" class="chart-value">${nf(zone.sollaVotes)}</text>
        <rect x="56" y="${y + 13}" width="${ceuciWidth.toFixed(1)}" height="9" rx="1.5" fill="#0d9488"/>
        <text x="${(60 + ceuciWidth).toFixed(1)}" y="${y + 21}" class="chart-value">${nf(zone.ceuciVotes)}</text>`
    })
    .join('')

  return `
    <figure class="map">
      <figcaption><strong>Votos por zona eleitoral — Solla e Ceuci (2022)</strong><span>Zonas ordenadas pela soma Solla + Ceuci. Vermelho: Solla (federal 1313). Verde: Ceuci (estadual 13192).</span></figcaption>
      <svg viewBox="0 0 1000 ${height}" role="img" aria-label="Votos por zona eleitoral">
        <g class="chart">${bars}</g>
      </svg>
    </figure>`
}

const renderScatter = () => {
  const width = 1000
  const height = 520
  const left = 80
  const right = 40
  const top = 30
  const bottom = 60
  const maxX = Math.max(...metrics.map((zone) => zone.sollaVotes))
  const maxY = Math.max(...metrics.map((zone) => zone.ceuciVotes))
  const xOf = (value) => left + (value / maxX) * (width - left - right)
  const yOf = (value) => height - bottom - (value / maxY) * (height - top - bottom)
  const xTicks = 5
  const yTicks = 5

  const grid = Array.from({ length: xTicks + 1 }, (_, index) => {
    const value = (maxX / xTicks) * index
    const x = xOf(value)
    return `<line x1="${x}" y1="${top}" x2="${x}" y2="${height - bottom}" class="grid"/><text x="${x}" y="${height - bottom + 18}" class="axis-label" text-anchor="middle">${nf(value)}</text>`
  }).join('')

  const yGrid = Array.from({ length: yTicks + 1 }, (_, index) => {
    const value = (maxY / yTicks) * index
    const y = yOf(value)
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="grid"/><text x="${left - 10}" y="${y + 4}" class="axis-label" text-anchor="end">${nf(value)}</text>`
  }).join('')

  const medianX = [...metrics].map((zone) => zone.sollaVotes).sort((a, b) => a - b)[
    Math.floor(metrics.length / 2)
  ]
  const medianY = [...metrics].map((zone) => zone.ceuciVotes).sort((a, b) => a - b)[
    Math.floor(metrics.length / 2)
  ]

  const points = metrics
    .map((zone) => {
      const x = xOf(zone.sollaVotes)
      const y = yOf(zone.ceuciVotes)
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${zone.zoneClass.color}" stroke="#ffffff" stroke-width="1.5"/><text x="${(x + 9).toFixed(1)}" y="${(y + 4).toFixed(1)}" class="point-label">ZE ${zone.zoneNumber}</text>`
    })
    .join('')

  return `
    <figure class="map">
      <figcaption><strong>Dispersão — Solla × Ceuci por zona</strong><span>Cada ponto é uma ZE; cor = classe de sobreposição. Linhas tracejadas: medianas (Solla ${nf(medianX)}; Ceuci ${nf(medianY)}). Correlação de Pearson ${dec(summary.pearson)}; Spearman ${dec(summary.spearman)} (N=19).</span></figcaption>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Dispersão Solla por Ceuci">
        <g class="chart">${grid}${yGrid}
          <line x1="${xOf(medianX)}" y1="${top}" x2="${xOf(medianX)}" y2="${height - bottom}" class="median"/>
          <line x1="${left}" y1="${yOf(medianY)}" x2="${width - right}" y2="${yOf(medianY)}" class="median"/>
          ${points}
          <text x="${(width - right) / 2}" y="${height - 14}" class="axis-title" text-anchor="middle">Votos de Solla (federal 1313)</text>
          <text x="18" y="${(height - bottom + top) / 2}" class="axis-title" transform="rotate(-90 18 ${(height - bottom + top) / 2})" text-anchor="middle">Votos de Ceuci (estadual 13192)</text>
        </g>
      </svg>
    </figure>`
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const classBadge = (zoneClass) =>
  `<span class="badge" style="background:${zoneClass.color}">${htmlEscape(zoneClass.label)}</span>`

const zoneTable = () => ({
  caption: 'Votação 2022 por zona eleitoral de Salvador (ordem de ZE)',
  head: [
    'ZE',
    'Solla',
    'Ceuci',
    'Soma',
    '% válidos Solla',
    '% válidos Ceuci',
    'Solla no estado',
    'Ceuci no estado',
  ],
  align: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
  rows: metrics.map((zone) => [
    `ZE ${zone.zoneNumber}`,
    nf(zone.sollaVotes),
    nf(zone.ceuciVotes),
    nf(zone.combinedVotes),
    pct(zone.sollaShareValid),
    pct(zone.ceuciShareValid),
    `${zone.sollaFederalRank}º de ${nf(zone.federalCandidates)}`,
    `${zone.ceuciStateRank}º de ${nf(zone.stateCandidates)}`,
  ]),
})

const overlapTable = () => ({
  caption: 'Força relativa e sobreposição por zona (LQ = quociente local)',
  head: [
    'ZE',
    '% do voto Solla',
    '% do voto Ceuci',
    'LQ Solla',
    'LQ Ceuci',
    'Sobreposição',
    'Classe',
  ],
  align: ['left', 'right', 'right', 'right', 'right', 'right', 'left'],
  rows: metrics.map((zone) => [
    `ZE ${zone.zoneNumber}`,
    pct(zone.sollaShareOwn),
    pct(zone.ceuciShareOwn),
    dec(zone.sollaLq),
    dec(zone.ceuciLq),
    pct(zone.overlapMin),
    classBadge(zone.zoneClass),
  ]),
})

const bairroTable = () => {
  const rows = [...metrics]
    .sort((left, right) => right.combinedVotes - left.combinedVotes)
    .map((zone) => [
      `ZE ${zone.zoneNumber}`,
      classBadge(zone.zoneClass),
      nf(zone.sollaVotes),
      nf(zone.ceuciVotes),
      (neighborhoodsByZone.get(zone.zoneNumber) ?? []).join(' · '),
    ])
  return {
    caption: 'Bairros oficiais por zona eleitoral (TRE-BA RA 02/2017) e votos da ZE',
    head: ['ZE', 'Classe', 'Solla', 'Ceuci', 'Bairros da zona'],
    align: ['left', 'left', 'right', 'right', 'left'],
    rows,
  }
}

const priorityTable = () => ({
  caption: 'Fila de prioridade da campanha (critério: % do nosso voto e classe de sobreposição)',
  head: ['Prioridade', 'Zonas', 'Por quê', 'Ação com Ceuci'],
  align: ['left', 'left', 'left', 'left'],
  rows: [
    [
      '1 — Defender',
      list(zoneList(summary.shared)),
      'Redutos compartilhados: os dois acima da média; maior soma de votos.',
      'Evento conjunto por zona (saúde + prestação de contas); material “Ceuci apoia Solla” na porta das unidades, rádio e digital geolocalizado.',
    ],
    [
      '2 — Ponte Ceuci',
      list(zoneList(summary.ceuciOnly)),
      'Ela acima da média, ele abaixo: rede dela alcança eleitor que o mandato ainda não mobiliza.',
      'Agenda dela com lideranças de saúde e comunitárias; Solla entra no fim; meta: elevar o LQ de Solla na zona para ≥ 1,0.',
    ],
    [
      '3 — Consolidar',
      list(zoneList(summary.sollaOnly)),
      'Base Solla: ele acima da média; ela tem voto residual.',
      'Apoio declarado dela em material e visitas pontuais onde houver rede de saúde; não gastar agenda dela em zona de baixo retorno.',
    ],
    [
      '4 — Decidir por volume',
      list(zoneList(summary.open)),
      'Ambos abaixo da média; decidir pelo volume absoluto (ex.: ZE 12 e ZE 4 somam mais que ZE 5 e ZE 18).',
      'Sem agenda dedicada dela; entra apenas em ação municipal de saúde (mutirão, anúncio de política pública).',
    ],
  ],
})

// ---------------------------------------------------------------------------
// Narrative model (rendered to HTML and Markdown from the same blocks)
// ---------------------------------------------------------------------------

const strongestCeuci = summary.strongestCeuci
const strongestCombined = summary.strongestCombined
const ceuciAheadText = summary.ceuciAhead
  .map((zone) => `ZE ${zone.zoneNumber} (${nf(zone.ceuciVotes)} × ${nf(zone.sollaVotes)})`)
  .join('; ')
const combinedTop = strongestCombined
  .slice(0, 5)
  .map((zone) => `ZE ${zone.zoneNumber} (${nf(zone.combinedVotes)})`)
  .join(', ')
const ceuciTop = strongestCeuci
  .slice(0, 5)
  .map((zone) => `ZE ${zone.zoneNumber} (${nf(zone.ceuciVotes)})`)
  .join(', ')
const ceuciTop5Share = strongestCeuci.slice(0, 5).reduce((sum, zone) => sum + zone.ceuciShareOwn, 0)

const executiveBullets = [
  {
    label: 'Sobreposição parcial, com centro claro.',
    text:
      `As duas distribuições de voto se sobrepõem em ${pct(summary.overlapCoefficient)} ` +
      `(índice de sobreposição; 1,0 seriam distribuições idênticas), com correlação moderada entre as 19 zonas ` +
      `(Pearson ${dec(summary.pearson)}; Spearman ${dec(summary.spearman)}). O centro comum é ${list(zoneList(summary.shared))}. ` +
      `Fora dele, as duas votações seguem lógicas diferentes — e é aí que está o trabalho de campo.`,
  },
  {
    label: 'Ceuci é candidata da capital; Solla, do estado.',
    text:
      `${pct(summary.salvadorShareOfCeuciState)} do voto de Ceuci (${nf(data.salvadorTotals.ceuciVotes)} de ${nf(data.candidates.ceuci.stateVotes)}) ` +
      `está em Salvador, contra ${pct(summary.salvadorShareOfSollaState)} do voto de Solla (${nf(data.salvadorTotals.sollaVotes)} de ${nf(data.candidates.solla.stateVotes)}). ` +
      `Na cidade, ela é concentrada: as 3 zonas mais fortes dela somam ${pct(summary.ceuciTop3Share)} do voto dela; as 3 de Solla somam ${pct(summary.sollaTop3Share)}.`,
  },
  {
    label: 'Onde ela é maior que ele.',
    text: `Ceuci supera Solla em ${summary.ceuciAhead.length} zonas — ${ceuciAheadText}.`,
  },
  {
    label: 'Onde os dois somam mais.',
    text:
      `As maiores somas Solla + Ceuci estão em ${combinedTop} — os territórios onde uma agenda conjunta tem mais público potencial. ` +
      `Ela sozinha é mais forte em ${ceuciTop}.`,
  },
  {
    label: 'Recomendação central.',
    text:
      `Três movimentos: (1) defender os redutos compartilhados (${list(zoneList(summary.shared))}) com agenda e material conjuntos; ` +
      `(2) usar Ceuci como cabeça de ponte onde ela é acima da média e Solla abaixo (${list(zoneList(summary.ceuciOnly))}); ` +
      `(3) acionar a rede dela como apoio declarado nas zonas de Base Solla (${list(zoneList(summary.sollaOnly))}) — ` +
      `sem tratá-la como candidata: ela declarou que não disputa 2026.`,
  },
]

const priorityZones = [...summary.shared, ...summary.ceuciOnly]
const priorityVotes = priorityZones.reduce((sum, zone) => sum + zone.combinedVotes, 0)
const priorityShare =
  priorityVotes / (data.salvadorTotals.sollaVotes + data.salvadorTotals.ceuciVotes)

const report = {
  title: 'Solla × Ceuci em Salvador',
  subtitle: 'Onde as votações de 2022 se encontram — e como usar essa memória na campanha de 2026',
  date: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date()),
  kpis: [
    {
      value: nf(data.salvadorTotals.sollaVotes),
      label: 'votos de Solla em Salvador (federal 1313)',
    },
    {
      value: nf(data.salvadorTotals.ceuciVotes),
      label: 'votos de Ceuci em Salvador (estadual 13192)',
    },
    {
      value: pct(summary.overlapCoefficient, 0),
      label: 'índice de sobreposição das distribuições',
    },
    { value: '19', label: 'zonas eleitorais · 170 bairros na malha' },
  ],
  sections: [
    {
      id: 'sumario',
      title: 'Sumário executivo',
      blocks: [
        { type: 'bullets', items: executiveBullets },
        {
          type: 'note',
          title: 'Como ler',
          text:
            'Todos os números são oficiais (TSE 2022, 1º turno). O relatório compara duas candidaturas de cargos diferentes: ' +
            'Solla foi deputado federal (nº 1313) e Ceuci, deputada estadual (nº 13192). A sobreposição medida é entre as duas ' +
            'geografias de voto, não entre eleitores — não se observa quem votou em quem.',
        },
      ],
    },
    {
      id: 'ceuci',
      title: 'Quem é Ceuci Nunes — e o que os números de 2022 dizem',
      blocks: [
        {
          type: 'paragraphs',
          items: [
            'Ceuci de Lima Xavier Nunes é médica infectologista e ficou 15 anos à frente do Instituto Couto Maia, referência estadual em infectologia — inclusive na pandemia de covid-19. Em 2022, foi candidata a deputada estadual pelo PT (nº 13192): recebeu 36.992 votos, não se elegeu, mas foi a mais votada do PT na capital, com 19.776 votos em Salvador. Desde março de 2023 preside a Bahiafarma, fundação estadual de medicamentos. Declarou à imprensa, em 2025, que não será candidata em 2026.',
            `Para a campanha de Solla, isso define o papel dela: não é concorrente interna nem candidata a acomodar — é uma liderança com rede própria na saúde, voto concentrado na capital e história de gestão reconhecida. A pergunta deste relatório é onde essa rede encosta na votação de Solla e onde ela alcança eleitor que o mandato ainda não mobiliza.`,
            `A resposta tem dois lados. O primeiro: existe um centro comum (${list(zoneList(summary.shared))}) em que os dois estão acima da média — nesses territórios, a memória de Ceuci reforça o voto que Solla já tem. O segundo: a votação dela é bem mais concentrada que a dele. ${pct(ceuciTop5Share)} do voto dela na cidade está em ${ceuciTop}; a de Solla se espalha por toda a cidade, com presença forte em zonas periféricas onde ela quase não aparece (ZE 8, 14, 15, 16 e 19).`,
          ],
        },
        {
          type: 'note',
          title: 'Alerta jurídico-eleitoral',
          text: 'Ceuci preside uma fundação estadual. Uso de imagem, agenda e declarações em ano eleitoral deve passar pelo jurídico da campanha antes de virar material. Este relatório é análise de dados públicos — não é parecer jurídico.',
        },
      ],
    },
    {
      id: 'metodo',
      title: 'Método, fontes e limites',
      blocks: [
        {
          type: 'paragraphs',
          items: [
            'Fonte: resultados oficiais do TSE para 2022 (votação nominal de 1º turno por município e zona eleitoral). Solla: deputado federal nº 1313 (PT), 128.968 votos no estado e 27.264 em Salvador. Ceuci: deputada estadual nº 13192 (PT), 36.992 votos no estado e 19.776 em Salvador. Salvador é lida pelas suas 19 zonas eleitorais (ZE 1–19).',
            'Os valores foram conferidos contra duas referências: o artefato federal já commitado no Teqo (votação de Solla por zona, conferida zona a zona) e os totais oficiais de Ceuci (36.992 no estado; 19.776 em Salvador).',
            'Bairros: a lista de bairros por zona é a circunscrição oficial do TRE-BA (Resolução Administrativa nº 2/2017, Anexo I). O mapa de bairros usa a malha de bairros do IBGE (Censo 2022) e pinta cada bairro com os números da zona que contém seu centroide.',
            'Força relativa: o LQ (quociente local) compara a fatia da zona no voto do candidato com a fatia da zona nos votos válidos. LQ = 1 é exatamente a média do candidato; acima de 1, a zona é relativamente forte para ele.',
            'Sobreposição: o índice soma, zona a zona, o menor valor entre as duas fatias de voto (0 a 1). A correlação mede se as duas votações sobem e descem juntas entre as zonas — com 19 zonas, é indício, não probabilidade.',
          ],
        },
        {
          type: 'note',
          title: 'Limite duro: não existe voto por bairro',
          text: 'Os dados disponíveis têm votação por município e zona eleitoral. Não há voto por seção, local de votação ou bairro — nenhum número deste relatório deve ser lido como votação de um bairro. Bairro aqui é a lista oficial de bairros que compõem a zona. O mapa de bairros é ilustrativo: mostra a malha e a classe da zona de cada bairro.',
        },
      ],
    },
    {
      id: 'mapas',
      title: 'Mapas',
      blocks: [
        {
          type: 'html',
          html: renderZoneChoropleth({
            values: new Map(metrics.map((zone) => [zone.zoneNumber, zone.sollaVotes])),
            title: 'Solla em Salvador — votos por ZE (2022)',
            caption:
              'Classes por quantis da própria votação. Quanto mais escuro, mais votos na zona.',
            legendTitle: 'Votos de Solla:',
          }),
        },
        {
          type: 'html',
          html: renderZoneChoropleth({
            values: new Map(metrics.map((zone) => [zone.zoneNumber, zone.ceuciVotes])),
            title: 'Ceuci em Salvador — votos por ZE (2022)',
            caption:
              'Classes por quantis da própria votação. A mancha dela é bem mais concentrada que a de Solla.',
            legendTitle: 'Votos de Ceuci:',
          }),
        },
        { type: 'html', html: renderZoneClassMap() },
        { type: 'html', html: renderBairroClassMap() },
      ],
    },
    {
      id: 'graficos',
      title: 'Votos por zona e dispersão',
      blocks: [
        { type: 'html', html: renderBars() },
        { type: 'html', html: renderScatter() },
      ],
    },
    {
      id: 'tabelas',
      title: 'Tabelas',
      blocks: [
        { type: 'table', ...zoneTable() },
        { type: 'table', ...overlapTable() },
        { type: 'table', ...bairroTable() },
      ],
    },
    {
      id: 'ciencia',
      title: 'Leitura da ciência política',
      subtitle: 'Lente da persona pesquisadora — Prof. Helena Rocha (sintética)',
      blocks: [
        {
          type: 'paragraphs',
          items: [
            `A conta do quociente. Em 2022, a Bahia teve ${nf(data.stateContext.stateValid)} votos válidos para deputado estadual e 63 cadeiras — quociente eleitoral de aproximadamente ${nf(data.stateContext.stateValid / 63)} votos. Ceuci fez 36.992 (cerca de um terço de um quociente): não se elegeu sozinha, mas construiu uma base de capital que, em 2026, vale como rede de apoio para um deputado federal que precisa de 150 mil votos.`,
            `Dominância e concentração são coisas diferentes. Ceuci tem dominância concentrada: LQ ${dec(metricsByZone.get(13).ceuciLq)} na ZE 13, LQ ${dec(metricsByZone.get(1).ceuciLq)} na ZE 1, e ${pct(summary.ceuciTop3Share)} do voto dela nas três maiores zonas. Solla tem dominância dispersa: as três maiores zonas dele somam ${pct(summary.sollaTop3Share)}. Não é defeito de um nem virtude do outro — é a diferença entre uma candidata de uma cidade e um deputado de um estado. A estratégia mora no cruzamento: nos redutos compartilhados, somar; nas zonas de Ceuci sem Solla, transferir presença; nas de Solla sem Ceuci, não forçar.`,
            `Eleito é o que dispersa a tempo. Solla já dispersa no estado; o risco em Salvador é concentrar esforço onde ele já vai bem. As zonas mais fortes de Ceuci (1, 2, 6, 10 e 13) são urbanas, de classe média e de serviços — não são o reduto histórico do mandato, e é exatamente aí que a rede dela muda o patamar.`,
            `Campanha não persuade; organiza e orienta. A função de Ceuci não é converter adversários: é orientar quem já votou nela a votar 1313. São quase 37 mil pessoas no estado — 19.776 só na capital — e a literatura de campanha mostra que contato pessoal via rede de confiança é o que mobiliza. O custo é baixo porque a lista de apoiadores de 2022 existe.`,
            `O mandato é a campanha. A memória que Ceuci carrega é de gestão e de saúde pública (Couto Maia, pandemia, medicamentos). O material e os eventos devem falar de entrega e continuidade do mandato de Solla — não de cargo, nem de futura candidatura dela.`,
          ],
        },
        {
          type: 'note',
          title: 'O que é dado e o que é leitura',
          text: 'Dado: todos os números TSE deste relatório, conferidos na fonte. Leitura: as hipóteses de transferência de voto e os papéis sugeridos para Ceuci. Nenhuma transferência de voto é medida aqui — isso só se verifica na urna de 2026.',
        },
      ],
    },
    {
      id: 'plano',
      title: 'Plano do coordenador',
      subtitle:
        'Lente da persona coordenadora — Nivaldo Cerqueira (sintética, ancorada em evidência real)',
      blocks: [
        {
          type: 'paragraphs',
          items: [
            'O critério é o de sempre: % do nosso voto decide a fila, e a agenda segue a fila. A tabela abaixo traduz a análise em quatro filas de trabalho. As zonas de prioridade 1 e 2 concentram ' +
              `${pct(priorityShare)} ` +
              'da soma das duas votações na cidade — é onde o esforço conjunto tem retorno mais claro.',
            `Cuidado com fogo amigo: Ceuci não é candidata e não deve virar palanque paralelo. O material é de apoio ao mandato; o alinhamento com o PT estadual evita disputa de narrativa.`,
          ],
        },
        { type: 'table', ...priorityTable() },
        {
          type: 'bullets',
          items: [
            {
              label: 'Semana 1 — rede.',
              text: 'Fechar a lista de convites da rede de Ceuci (saúde, profissionais, apoiadores de 2022) e cruzar com as zonas 1, 2, 6, 10 e 13. Sem lista, não há evento.',
            },
            {
              label: 'Semana 2 — redutos.',
              text: `Dois eventos conjuntos: ZE 13 (${nf(metricsByZone.get(13).combinedVotes)} votos somados) e ZE 10 (${nf(metricsByZone.get(10).combinedVotes)}). Formato: agenda de saúde + prestação de contas do mandato.`,
            },
            {
              label: 'Semana 3 — capital.',
              text: `ZE 1 (${nf(metricsByZone.get(1).combinedVotes)}) e ZE 6 (${nf(metricsByZone.get(6).combinedVotes)}). Material “Ceuci apoia Solla” na porta das unidades e no digital geolocalizado.`,
            },
            {
              label: 'Semana 4 — ponte.',
              text: `ZE 2 (${nf(metricsByZone.get(2).combinedVotes)}): agenda dela com lideranças comunitárias; Solla entra no fim. Balanço e repriorização com os deltas do campo.`,
            },
          ],
        },
        {
          type: 'note',
          title: 'Como usar este documento na assessoria',
          text: 'A tabela por bairro (seção Tabelas) é o anexo do dossiê pré-agenda: antes de qualquer visita, confira a zona do bairro e a classe. Nas zonas 1 e 2, a presença de Ceuci é o argumento; nas zonas 3 e 4, o mandato fala sozinho.',
        },
      ],
    },
    {
      id: 'anexo',
      title: 'Anexo — fontes e reprodução',
      blocks: [
        {
          type: 'bullets',
          items: [
            {
              label: 'Dados eleitorais.',
              text: 'TSE — Resultados 2022, votação nominal de 1º turno por município e zona (arquivos de dados abertos). Extração de 14/09/2026, conferida contra o artefato interno do Teqo e contra os totais oficiais.',
            },
            {
              label: 'Bairros.',
              text: 'TRE-BA, Resolução Administrativa nº 2/2017, Anexo I (circunscrição das zonas por bairro). Malha de bairros: IBGE, Censo 2022 (shapefile BA_bairros_CD2022).',
            },
            {
              label: 'Biografia de Ceuci.',
              text: 'Registro público: candidatura 2022 (TSE), votação de 36.992/19.776, presidência da Bahiafarma (2023) e declaração de não candidatura em 2026 (imprensa).',
            },
            {
              label: 'Reprodução.',
              text: 'NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-solla-ceuci-salvador-report.mjs — lê o JSON de entrada commitado e regenera o PDF e este Markdown. Sem banco de dados.',
            },
            {
              label: 'Aviso.',
              text: 'Documento interno de campanha. Não contém dados pessoais; usa apenas dados públicos de votação. Os mapas de zona são derivados de malha de bairros (aproximação) — não são limites oficiais do TSE.',
            },
          ],
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Markdown companion
// ---------------------------------------------------------------------------

const renderTableMd = ({ caption, head, rows }) => {
  const plainRows = rows.map((row) =>
    row.map((cell) =>
      String(cell)
        .replace(/<span[^>]*>([^<]*)<\/span>/g, '$1')
        .replaceAll('|', '\\|'),
    ),
  )
  const widths = head.map((cell, index) =>
    Math.max(cell.length, ...plainRows.map((row) => row[index].length)),
  )
  const pad = (text, index) => text + ' '.repeat(widths[index] - text.length)
  const lines = [
    `**${caption}**`,
    '',
    `| ${head.map(pad).join(' | ')} |`,
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...plainRows.map((row) => `| ${row.map(pad).join(' | ')} |`),
  ]
  return lines.join('\n')
}

const renderBlocksMd = (blocks) =>
  blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraphs':
          return block.items.join('\n\n')
        case 'bullets':
          return block.items.map((item) => `- **${item.label}** ${item.text}`).join('\n')
        case 'note':
          return `> **${block.title}** ${block.text}`
        case 'table':
          return renderTableMd(block)
        case 'html':
          return '_(mapa/gráfico disponível no PDF)_'
        default:
          return ''
      }
    })
    .join('\n\n')

const markdown = [
  `# ${report.title}`,
  '',
  `**${report.subtitle}**`,
  `Gerado em ${report.date} — dados públicos TSE 2022. Documento interno de campanha.`,
  '',
  report.sections
    .map(
      (section) =>
        `## ${section.title}${section.subtitle ? `\n\n_${section.subtitle}_` : ''}\n\n${renderBlocksMd(section.blocks)}`,
    )
    .join('\n\n'),
  '',
  `---`,
  '',
  `Proveniência dos dados: ${data.provenance.source} Extração: ${data.provenance.extractedAt}. ${data.provenance.extractedFrom}`,
  '',
  ...data.provenance.crossChecks.map((check) => `- ${check}`),
  '',
].join('\n')

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const renderKpis = () =>
  report.kpis
    .map(
      (kpi) =>
        `<div class="kpi"><span class="kpi-value">${htmlEscape(kpi.value)}</span><span class="kpi-label">${htmlEscape(kpi.label)}</span></div>`,
    )
    .join('')

const renderBlocksHtml = (blocks) =>
  blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraphs':
          return block.items.map((item) => `<p>${htmlEscape(item)}</p>`).join('')
        case 'bullets':
          return `<ul class="bullets">${block.items
            .map(
              (item) =>
                `<li><strong>${htmlEscape(item.label)}</strong> ${htmlEscape(item.text)}</li>`,
            )
            .join('')}</ul>`
        case 'note':
          return `<div class="note"><strong>${htmlEscape(block.title)}</strong><p>${htmlEscape(block.text)}</p></div>`
        case 'table':
          return renderTableHtml(block)
        case 'html':
          return block.html
        default:
          return ''
      }
    })
    .join('')

const renderTableHtml = ({ caption, head, rows, align }) => {
  const alignClass = (index) => (align?.[index] === 'right' ? ' class="num"' : '')
  return `
    <table>
      <caption>${htmlEscape(caption)}</caption>
      <thead><tr>${head.map((cell, index) => `<th${alignClass(index)}>${htmlEscape(cell)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell, index) =>
                  `<td${alignClass(index)}>${cell.startsWith('<span') ? cell : htmlEscape(cell)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('')}</tbody>
    </table>`
}

const renderSectionHtml = (section) => `
  <section class="section${section.id === 'sumario' ? '' : ' page-break'}">
    <h2>${htmlEscape(section.title)}</h2>
    ${section.subtitle ? `<p class="section-subtitle">${htmlEscape(section.subtitle)}</p>` : ''}
    ${renderBlocksHtml(section.blocks)}
  </section>`

const css = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Fira Sans', 'DejaVu Sans', sans-serif;
    color: #18181b;
    font-size: 9.6pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 26pt; line-height: 1.08; margin: 0 0 4mm; letter-spacing: -0.01em; }
  h2 { font-size: 15pt; margin: 0 0 3mm; color: #c51414; letter-spacing: -0.01em; }
  h3 { font-size: 11pt; }
  p { margin: 0 0 3mm; }
  .cover { height: 256mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }
  .cover-top { padding-top: 6mm; }
  .brand { color: #c51414; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; font-size: 8.5pt; }
  .cover .subtitle { font-size: 13pt; color: #3f3f46; max-width: 150mm; }
  .cover-meta { color: #71717a; font-size: 9pt; }
  .cover-rule { height: 2.4mm; background: #c51414; width: 34mm; margin: 5mm 0; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 4mm 0 0; }
  .kpi { border: .8px solid #e4e4e7; border-radius: 2mm; padding: 3mm; background: #fafafa; }
  .kpi-value { display: block; font-size: 15pt; font-weight: 700; color: #c51414; }
  .kpi-label { display: block; font-size: 7.8pt; color: #52525b; }
  .section { padding: 0; }
  .page-break { break-before: page; }
  .section-subtitle { color: #71717a; font-style: italic; margin-top: -1mm; }
  .bullets { margin: 0 0 3mm; padding-left: 4.5mm; }
  .bullets li { margin-bottom: 2mm; }
  .note { border-left: 2.4mm solid #c51414; background: #fafafa; padding: 3mm 4mm; border-radius: 0 2mm 2mm 0; margin: 3mm 0; }
  .note strong { color: #c51414; }
  .note p { margin: 1mm 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 8.2pt; margin: 0 0 6mm; }
  caption { caption-side: top; text-align: left; font-weight: 700; font-size: 8.8pt; padding-bottom: 2mm; color: #18181b; }
  th { text-align: left; background: #f4f4f5; border-bottom: 1px solid #d4d4d8; padding: 2.1mm 1.6mm; font-size: 7.3pt; text-transform: uppercase; letter-spacing: .03em; color: #52525b; }
  td { border-bottom: .6px solid #e4e4e7; padding: 2.1mm 1.6mm; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .badge { display: inline-block; color: #ffffff; font-size: 7pt; font-weight: 600; padding: .6mm 1.6mm; border-radius: 6mm; white-space: nowrap; }
  figure.map { margin: 0 0 6mm; border: .8px solid #e4e4e7; border-radius: 2mm; padding: 3.5mm; break-inside: avoid; }
  figure.map + figure.map { margin-top: 10mm; }
  figure.map figcaption { display: flex; flex-direction: column; gap: .8mm; margin-bottom: 2.5mm; }
  figure.map figcaption strong { font-size: 9.6pt; }
  figure.map figcaption span { font-size: 7.8pt; color: #52525b; }
  figure.map svg { width: 100%; height: auto; display: block; }
  .legend { display: flex; flex-wrap: wrap; gap: 3mm; align-items: center; margin-top: 2.5mm; font-size: 7.6pt; color: #3f3f46; }
  .legend-title { font-weight: 700; color: #52525b; }
  .legend-item { display: inline-flex; align-items: center; gap: 1.2mm; }
  .legend-swatch { width: 3.4mm; height: 3.4mm; border-radius: .8mm; border: .6px solid #d4d4d8; display: inline-block; }
  .zone-label { font-family: 'Fira Sans', sans-serif; font-size: 9px; font-weight: 700; fill: #18181b; text-anchor: middle; paint-order: stroke; stroke: #ffffff; stroke-width: 2.6px; }
  .chart-label { font-family: 'Fira Sans', sans-serif; font-size: 10px; fill: #3f3f46; }
  .chart-value { font-family: 'Fira Sans', sans-serif; font-size: 9px; fill: #52525b; }
  .axis-label { font-family: 'Fira Sans', sans-serif; font-size: 10px; fill: #52525b; }
  .axis-title { font-family: 'Fira Sans', sans-serif; font-size: 11px; fill: #3f3f46; font-weight: 600; }
  .point-label { font-family: 'Fira Sans', sans-serif; font-size: 10px; fill: #3f3f46; font-weight: 600; paint-order: stroke; stroke: #ffffff; stroke-width: 2.4px; }
  .grid { stroke: #e4e4e7; stroke-width: 1; }
  .median { stroke: #a1a1aa; stroke-width: 1.2; stroke-dasharray: 5 4; }
  .page-break + section { break-before: page; }
`

const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(report.title)}</title><style>${css}</style></head>
<body>
  <section class="cover">
    <div class="cover-top">
      <div class="brand">Campanha Jorge Solla 1313 · Análise territorial</div>
      <h1>${htmlEscape(report.title)}</h1>
      <div class="cover-rule"></div>
      <p class="subtitle">${htmlEscape(report.subtitle)}</p>
    </div>
    <div>
      <div class="kpis">${renderKpis()}</div>
      <p class="cover-meta">${htmlEscape(report.date)} · Fonte: TSE 2022 (dados públicos) · Uso interno da assessoria<br>
      Solla: deputado federal nº 1313 · Ceuci: deputada estadual nº 13192 · Salvador, 19 zonas eleitorais</p>
    </div>
  </section>
  ${report.sections.map(renderSectionHtml).join('')}
</body>
</html>`

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

await mkdir(join(ROOT, 'data/solla-ceuci-salvador'), { recursive: true })
const htmlPath = join(ROOT, 'data/solla-ceuci-salvador/relatorio.html')
await writeFile(htmlPath, html)

await mkdir(join(ROOT, dirname(REPORT_BASE)), { recursive: true })
await writeFile(join(ROOT, `${REPORT_BASE}.md`), markdown)
console.log(`[${LABEL}] wrote ${REPORT_BASE}.md`)

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  await page.pdf({
    path: join(ROOT, `${REPORT_BASE}.pdf`),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-family:'Fira Sans',sans-serif;font-size:7pt;color:#a1a1aa;padding:0 12mm;display:flex;justify-content:space-between;">
      <span>Solla × Ceuci — Salvador 2022 · dados públicos TSE · documento interno de campanha</span>
      <span>pág. <span class="pageNumber"></span>/<span class="totalPages"></span></span>
    </div>`,
    margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
  })
} finally {
  await browser.close()
}

console.log(`[${LABEL}] wrote ${REPORT_BASE}.pdf`)
console.log(
  `[${LABEL}] overlap=${pct(summary.overlapCoefficient)} pearson=${dec(summary.pearson)} ` +
    `spearman=${dec(summary.spearman)} zones=${metrics.length} bairros=${bairros.length} ` +
    `(centroid fallbacks: ${nearestFallbacks}, mesh sha256=${bairroHash.slice(0, 16)})`,
)
console.log(
  `[${LABEL}] shared=${list(zoneList(summary.shared))} | ceuci-only=${list(zoneList(summary.ceuciOnly))} | ` +
    `solla-only=${list(zoneList(summary.sollaOnly))} | open=${list(zoneList(summary.open))}`,
)
