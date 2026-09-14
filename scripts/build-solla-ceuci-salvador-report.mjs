/**
 * Report generator (C157, granular layer C161): Solla × Ceuci in Salvador, 2022 TSE.
 *
 * Produces, from the committed input JSONs and the committed geometries:
 *   - docs/research/analise-sobreposicao-solla-ceuci-salvador-2022.md
 *   - docs/research/analise-sobreposicao-solla-ceuci-salvador-2022.pdf
 *
 * Why a script instead of a Payload route: the deliverable is a printable
 * document for the campaign staff, and the project's standing decision is
 * CSS/HTML print over a server-side PDF library (docs/plans/dossie-municipio.md).
 * Chromium comes from the already-installed @playwright/test — no new dependency.
 *
 * Data:
 *   - docs/research/solla-ceuci-salvador-2022-dados.json (zone layer, C157)
 *   - docs/research/solla-ceuci-salvador-2022-bairros-dados.json (bairro layer,
 *     built from the TSE section files by scripts/build-solla-ceuci-salvador-bairros.mjs)
 * The script re-checks Solla zone by zone against the committed federal artifact
 * before rendering, so the report can never drift from the app's own baseline.
 *
 * Geometry: Salvador zones from src/lib/geometries/bahia-municipality-zones.topo.json
 * (committed); Salvador neighborhoods from the IBGE Censo 2022 shapefile,
 * downloaded once to the gitignored data/geometries cache. Each IBGE polygon is
 * painted with the votes of the polling places it contains — the bairro layer.
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
  buildBairroMetrics,
  buildBairroSummary,
  buildReportSummary,
  buildZoneMetrics,
  ZONE_CLASSES,
} from './lib/sollaCeuciSalvadorMetrics.mjs'

const { discreteChoroplethFill, NO_DATA_FILL } = await import('../src/lib/choroplethColorScale.ts')
const { featureCentroid } = await import('../src/lib/municipalityProximity.ts')
const { downloadToBuffer } = await import('../src/lib/electionResultsZip.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-solla-ceuci-salvador-report'
const die = dieWithLabel(LABEL)

const DATA_PATH = join(ROOT, 'docs/research/solla-ceuci-salvador-2022-dados.json')
const BAIRRO_DATA_PATH = join(ROOT, 'docs/research/solla-ceuci-salvador-2022-bairros-dados.json')
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
const normalizeBairroName = (value) =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.,/()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

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

const bairroData = JSON.parse(await readFile(BAIRRO_DATA_PATH, 'utf8'))
const bairroMetrics = buildBairroMetrics({ bairros: bairroData.bairros, totals: bairroData.totals })
const bairroSummary = buildBairroSummary({ metrics: bairroMetrics })
const bairroMetricsByName = new Map(bairroMetrics.map((bairro) => [bairro.name, bairro]))

if (bairroData.totals.sollaVotes !== data.salvadorTotals.sollaVotes) {
  die(
    `Bairro layer Solla drift: ${bairroData.totals.sollaVotes} vs zone layer ${data.salvadorTotals.sollaVotes}.`,
  )
}
if (bairroData.totals.ceuciVotes !== data.salvadorTotals.ceuciVotes) {
  die(
    `Bairro layer Ceuci drift: ${bairroData.totals.ceuciVotes} vs zone layer ${data.salvadorTotals.ceuciVotes}.`,
  )
}

/** Bairros sorted by combined votes, capped — the one ordering the report uses. */
const topByCombined = (list, count) =>
  [...list].sort((left, right) => right.combinedVotes - left.combinedVotes).slice(0, count)

const bairroNumbers = (bairro) =>
  `(Solla ${nf(bairro.sollaVotes)} · Ceuci ${nf(bairro.ceuciVotes)})`

const bairroNames = (list) => list.map((bairro) => bairro.name).join(' · ')

