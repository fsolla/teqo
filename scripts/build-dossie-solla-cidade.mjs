/**
 * Dossiê + boletim builder (C186): snapshot + per-era research (+ emendas,
 * Câmara, IBGE) → dossiê PDF A4 + `.md` and the one-page boletim PDF.
 *
 * Runs on the workstation: no database access, no persistence. Public sources
 * are read at generation time (or replayed via `--emendas=<json>`). One browser
 * run produces both PDFs, each with its own page-fit guard.
 *
 * Usage:
 *   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-cidade.mjs \
 *     --snapshot=data/dossie-solla-cidade/<slug>.snapshot.json \
 *     --research-dir=data/dossie-solla-cidade \
 *     --out-dir=docs/research/dossie-solla-cidade
 */

import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { dieWithLabel, isTruthyEnv, loadCliEnv, parseEqualsFlags } from './lib/cli.mjs'
import { buildDossierReport } from './lib/dossieBlocks.mjs'
import { buildBulletin } from './lib/dossieBulletin.mjs'
import { renderBulletinHtml } from './lib/dossieBulletinRender.mjs'
import { CAMARA_DEFAULT_FROM, fetchCamaraActivity } from './lib/dossieCamara.mjs'
import { DOSSIER_ERA_IDS } from './lib/dossieCareer.mjs'
import { fetchHealthData } from './lib/dossieHealthData.mjs'
import { renderDossierHtml, renderDossierMd } from './lib/dossieRender.mjs'
import { mergeDossierResearch, normalizeDossierResearchInput } from './lib/dossieResearch.mjs'
import { DEFAULT_AUTHOR_NAME, fetchAuthorEmendas } from './lib/portalTransparenciaEmendas.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-dossie-solla-cidade'
const die = dieWithLabel(LABEL)
const DEFAULT_OUT_DIR = 'docs/research/dossie-solla-cidade'
const CACHE_DIR = 'data/dossie-solla-cidade'
/** The whole federal mandate, not just the C163 default window. */
const DOSSIER_EMENDAS_YEARS = Array.from({ length: 12 }, (_value, index) => 2015 + index)

const MM_TO_PX = 96 / 25.4
const A4_HEIGHT_PX = Math.round(297 * MM_TO_PX)
const A4_WIDTH_PX = Math.round(210 * MM_TO_PX)
/** Rounding slack of the mm→px conversion; content must still fit the page. */
const PAGE_FIT_TOLERANCE_PX = 10
const PAGE_BUDGET_PX = A4_HEIGHT_PX + PAGE_FIT_TOLERANCE_PX

loadCliEnv()

const { flags } = parseEqualsFlags(process.argv.slice(2))
const snapshotPath = typeof flags.snapshot === 'string' ? flags.snapshot : null
const researchDir = typeof flags['research-dir'] === 'string' ? flags['research-dir'] : CACHE_DIR
const emendasPath = typeof flags.emendas === 'string' ? flags.emendas : null
const outDir = typeof flags['out-dir'] === 'string' ? flags['out-dir'] : DEFAULT_OUT_DIR
const authorName = typeof flags.author === 'string' ? flags.author : DEFAULT_AUTHOR_NAME
const generatedAt =
  typeof flags['generated-at'] === 'string' ? new Date(flags['generated-at']) : new Date()

if (!snapshotPath) {
  die(
    'Uso: --snapshot=<json> [--research-dir=<dir>] [--emendas=<json>] [--out-dir=<dir>] [--author=<nome>]',
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
const slug = snapshot.municipality?.slug
if (!slug) die('Snapshot sem "municipality.slug" — extração inválida.')

const readEraResearch = async (era) => {
  const path = join(researchDir, `${slug}.${era.toLowerCase()}.research.json`)
  const assertMatches = (research) => {
    if (research.municipalitySlug !== slug) {
      die(
        `Pesquisa da Era ${era} é de "${research.municipalitySlug}", não de "${slug}" (${path}) — pare e regenere.`,
      )
    }
    if (research.era !== era) {
      die(`Pesquisa em ${path} declara Era ${research.era}, não Era ${era} — pare e regenere.`)
    }
    return research
  }
  try {
    const raw = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    return assertMatches(normalizeDossierResearchInput(raw))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(`[${LABEL}] Era ${era}: sem pesquisa (${path}) — vira lacuna explícita.`)
      return normalizeDossierResearchInput({
        municipalitySlug: slug,
        era,
        researchedAt: generatedAt.toISOString(),
        items: [],
      })
    }
    die(
      `Pesquisa da Era ${era} inválida (${path}): ${error instanceof Error ? error.message : error}`,
    )
  }
}

const researches = []
for (const era of DOSSIER_ERA_IDS) researches.push(await readEraResearch(era))
const research = mergeDossierResearch(researches)

const currentCodeSha = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()
  } catch {
    return null
  }
})()
if (snapshot.meta?.codeSha && currentCodeSha && snapshot.meta.codeSha !== currentCodeSha) {
  console.warn(
    `[${LABEL}] AVISO: snapshot extraído no SHA ${snapshot.meta.codeSha}, builder no ${currentCodeSha} — regenere se o extrator mudou.`,
  )
}

const baseName = `${slug}-${generatedAt.toISOString().slice(0, 10)}`
const emendasCachePath = join(CACHE_DIR, `${baseName}.emendas.json`)

