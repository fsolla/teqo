/**
 * City report builder (C163): snapshot + research (+ emendas) → PDF A4 + `.md`.
 *
 * Runs on the workstation: no database access, no persistence. Emendas come
 * from the official API at generation time (or from `--emendas=<json>` for a
 * replay) and are never stored in the base.
 *
 * Usage:
 *   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-city-report.mjs \
 *     --snapshot=data/relatorios-cidade/<slug>.snapshot.json \
 *     --research=data/relatorios-cidade/<slug>.research.json \
 *     --out-dir=docs/research/relatorios-cidade
 */

import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCityReport } from './lib/cityReportBlocks.mjs'
import { renderReportHtml, renderReportMd } from './lib/cityReportRender.mjs'
import { normalizeResearchInput } from './lib/cityReportResearch.mjs'
import { dieWithLabel, isTruthyEnv, loadCliEnv, parseEqualsFlags } from './lib/cli.mjs'
import {
  DEFAULT_AUTHOR_NAME,
  EMENDAS_YEARS,
  fetchAuthorEmendas,
} from './lib/portalTransparenciaEmendas.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-city-report'
const die = dieWithLabel(LABEL)
const DEFAULT_OUT_DIR = 'docs/research/relatorios-cidade'
const CACHE_DIR = 'data/relatorios-cidade'
const MM_TO_PX = 96 / 25.4
const PDF_MARGINS_MM = { top: 14, bottom: 16, left: 12, right: 12 }
/** Measure the summary at the real printable width — screen 1280px wraps nothing. */
const PRINTABLE_WIDTH_PX = Math.round((210 - PDF_MARGINS_MM.left - PDF_MARGINS_MM.right) * MM_TO_PX)
const PRINTABLE_HEIGHT_PX = Math.round(
  (297 - PDF_MARGINS_MM.top - PDF_MARGINS_MM.bottom) * MM_TO_PX,
)
/** Rounding slack of the mm→px conversion; content must still fit the page. */
const PAGE_ONE_TOLERANCE_PX = 8
const PAGE_ONE_BUDGET_PX = PRINTABLE_HEIGHT_PX - PAGE_ONE_TOLERANCE_PX

loadCliEnv()

const { flags } = parseEqualsFlags(process.argv.slice(2))
const snapshotPath = typeof flags.snapshot === 'string' ? flags.snapshot : null
const researchPath = typeof flags.research === 'string' ? flags.research : null
const emendasPath = typeof flags.emendas === 'string' ? flags.emendas : null
const outDir = typeof flags['out-dir'] === 'string' ? flags['out-dir'] : DEFAULT_OUT_DIR
const authorName = typeof flags.author === 'string' ? flags.author : DEFAULT_AUTHOR_NAME
const generatedAt =
  typeof flags['generated-at'] === 'string' ? new Date(flags['generated-at']) : new Date()

if (!snapshotPath || !researchPath) {
  die(
    'Uso: --snapshot=<json> --research=<json> [--emendas=<json>] [--out-dir=<dir>] [--author=<nome>]',
  )
}
if (Number.isNaN(generatedAt.getTime())) die(`--generated-at inválida: ${flags['generated-at']}`)

const readJson = async (relativePath, label) => {
  try {
    return JSON.parse(await readFile(resolve(ROOT, relativePath), 'utf8'))
  } catch (error) {
    die(
      `Falha ao ler ${label} (${relativePath}): ${error instanceof Error ? error.message : error}`,
    )
  }
}

const snapshot = await readJson(snapshotPath, 'snapshot')
const research = normalizeResearchInput(await readJson(researchPath, 'pesquisa'), {
  now: generatedAt,
})

const currentCodeSha = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()
  } catch {
    return null
  }
})()
if (snapshot.meta?.codeSha && currentCodeSha && snapshot.meta.codeSha !== currentCodeSha) {
  console.warn(
    `[${LABEL}] AVISO: snapshot extraído no SHA ${snapshot.meta.codeSha}, builder no ${currentCodeSha} — ` +
      'o par deve ser o mesmo; regenere o snapshot se o extrator mudou.',
  )
}

if (snapshot.municipality?.slug !== research.municipalitySlug) {
  die(
    `Pesquisa de "${research.municipalitySlug}" não corresponde ao snapshot de "${snapshot.municipality?.slug}" — pare e regenere.`,
  )
}

const baseName = `${snapshot.municipality.slug}-${generatedAt.toISOString().slice(0, 10)}`
const cachePath = join(CACHE_DIR, `${baseName}.emendas.json`)