const bairroLines = (list, count) =>
  list
    .slice(0, count)
    .map(
      (bairro) =>
        `${bairro.name} (Solla ${nf(bairro.sollaVotes)} · Ceuci ${nf(bairro.ceuciVotes)})`,
    )
    .join(' · ')

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
if (bairros.length !== bairroData.polygonsWithoutVotes.length + bairroData.bairros.length) {
  die('IBGE mesh size does not match the bairro layer (polygons with and without votes).')
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

const renderBairroChoropleth = ({ valueOf, title, caption, legendTitle }) => {
  const entries = bairroMetrics.map(valueOf).filter((value) => value > 0)
  const classes = quantileClasses(entries)
  const ranges = classRanges(entries)
  const fills = bairros
    .map((item) => {
      const metric = bairroMetricsByName.get(item.properties?.NM_BAIRRO)
      const value = metric ? valueOf(metric) : 0
      const classIndex = classes.get(value) ?? 0
      const fill = value > 0 ? discreteChoroplethFill(classIndex, 5) : NO_DATA_FILL
      return `<path d="${pathOf(item.geometry)}" fill="${fill}" stroke="#ffffff" stroke-width="0.4"/>`
    })
    .join('')

  const zoneBorders = zoneFeatures
    .map(
      (zone) =>
        `<path d="${pathOf(zone.geometry)}" fill="none" stroke="#3f3f46" stroke-width="1.2"/>`,
    )
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
        ${fills}
        ${zoneBorders}
        ${zoneLabelSvg()}
      </svg>
      <div class="legend"><span class="legend-title">${htmlEscape(legendTitle)}</span>${legend}</div>
    </figure>`
}

const renderBairroClassMap = () => {
  const fills = bairros
    .map((item) => {
      const metric = bairroMetricsByName.get(item.properties?.NM_BAIRRO)
      const fill = metric?.bairroClass.color ?? NO_DATA_FILL
      return `<path d="${pathOf(item.geometry)}" fill="${fill}" stroke="#ffffff" stroke-width="0.4"/>`
    })
    .join('')

  const zoneBorders = zoneFeatures
    .map(
      (zone) =>
        `<path d="${pathOf(zone.geometry)}" fill="none" stroke="#3f3f46" stroke-width="1.2"/>`,
    )
    .join('')

  const legend = Object.values(ZONE_CLASSES)
    .map((bairroClass) => {
      const count = bairroMetrics.filter(
        (bairro) => bairro.bairroClass.key === bairroClass.key,
      ).length
      return legendSwatch(bairroClass.color, `${bairroClass.label} (${count} bairros)`)
    })
    .join('')

  return `
    <figure class="map">
      <figcaption><strong>Classes de sobreposição por bairro</strong><span>Cada polígono IBGE é o bairro do local de votação; cinza = sem local de votação. Classes pelo quociente local (LQ) de cada candidato: acima ou abaixo da média dele em Salvador.</span></figcaption>
      <svg viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="img" aria-label="Classes de sobreposição por bairro">
        ${fills}
        ${zoneBorders}
        ${zoneLabelSvg()}
      </svg>
      <div class="legend">${legend}</div>
    </figure>`
}

const renderBars = () => {
  const rows = topByCombined(bairroMetrics, 25)
  const maxValue = Math.max(...rows.map((bairro) => Math.max(bairro.sollaVotes, bairro.ceuciVotes)))
  const barMaxWidth = 640
  const labelWidth = 190
  const rowHeight = 27
  const top = 34
  const height = top + rows.length * rowHeight + 12

  const bars = rows
    .map((bairro, index) => {
      const y = top + index * rowHeight
      const sollaWidth = (bairro.sollaVotes / maxValue) * barMaxWidth
      const ceuciWidth = (bairro.ceuciVotes / maxValue) * barMaxWidth
      const label = bairro.name.length > 30 ? `${bairro.name.slice(0, 29)}…` : bairro.name
      return `
        <text x="${labelWidth - 10}" y="${y + 13}" class="chart-label" text-anchor="end">${htmlEscape(label)}</text>
        <rect x="${labelWidth}" y="${y + 2}" width="${sollaWidth.toFixed(1)}" height="9" rx="1.5" fill="#c51414"/>
        <text x="${(labelWidth + 4 + sollaWidth).toFixed(1)}" y="${y + 10}" class="chart-value">${nf(bairro.sollaVotes)}</text>
        <rect x="${labelWidth}" y="${y + 13}" width="${ceuciWidth.toFixed(1)}" height="9" rx="1.5" fill="#0d9488"/>
        <text x="${(labelWidth + 4 + ceuciWidth).toFixed(1)}" y="${y + 21}" class="chart-value">${nf(bairro.ceuciVotes)}</text>`
    })
    .join('')

  return `
    <figure class="map">
      <figcaption><strong>Top 25 bairros — Solla e Ceuci (2022)</strong><span>Bairros ordenados pela soma Solla + Ceuci. Vermelho: Solla (federal 1313). Verde: Ceuci (estadual 13192).</span></figcaption>
      <svg viewBox="0 0 1000 ${height}" role="img" aria-label="Votos por bairro">
        <g class="chart">${bars}</g>
      </svg>
    </figure>`
}

const renderBairroQuadrant = () => {
  const width = 1000
  const height = 560
  const left = 90
  const right = 50
  const top = 30
  const bottom = 60
  const limit = 3 // log2 domain: LQ 0,125 a 8
  const xOf = (lq) => left + ((Math.log2(lq) + limit) / (2 * limit)) * (width - left - right)
  const yOf = (lq) =>
    height - bottom - ((Math.log2(lq) + limit) / (2 * limit)) * (height - top - bottom)
  const ticks = [0.25, 0.5, 1, 2, 4, 8]

  const grid = ticks
    .map((tick) => {
      const x = xOf(tick)
      const y = yOf(tick)
      return `<line x1="${x}" y1="${top}" x2="${x}" y2="${height - bottom}" class="grid"/><text x="${x}" y="${height - bottom + 18}" class="axis-label" text-anchor="middle">${dec(tick)}</text><line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="grid"/><text x="${left - 10}" y="${y + 4}" class="axis-label" text-anchor="end">${dec(tick)}</text>`
    })
    .join('')

  const maxCombined = Math.max(...bairroMetrics.map((bairro) => bairro.combinedVotes))
  const pointRadius = (bairro) => 3.5 + Math.sqrt(bairro.combinedVotes / maxCombined) * 9

  const labelCandidates = new Set(topByCombined(bairroMetrics, 14).map((bairro) => bairro.name))
  for (const bairro of bairroSummary.topCeuciLq.slice(0, 4)) labelCandidates.add(bairro.name)
  for (const bairro of bairroSummary.topSollaLq.slice(0, 4)) labelCandidates.add(bairro.name)

  const points = bairroMetrics
    .map((bairro) => {
      const x = xOf(Math.max(bairro.sollaLq, 0.13))
      const y = yOf(Math.max(bairro.ceuciLq, 0.13))
      const radius = pointRadius(bairro)
      const circle = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${bairro.bairroClass.color}" stroke="#ffffff" stroke-width="1.4"/>`
      if (!labelCandidates.has(bairro.name)) return circle
      const label = bairro.name.length > 24 ? `${bairro.name.slice(0, 23)}…` : bairro.name
      return `${circle}<text x="${(x + radius + 3).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" class="point-label">${htmlEscape(label)}</text>`
    })
    .join('')

  return `
    <figure class="map">
      <figcaption><strong>Bairros no plano do quociente local (LQ)</strong><span>Cada bolha é um bairro; tamanho = votos somados; cor = classe. Eixos em escala log: à direita/acima, o bairro pesa mais que a média do candidato. Linhas nos LQ 1,0 (médias de Solla e de Ceuci). LQ 0 é desenhado no piso do eixo. Bairros rotulados: os 14 maiores em volume e os extremos de LQ.</span></figcaption>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bairros no plano do quociente local">
        <g class="chart">${grid}
          <line x1="${xOf(1)}" y1="${top}" x2="${xOf(1)}" y2="${height - bottom}" class="median"/>
          <line x1="${left}" y1="${yOf(1)}" x2="${width - right}" y2="${yOf(1)}" class="median"/>
          ${points}
          <text x="${(width - right) / 2}" y="${height - 14}" class="axis-title" text-anchor="middle">LQ de Solla (federal 1313)</text>
          <text x="18" y="${(height - bottom + top) / 2}" class="axis-title" transform="rotate(-90 18 ${(height - bottom + top) / 2})" text-anchor="middle">LQ de Ceuci (estadual 13192)</text>
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

const bairroTable = () => ({
  caption: 'Votação 2022 por bairro (local de votação) — Solla e Ceuci, LQ e classe',
  head: [
    'Bairro',
    'ZE',
    'Cadastro TSE',
    'Solla',
    'Ceuci',
    'Soma',
    'LQ Solla',
    'LQ Ceuci',
    'Classe',
  ],
  align: ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'left'],
  rows: [...bairroMetrics]
    .sort((left, right) => right.combinedVotes - left.combinedVotes)
    .map((bairro) => {
      const registryNames = bairro.tseBairros
        .map((record) => record.name)
        .filter((name) => normalizeBairroName(name) !== normalizeBairroName(bairro.name))
      return [
        bairro.name,
        bairro.zones.map((zone) => zone.zoneNumber).join(' · '),
        registryNames.length > 0 ? registryNames.join(' · ') : '—',
        nf(bairro.sollaVotes),
        nf(bairro.ceuciVotes),
        nf(bairro.combinedVotes),
        dec(bairro.sollaLq),
        dec(bairro.ceuciLq),
        classBadge(bairro.bairroClass),
      ]
    }),
})

const priorityTable = () => ({
  caption: 'Fila de prioridade da campanha por bairro (critério: volume e classe de sobreposição)',
  head: ['Prioridade', 'Bairros', 'Por quê', 'Ação com Ceuci'],
  align: ['left', 'left', 'left', 'left'],
  rows: [
    [
      '1 — Defender',
      bairroNames(sharedTop8),
      'Redutos compartilhados: os dois acima da média; maior soma de votos.',
      'Evento conjunto no bairro (saúde + prestação de contas); material “Ceuci apoia Solla” na porta dos maiores locais, rádio e digital geolocalizado.',
    ],
    [
      '2 — Ponte Ceuci',
      bairroNames(ceuciPonte),
      'Ela acima da média, ele abaixo: a rede dela alcança eleitor que o mandato ainda não mobiliza.',
      'Agenda dela com lideranças de saúde e comunitárias; Solla entra no fim; meta: elevar o LQ de Solla no bairro para ≥ 1,0.',
    ],
    [
      '3 — Consolidar',
      bairroNames(sollaBase.slice(0, 8)),
      'Base Solla: ele acima da média; ela tem voto residual.',
      'Apoio declarado dela em material e visitas pontuais onde houver rede de saúde; não gastar agenda dela em bairro de baixo retorno.',
    ],
    [
      '4 — Volume aberto',
      bairroNames(openTop6),
      'Ambos abaixo da média nos dois quocientes; decidir pelo volume absoluto.',
      'Sem agenda dedicada dela; entra apenas em ação municipal de saúde (mutirão, anúncio de política pública).',
    ],
  ],
})

// ---------------------------------------------------------------------------
// Narrative model (rendered to HTML and Markdown from the same blocks)
// ---------------------------------------------------------------------------

const sharedTop8 = topByCombined(bairroSummary.shared, 8)
const ceuciPonte = [...bairroSummary.ceuciOnly]
  .filter((bairro) => bairro.ceuciVotes >= 100)
  .sort((left, right) => right.ceuciVotes - left.ceuciVotes)
const sollaBase = [...bairroSummary.sollaOnly]
  .filter((bairro) => bairro.sollaVotes >= 200)
  .sort((left, right) => right.sollaVotes - left.sollaVotes)
const openTop6 = topByCombined(bairroSummary.open, 6)
const ceuciAheadTop5 = [...bairroSummary.ceuciAhead]
  .sort((left, right) => right.ceuciVotes - left.ceuciVotes)
  .slice(0, 5)
const ceuciAheadShare = bairroSummary.ceuciAhead.reduce(
  (sum, bairro) => sum + bairro.ceuciShareOwn,
  0,
)
const ceuciConcentration = bairroSummary.ceuciHhi / bairroSummary.sollaHhi
const priorityBairros = [...sharedTop8, ...ceuciPonte]
const priorityBairroShare =
  priorityBairros.reduce((sum, bairro) => sum + bairro.combinedVotes, 0) /
  (data.salvadorTotals.sollaVotes + data.salvadorTotals.ceuciVotes)

const localsByCeuci = [...bairroData.locals]
  .filter((local) => local.polygonName)
  .sort((left, right) => right.ceuciVotes - left.ceuciVotes)
const biggestCeuciLocal = localsByCeuci[0]

const bairroPick = (name) => {
  const metric = bairroMetricsByName.get(name)
  if (!metric) die(`Bairro not found in the bairro layer: ${name}`)
  return metric
}

const executiveBullets = [
  {
    label: 'Descer ao bairro separa o que a zona juntava.',
    text:
      `Nas 19 zonas, as duas votações se sobrepõem em ${pct(summary.overlapCoefficient)}; nos ` +
      `${nf(bairroMetrics.length)} bairros com local de votação, a sobreposição cai para ${pct(bairroSummary.overlapCoefficient)}. ` +
      `A leitura de zona escondia contraste dentro dela — a ZE 12 mistura Stella Maris ${bairroNumbers(bairroPick('Stella Maris'))} ` +
      `com São Cristóvão ${bairroNumbers(bairroPick('São Cristóvão'))}; a ZE 4 tem Paripe ${bairroNumbers(bairroPick('Paripe'))} ` +
      `ao lado de Ilha Bom Jesus dos Passos ${bairroNumbers(bairroPick('Ilha Bom Jesus dos Passos'))}.`,
  },
  {
    label: 'Ceuci é candidata da capital; Solla, do estado.',
    text:
      `${pct(summary.salvadorShareOfCeuciState)} do voto de Ceuci (${nf(data.salvadorTotals.ceuciVotes)} de ${nf(data.candidates.ceuci.stateVotes)}) ` +
      `está em Salvador, contra ${pct(summary.salvadorShareOfSollaState)} do voto de Solla (${nf(data.salvadorTotals.sollaVotes)} de ${nf(data.candidates.solla.stateVotes)}). ` +
      `Na cidade, ela é concentrada: os 5 maiores bairros dela somam ${pct(bairroSummary.ceuciTop5Share)} do voto dela, contra ` +
      `${pct(bairroSummary.sollaTop5Share)} de Solla (concentração ${dec(ceuciConcentration)}× maior pelo HHI).`,
  },
  {
    label: 'Onde ela é maior que ele.',
    text:
      `Ceuci supera Solla em ${bairroSummary.ceuciAhead.length} dos ${nf(bairroMetrics.length)} bairros, que juntos reúnem ` +
      `${pct(ceuciAheadShare)} do voto dela na cidade — ${bairroLines(ceuciAheadTop5, 5)}, entre outros.`,
  },
  {
    label: 'Onde os dois somam mais.',
    text: `As maiores somas Solla + Ceuci estão em ${bairroLines(bairroSummary.strongestCombined, 6)} — os territórios onde uma agenda conjunta tem mais público potencial.`,
  },
  {
    label: 'Recomendação central.',
    text:
      `Três movimentos por bairro: (1) defender os redutos compartilhados (${bairroNames(sharedTop8)}, …) com agenda e material conjuntos; ` +
      `(2) usar Ceuci como cabeça de ponte onde ela é acima da média e Solla abaixo (${bairroNames(ceuciPonte)}); ` +
      `(3) ancorar o apoio declarado nas bases de Solla (${bairroNames(sollaBase.slice(0, 6))}, …) — ` +
      `sem tratá-la como candidata: ela declarou que não disputa 2026.`,
  },
]

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
      value: pct(bairroSummary.overlapCoefficient, 0),
      label: 'sobreposição das distribuições nos bairros',
    },
    {
      value: nf(bairroMetrics.length),
      label: `bairros com local de votação · ${nf(bairroData.totals.locais)} locais`,
    },
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
            'geografias de voto, não entre eleitores — não se observa quem votou em quem. O bairro é o do local de votação ' +
            '(cadastro do TSE), posicionado na malha do IBGE; não é o bairro de residência do eleitor.',
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
            `Na leitura por bairro, o centro comum tem endereço: ${bairroNames(sharedTop8)} — os maiores entre os bairros em que os dois estão acima da própria média. É um eixo centro-sul de serviços e educação: ${biggestCeuciLocal.name} (${nf(biggestCeuciLocal.ceuciVotes)} votos dela), em ${biggestCeuciLocal.polygonName}, é o maior local de votação dela na cidade, e as faculdades da UFBA, em Canela e Graça, aparecem entre os maiores.`,
            `Fora desse eixo, a votação dela é bem mais concentrada que a dele: os 10 maiores bairros dela somam ${pct(bairroSummary.ceuciTop10Share)} do voto dela, contra ${pct(bairroSummary.sollaTop10Share)} dos 10 maiores dele. Onde ela é maior que ele — ${nf(bairroSummary.ceuciAhead.length)} bairros, que reúnem ${pct(ceuciAheadShare)} do voto dela — estão ${bairroLines(ceuciAheadTop5, 5)}. Onde Solla é forte e ela quase não aparece estão as bases do mandato: ${bairroNames(sollaBase.slice(0, 7))}.`,
            `Há ainda a faixa em que ela está acima da média e ele abaixo — ${bairroNames(ceuciPonte)}. É onde a rede de Ceuci alcança eleitor que o mandato ainda não mobiliza, e onde a agenda conjunta rende mais do que repetir evento em bairro já consolidado.`,
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
            'Fonte: resultados oficiais do TSE para 2022 (1º turno). Solla: deputado federal nº 1313 (PT), 128.968 votos no estado e 27.264 em Salvador. Ceuci: deputada estadual nº 13192 (PT), 36.992 votos no estado e 19.776 em Salvador. Salvador é lida em dois níveis: as 19 zonas eleitorais (agregação oficial) e os bairros dos locais de votação.',
            'A camada de bairro desce à menor unidade publicada pelo TSE: a seção eleitoral. Cada seção tem votos por candidato (votacao_secao_2022) e pertence a um local de votação; o cadastro eleitoral (eleitorado_local_votacao_2022) associa esse local a um bairro e a uma coordenada. Somando as seções de cada local e agrupando pelos bairros, chega-se ao voto por bairro — cada local posicionado no polígono do IBGE Censo 2022. O denominador do LQ é a soma dos votos nominais das candidaturas válidas da seção, a mesma base do recorte por zona.',
            'Força relativa: o LQ (quociente local) compara a fatia do território no voto do candidato com a fatia do território nos votos válidos. LQ = 1 é exatamente a média do candidato; acima de 1, o território é relativamente forte para ele. Sobreposição: o índice soma, território a território, o menor valor entre as duas fatias de voto (0 a 1).',
            `Conferências: a soma das seções reproduz zona a zona o recorte por zona (Solla ${nf(data.salvadorTotals.sollaVotes)}; Ceuci ${nf(data.salvadorTotals.ceuciVotes)}); o denominador fecha com diferença residual ≤ 0,1% do total por zona; ${nf(bairroData.totals.sections)} seções, ${nf(bairroData.totals.locais)} locais e ${nf(bairroData.totals.bairros)} bairros com votação foram conferidos. Os hashes dos arquivos-fonte estão no JSON da camada de bairro.`,
            'Esta edição substitui a primeira versão do relatório, que pintava a malha de bairros com os números da zona do centroide: agora cada polígono tem os votos dos locais de votação que contém.',
          ],
        },
        {
          type: 'note',
          title: 'O que o dado não é',
          text: 'O voto é do local de votação, não da casa do eleitor: o cadastro não liga o voto ao domicílio e um mesmo local pode atender mais de um bairro. O bairro do TSE (150 nomes no cadastro eleitoral) e o polígono do IBGE (170 na malha; 138 com local de votação) têm recortes e nomes próprios — o mapa usa o polígono e mostra o nome do cadastro quando difere. Nenhum número aqui mede transferência de voto entre candidatos.',
        },
      ],
    },
    {
      id: 'mapas',
      title: 'Mapas',
      blocks: [
        {
          type: 'html',
          html: renderBairroChoropleth({
            valueOf: (bairro) => bairro.sollaVotes,
            title: 'Solla em Salvador — votos por bairro (2022)',
            caption:
              'Cada polígono é um bairro do IBGE com local de votação; classes por quantis. Quanto mais escuro, mais votos. Cinza: bairro sem local de votação.',
            legendTitle: 'Votos de Solla:',
          }),
        },
        {
          type: 'html',
          html: renderBairroChoropleth({
            valueOf: (bairro) => bairro.ceuciVotes,
            title: 'Ceuci em Salvador — votos por bairro (2022)',
            caption:
              'A mancha dela é bem mais concentrada: um eixo centro-sul (Pituba, Itaigara, Canela/Graça, Ondina) contra uma base de Solla espalhada pela periferia.',
            legendTitle: 'Votos de Ceuci:',
          }),
        },
        { type: 'html', html: renderBairroClassMap() },
        { type: 'html', html: renderZoneClassMap() },
      ],
    },
    {
      id: 'graficos',
      title: 'Bairros em volume e em força relativa',
      blocks: [
        { type: 'html', html: renderBars() },
        { type: 'html', html: renderBairroQuadrant() },
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
            `Dominância e concentração são coisas diferentes. Ceuci tem dominância concentrada: seus dez maiores bairros somam ${pct(bairroSummary.ceuciTop10Share)} do voto dela, contra ${pct(bairroSummary.sollaTop10Share)} dos dez maiores de Solla — e o HHI dela é ${dec(ceuciConcentration)}× o dele. Solla tem dominância dispersa: aparece acima da média em ${bairroSummary.sollaAhead.length} bairros, contra ${bairroSummary.ceuciAhead.length} de Ceuci. A estratégia mora no cruzamento: nos redutos compartilhados, somar; nos bairros de Ceuci sem Solla, transferir presença; nos de Solla sem Ceuci, não forçar.`,
            `Descer ao bairro separa o que a zona juntava. A sobreposição das duas distribuições cai de ${pct(summary.overlapCoefficient)} (19 zonas) para ${pct(bairroSummary.overlapCoefficient)} (138 bairros): no agregado, os dois parecem mais parecidos do que são. O eixo forte dela é de serviços e educação — Pituba, Itaigara, Brotas, Canela/Graça, Ondina, Imbuí, STIEP/Pituaçu —, com as faculdades da UFBA entre os maiores locais de votação; o dele é a periferia e o centro-norte — São Caetano, Pernambués, Cosme de Farias, Paripe, Nova Sussuarana, Mussurunga, as Cajazeiras.`,
            `Campanha não persuade; organiza e orienta. A função de Ceuci não é converter adversários: é orientar quem já votou nela a votar 1313. São quase 37 mil pessoas no estado — 19.776 só na capital, ${pct(ceuciAheadShare)} delas em bairros onde ela bateu Solla. E a literatura de campanha mostra que contato pessoal via rede de confiança é o que mobiliza; o custo é baixo porque a lista de apoiadores de 2022 existe e os locais de votação têm endereço.`,
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
            'O critério é o de sempre: % do nosso voto decide a fila, e a agenda segue a fila. A tabela abaixo traduz a análise em quatro filas de bairro. Os redutos compartilhados e as pontes de Ceuci concentram ' +
              `${pct(priorityBairroShare)} ` +
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
              text: `Fechar a lista de convites da rede de Ceuci (saúde, profissionais, apoiadores de 2022) e cruzar com o eixo: ${bairroNames(sharedTop8.slice(0, 5))}. Sem lista, não há evento.`,
            },
            {
              label: 'Semana 2 — redutos.',
              text: `Dois eventos conjuntos: ${topByCombined(bairroSummary.shared, 2)
                .map((bairro) => `${bairro.name} (${nf(bairro.combinedVotes)} votos somados)`)
                .join(' e ')}. Formato: agenda de saúde + prestação de contas do mandato.`,
            },
            {
              label: 'Semana 3 — ponte.',
              text: `${bairroNames(ceuciPonte.slice(0, 2))}: agenda dela com lideranças comunitárias e de saúde; Solla entra no fim.`,
            },
            {
              label: 'Semana 4 — consolidar.',
              text: `${bairroNames(sollaBase.slice(0, 3))}: apoio declarado no material e visita do mandato com a rede de saúde local. Balanço e repriorização com os deltas do campo.`,
            },
          ],
        },
        {
          type: 'note',
          title: 'Como usar este documento na assessoria',
          text: `A tabela por bairro (seção Tabelas) é o anexo do dossiê pré-agenda: antes de qualquer visita, confira o bairro, o LQ e a classe. Nos redutos compartilhados e nas pontes, a presença de Ceuci é o argumento; nas bases de Solla, o mandato fala sozinho. Os locais de votação de cada bairro estão no JSON da camada de bairro (docs/research/solla-ceuci-salvador-2022-bairros-dados.json).`,
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
              text: 'TSE — Portal de Dados Abertos. Camada de bairro: votação por seção (votacao_secao_2022_BA), aferição por seção (detalhe_votacao_secao_2022_BA), cadastro de locais e bairros (eleitorado_local_votacao_2022; coordenadas faltantes completadas pelo cadastro atual, pelo número do local) e candidaturas válidas (votacao_candidato_munzona_2022). Extração de 14/09/2026; hashes e conferências no JSON da camada de bairro.',
            },
            {
              label: 'Bairros.',
              text: 'Malha de bairros: IBGE, Censo 2022 (shapefile BA_bairros_CD2022). Nomes do cadastro eleitoral do TSE quando diferem do polígono. A lista TRE-BA (RA 02/2017) permanece na camada por zona.',
            },
            {
              label: 'Biografia de Ceuci.',
              text: 'Registro público: candidatura 2022 (TSE), votação de 36.992/19.776, presidência da Bahiafarma (2023) e declaração de não candidatura em 2026 (imprensa).',
            },
            {
              label: 'Reprodução.',
              text: 'Camada de bairro: NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-solla-ceuci-salvador-bairros.mjs --download (baixa os arquivos do TSE para o cache gitignored). Relatório: NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-solla-ceuci-salvador-report.mjs — lê os JSONs commitados e regenera o PDF e este Markdown. Sem banco de dados.',
            },
            {
              label: 'Aviso.',
              text: 'Documento interno de campanha. Não contém dados pessoais; usa apenas dados públicos de votação. Os polígonos dos mapas são a malha de bairros do IBGE — não são limites oficiais do TSE — e o voto é atribuído ao local de votação, não à residência do eleitor.',
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
  `Camada de bairro: ${bairroData.provenance.source} Extração: ${bairroData.provenance.extractedAt}.`,
  '',
  ...bairroData.validation.map((check) => `- ${check}`),
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
  `[${LABEL}] zone-overlap=${pct(summary.overlapCoefficient)} bairro-overlap=${pct(bairroSummary.overlapCoefficient)} ` +
    `pearson=${dec(bairroSummary.pearson)} spearman=${dec(bairroSummary.spearman)} zones=${metrics.length} ` +
    `bairros=${bairroMetrics.length} mesh=${bairros.length} (mesh sha256=${bairroHash.slice(0, 16)})`,
)
console.log(
  `[${LABEL}] shared=${bairroNames(sharedTop8)} | ponte=${bairroNames(ceuciPonte)} | ` +
    `base-solla=${bairroNames(sollaBase.slice(0, 6))} | aberto=${bairroNames(openTop6)}`,
)