const resolveEmendas = async () => {
  if (emendasPath) return readJson(emendasPath, 'emendas')
  try {
    const cached = JSON.parse(await readFile(resolve(ROOT, emendasCachePath), 'utf8'))
    console.log(`[${LABEL}] emendas: cache ${emendasCachePath}`)
    return cached
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      die(
        `Cache de emendas ilegível (${emendasCachePath}): ${error instanceof Error ? error.message : error}`,
      )
    }
  }
  const result = await fetchAuthorEmendas({
    years: DOSSIER_EMENDAS_YEARS,
    municipalityCode: snapshot.municipality.ibgeCode,
    municipalityName: snapshot.municipality.name,
    authorName,
    apiKey: process.env.PORTAL_TRANSPARENCIA_API_KEY ?? null,
    consultedAt: generatedAt.toISOString(),
  })
  await mkdir(resolve(ROOT, CACHE_DIR), { recursive: true })
  await writeFile(resolve(ROOT, emendasCachePath), `${JSON.stringify(result, null, 2)}\n`)
  console.log(
    `[${LABEL}] emendas: ${result.status}${result.status === 'gap' ? ` (${result.reason})` : ` (${result.rows.length} registros)`} → ${emendasCachePath}`,
  )
  return result
}

const [emendas, camara, health] = await Promise.all([
  resolveEmendas(),
  fetchCamaraActivity({
    from: CAMARA_DEFAULT_FROM,
    to: generatedAt.toISOString().slice(0, 10),
  }),
  fetchHealthData({ ibgeCode: snapshot.municipality.ibgeCode ?? null, now: generatedAt }),
])
console.log(
  `[${LABEL}] câmara=${camara.status} ibge=${health.status} lacunas_pesquisa=${research.gaps.length}`,
)

const report = buildDossierReport({ snapshot, research, emendas, camara, health, generatedAt })
const bulletin = buildBulletin({
  facts: report.bulletinFacts,
  municipality: snapshot.municipality.name,
  region: snapshot.municipality.region ?? null,
  generatedAt,
})

const dossierHtml = renderDossierHtml(report)
const dossierMd = renderDossierMd(report)
const bulletinHtml = renderBulletinHtml(bulletin)

await mkdir(resolve(ROOT, CACHE_DIR), { recursive: true })
await writeFile(resolve(ROOT, join(CACHE_DIR, `${baseName}.dossie.html`)), dossierHtml)
await writeFile(resolve(ROOT, join(CACHE_DIR, `${baseName}.boletim.html`)), bulletinHtml)

await mkdir(resolve(ROOT, outDir), { recursive: true })
const dossierMdFile = join(outDir, `${baseName}-dossie.md`)
const dossierPdfFile = join(outDir, `${baseName}-dossie.pdf`)
const bulletinPdfFile = join(outDir, `${baseName}-boletim.pdf`)
await writeFile(resolve(ROOT, dossierMdFile), dossierMd)
console.log(`[${LABEL}] companion → ${dossierMdFile}`)

const measureOverflows = async (page, budget) =>
  page.evaluate(
    (max) =>
      [...document.querySelectorAll('[data-page]')]
        .map((element) => ({
          page: element.getAttribute('data-page'),
          height: element.scrollHeight,
        }))
        .filter((row) => row.height > max),
    budget,
  )

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setViewportSize({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX })

  await page.setContent(dossierHtml, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  const hasSummary = await page.evaluate(() =>
    Boolean(document.querySelector('[data-page="resumo"]')),
  )
  if (!hasSummary) die('Página de resumo ausente no HTML do dossiê — renderer quebrado.')
  const dossierOverflows = await measureOverflows(page, PAGE_BUDGET_PX)
  if (dossierOverflows.length > 0) {
    die(
      `Página(s) do dossiê estouraram o A4 (${dossierOverflows
        .map((row) => `${row.page}: ${row.height}px`)
        .join(', ')} > ${PAGE_BUDGET_PX}px úteis). ` +
        'Corte copy/caps — nenhuma página pode ser cortada pelo overflow.',
    )
  }
  await page.pdf({
    path: resolve(ROOT, dossierPdfFile),
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  })

  await page.setContent(bulletinHtml, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  const hasBulletin = await page.evaluate(() =>
    Boolean(document.querySelector('[data-page="boletim"]')),
  )
  if (!hasBulletin) die('Bloco do boletim ausente no HTML — renderer quebrado.')
  const bulletinOverflows = await measureOverflows(page, PAGE_BUDGET_PX)
  if (bulletinOverflows.length > 0) {
    die(
      `O boletim estourou (${bulletinOverflows
        .map((row) => `${row.height}px`)
        .join(', ')} > ${PAGE_BUDGET_PX}px úteis). ` +
        'Corte itens/caps — o boletim TEM de caber em uma página.',
    )
  }
  await page.pdf({
    path: resolve(ROOT, bulletinPdfFile),
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  })
} finally {
  await browser.close()
}

console.log(`[${LABEL}] PDF → ${dossierPdfFile}`)
console.log(`[${LABEL}] boletim PDF → ${bulletinPdfFile}`)
console.log(
  `[${LABEL}] ${snapshot.municipality.name}: eras=${report.eras.length} entregas=${report.page1.deliveries.length} ` +
    `highlights=${bulletin.highlights.length} lacunas=${research.gaps.length} html_bytes=${Buffer.byteLength(dossierHtml)}`,
)

if (isTruthyEnv(process.env.DOSSIER_STRICT) && research.gaps.length > 0) {
  die(
    `DOSSIER_STRICT=1 e ${research.gaps.length} lacuna(s) de pesquisa — o dossiê saiu, mas o modo estrito falha.`,
  )
}

process.exit(0)
