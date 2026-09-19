/**
 * Build an Instagram-ready chart PNG from pasted/attached data (C191).
 *
 * The skill `graficos-dados` orchestrates: it parses the input, decides the
 * chart relation and writes the headline/source, then calls this entry. The
 * entry is deterministic and fail-closed: guardrail violations and missing
 * data exit non-zero instead of drawing something misleading. Rendered local,
 * never committed (data/ and docs/research/ are gitignored).
 *
 * Usage:
 *   node scripts/build-chart-from-data.mjs --in=data/graficos-instagram/dados.csv \
 *     --headline="Um território concentra o maior resultado" --source="TSE 2022" \
 *     [--subtitle=...] [--note=...] [--type=bar] [--size=feed|square|story] \
 *     [--highlight="Território A"] [--out=docs/research/graficos-instagram/x.png]
 *   node scripts/build-chart-from-data.mjs --in=dados.csv --inspect
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { launchPdfBrowser, screenshotHtmlPng } from './lib/buildPdf.mjs'
import {
  MAX_POINTS,
  MAX_POINTS_STORY,
  SIZES,
  classifyRelation,
  parseInput,
  validateSpec,
} from './lib/chartData.mjs'
import { dieWithLabel, parseEqualsFlags } from './lib/cli.mjs'
import { renderChartHtml } from './lib/graficosInstagramRender.mjs'

const LABEL = 'graficos-dados'

const FORMAT_BY_EXT = {
  '.xlsx': 'xlsx',
  '.xls': 'xls',
  '.csv': 'csv',
  '.tsv': 'tsv',
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
}

const slugify = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

const today = () => new Date().toISOString().slice(0, 10)

const readInput = async (flags) => {
  const path = flags.in === '-' || flags.in === true ? null : String(flags.in ?? '')
  if (!path) {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return { text: Buffer.concat(chunks).toString('utf8'), format: 'txt' }
  }
  const format = FORMAT_BY_EXT[extname(path).toLowerCase()] ?? 'txt'
  const buffer = await readFile(path)
  if (format === 'xlsx' || format === 'xls') return { buffer, format }
  return { text: buffer.toString('utf8'), format }
}

/**
 * Testable orchestrator: the Chromium launch, the screenshot and the exit path
 * are injectable, so the unit suite covers the CLI paths with fakes — no real
 * browser and no `process.exit` killing the worker.
 *
 * @param {{
 *   argv?: string[],
 *   launchBrowser?: () => Promise<{ close: () => Promise<void> }>,
 *   screenshot?: typeof screenshotHtmlPng,
 *   die?: (message: string) => never,
 *   repoRoot?: string,
 * }} [options]
 */
export const main = async ({
  argv = process.argv.slice(2),
  launchBrowser = launchPdfBrowser,
  screenshot = screenshotHtmlPng,
  die = dieWithLabel(LABEL),
  repoRoot = process.cwd(),
} = {}) => {
  const { flags } = parseEqualsFlags(argv)

  let spec
  if (flags.spec) {
    try {
      spec = JSON.parse(await readFile(String(flags.spec), 'utf8'))
    } catch (error) {
      die(`falha ao ler --spec=${flags.spec}: ${error?.message ?? error}`)
    }
  } else {
    if (!flags.in) die('informe --in=<arquivo|-> com os dados (ou --spec=<json> para replay).')
    let input
    try {
      input = await readInput(flags)
    } catch (error) {
      die(`falha ao ler --in=${flags.in}: ${error?.message ?? error}`)
    }
    const dataset = parseInput(input)

    if (flags.inspect) {
      process.stdout.write(`${JSON.stringify(dataset, null, 2)}\n`)
      return
    }

    if (dataset.rows.length === 0 || dataset.issues.length > 0) {
      process.stdout.write(
        `${JSON.stringify({ needsQuestion: true, issues: dataset.issues, rows: dataset.rows }, null, 2)}\n`,
      )
      die('dado ambíguo ou faltando — pergunte à pessoa antes de gerar (nada é completado).')
    }

    const chartType = classifyRelation(dataset.rows, flags.type ? String(flags.type) : null)
    spec = {
      chartType,
      size: flags.size ? String(flags.size) : 'feed',
      headline: flags.headline ? String(flags.headline) : '',
      subtitle: flags.subtitle ? String(flags.subtitle) : '',
      source: flags.source ? String(flags.source) : '',
      note: flags.note ? String(flags.note) : '',
      highlight: flags.highlight ? String(flags.highlight) : null,
      rows: dataset.rows,
    }
  }

  if (!spec.source) die('informe --source (a fonte viaja dentro da imagem).')
  validateSpec(spec)

  const slug = slugify(spec.headline)
  const specPath = join(repoRoot, 'data/graficos-instagram', `${slug || 'grafico'}.chart-spec.json`)
  const outPath = flags.out
    ? String(flags.out)
    : join(
        repoRoot,
        'docs/research/graficos-instagram',
        `${slug || 'grafico'}-${today()}-${spec.size ?? 'feed'}.png`,
      )

  const html = renderChartHtml(spec)
  const sizeKey = SIZES[spec.size] ? spec.size : 'feed'
  const canvas = SIZES[sizeKey]
  const pointCap =
    sizeKey === 'story' && (spec.chartType === 'bar' || spec.chartType === 'column')
      ? MAX_POINTS_STORY
      : MAX_POINTS
  const browser = await launchBrowser()
  try {
    await mkdir(dirname(outPath), { recursive: true })
    await mkdir(dirname(specPath), { recursive: true })
    await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`)
    const { size } = await screenshot(browser, {
      html,
      width: canvas.width,
      height: canvas.height,
      outPath,
    })
    console.log(
      `[${LABEL}] PNG ${outPath} (${canvas.width}×${canvas.height}, ${Math.round(size / 1024)} KB) · tipo=${spec.chartType} · ${spec.rows.length} ponto(s) ≤ ${pointCap}`,
    )
  } finally {
    await browser.close()
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((error) => {
    dieWithLabel(LABEL)(error?.message ?? String(error))
  })
}