const resolveEmendas = async () => {
  if (emendasPath) return readJson(emendasPath, 'emendas')
  try {
    const cached = JSON.parse(await readFile(resolve(ROOT, cachePath), 'utf8'))
    console.log(`[${LABEL}] emendas: cache ${cachePath}`)
    return cached
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      die(
        `Cache de emendas ilegível (${cachePath}): ${error instanceof Error ? error.message : error}`,
      )
    }
  }
  const result = await fetchAuthorEmendas({
    years: EMENDAS_YEARS,
    municipalityCode: snapshot.municipality.ibgeCode,
    municipalityName: snapshot.municipality.name,
    authorName,
    apiKey: process.env.PORTAL_TRANSPARENCIA_API_KEY ?? null,
    consultedAt: generatedAt.toISOString(),
  })
  await mkdir(resolve(ROOT, CACHE_DIR), { recursive: true })
  await writeFile(resolve(ROOT, cachePath), `${JSON.stringify(result, null, 2)}\n`)
  console.log(
    `[${LABEL}] emendas: ${result.status}${result.status === 'gap' ? ` (${result.reason})` : ` (${result.rows.length} registros)`} → ${cachePath}`,
  )
  return result
}

const emendas = await resolveEmendas()

const pdfFile = join(outDir, `${baseName}.pdf`)

/**
 * Renders both artifacts for a given fit fallback. Page 1 never cuts with "…":
 * pass 1 prints the researcher's `summary` (or the full answer); if it does not
 * fit the one-page guard, pass 2 re-renders with `textFallback: 'pointer'` and
 * the lines without a `summary` point to the deep dive (which keeps the
 * integral). The guard stays fail-closed if even the pointer does not fit.
 */
const buildArtifacts = (textFallback) => {
  const report = buildCityReport({ snapshot, research, emendas, generatedAt, textFallback })
  return { report, html: renderReportHtml(report), markdown: renderReportMd(report) }
}
let artifacts = buildArtifacts('full')

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setViewportSize({ width: PRINTABLE_WIDTH_PX, height: PRINTABLE_HEIGHT_PX })

  const measureSummary = async () => {
    await page.setContent(artifacts.html, { waitUntil: 'load' })
    await page.emulateMedia({ media: 'print' })
    return page.evaluate(() => {
      const element = document.querySelector('[data-page="summary"]')
      return element ? element.scrollHeight : null
    })
  }

  let summaryScrollHeight = await measureSummary()
  if (summaryScrollHeight === null) die('Bloco de resumo ausente no HTML — renderer quebrado.')
  if (summaryScrollHeight > PAGE_ONE_BUDGET_PX) {
    console.log(
      `[${LABEL}] página 1 com o texto integral não coube (${summaryScrollHeight}px) — ` +
        're-renderizando com ponteiro para o aprofundamento (sem "…").',
    )
    artifacts = buildArtifacts('pointer')
    summaryScrollHeight = await measureSummary()
    if (summaryScrollHeight === null) die('Bloco de resumo ausente no HTML — renderer quebrado.')
    if (summaryScrollHeight > PAGE_ONE_BUDGET_PX) {
      die(
        `A página 1 estourou até com o fallback de ponteiro (${summaryScrollHeight}px > ${PAGE_ONE_BUDGET_PX}px úteis). ` +
          'Encurte os "summary" da pesquisa ou os itens de lista — o resumo TEM de caber em uma página.',
      )
    }
  }

  await page.pdf({
    path: resolve(ROOT, pdfFile),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-family:'Fira Sans','DejaVu Sans',sans-serif;font-size:7pt;color:#a1a1aa;padding:0 12mm;display:flex;justify-content:space-between;">
      <span>${artifacts.report.meta.title} · ${snapshot.municipality.name} · documento interno de campanha</span>
      <span>pág. <span class="pageNumber"></span>/<span class="totalPages"></span></span>
    </div>`,
    margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
  })
} finally {
  await browser.close()
}

const { html, markdown } = artifacts

const htmlPath = join(CACHE_DIR, `${baseName}.html`)
await mkdir(resolve(ROOT, CACHE_DIR), { recursive: true })
await writeFile(resolve(ROOT, htmlPath), html)
console.log(`[${LABEL}] HTML intermediário → ${htmlPath}`)

await mkdir(resolve(ROOT, outDir), { recursive: true })
const mdFile = join(outDir, `${baseName}.md`)
await writeFile(resolve(ROOT, mdFile), markdown)
console.log(`[${LABEL}] companion → ${mdFile}`)

console.log(`[${LABEL}] PDF → ${pdfFile}`)
console.log(
  `[${LABEL}] ${snapshot.municipality.name}: 2022=${snapshot.electoral.rank2022?.votes ?? 'sem dado'} ` +
    `rank=${snapshot.electoral.rank2022?.rank ?? '—'} emendas=${emendas.status} ` +
    `lacunas_pesquisa=${research.gaps.length} html_bytes=${Buffer.byteLength(html)}`,
)

if (isTruthyEnv(process.env.CITY_REPORT_STRICT) && research.gaps.length > 0) {
  die(
    `CITY_REPORT_STRICT=1 e ${research.gaps.length} lacuna(s) de pesquisa — o relatório saiu, mas o modo estrito falha.`,
  )
}

process.exit(0)
