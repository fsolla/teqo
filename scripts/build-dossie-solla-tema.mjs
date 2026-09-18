/**
 * Dossiê + boletim builder (C190, theme/area unit): theme snapshot + per-era
 * research → dossiê PDF A4 + `.md` and the one-page boletim PDF.
 *
 * Runs on the workstation: no database access, no persistence. Official
 * sources are NOT fetched here — the Transparency Portal and the Câmara do not
 * filter by area, so area-attributed emendas/proposições come from the per-era
 * research items (with phase + source); anything unattributed becomes an
 * explicit gap, never a silent zero.
 *
 * Usage:
 *   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-tema.mjs \
 *     --snapshot=data/dossie-solla-tema/educacao.theme.snapshot.json \
 *     --research-dir=data/dossie-solla-tema \
 *     --out-dir=docs/research/dossie-solla-tema
 */

import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  A4_PAGE_BUDGET_PX,
  emitHtmlPairPdf,
  launchPdfBrowser,
  measureDocumentPackProbe,
  measureDocumentSheets,
} from './lib/buildPdf.mjs'
import { dieWithLabel, isTruthyEnv, loadCliEnv, parseEqualsFlags } from './lib/cli.mjs'
import { buildDossierReport } from './lib/dossieBlocks.mjs'
import { buildBulletin } from './lib/dossieBulletin.mjs'
import { renderBulletinHtml } from './lib/dossieBulletinRender.mjs'
import { DOSSIER_ERA_IDS } from './lib/dossieCareer.mjs'
import { adjustPackPlan, packProbeSections } from './lib/dossiePack.mjs'
import { dossierPackAnchors, renderDossierHtml, renderDossierMd } from './lib/dossieRender.mjs'
import { mergeDossierResearch, normalizeDossierResearchInput } from './lib/dossieResearch.mjs'
import { THEME_UNIT } from './lib/dossieUnit.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-dossie-solla-tema'
const die = dieWithLabel(LABEL)
const DEFAULT_OUT_DIR = 'docs/research/dossie-solla-tema'
const CACHE_DIR = 'data/dossie-solla-tema'

loadCliEnv()

const { flags } = parseEqualsFlags(process.argv.slice(2))
const snapshotPath = typeof flags.snapshot === 'string' ? flags.snapshot : null
const researchDir = typeof flags['research-dir'] === 'string' ? flags['research-dir'] : CACHE_DIR
const outDir = typeof flags['out-dir'] === 'string' ? flags['out-dir'] : DEFAULT_OUT_DIR
const generatedAt =
  typeof flags['generated-at'] === 'string' ? new Date(flags['generated-at']) : new Date()

if (!snapshotPath) {
  die('Uso: --snapshot=<json> [--research-dir=<dir>] [--out-dir=<dir>] [--generated-at=<ISO>]')
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
const slug = snapshot.theme?.slug
if (!slug) die('Snapshot sem "theme.slug" — extração inválida.')

const readEraResearch = async (era) => {
  const path = join(researchDir, `${slug}.${era.toLowerCase()}.research.json`)
  try {
    const raw = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    if (raw.themeSlug !== slug) {
      die(
        `Pesquisa da Era ${era} é de "${raw.themeSlug}", não de "${slug}" (${path}) — pare e regenere.`,
      )
    }
    if (raw.era !== era) {
      die(`Pesquisa em ${path} declara Era ${raw.era}, não Era ${era} — pare e regenere.`)
    }
    return normalizeDossierResearchInput(raw, { unit: THEME_UNIT })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(`[${LABEL}] Era ${era}: sem pesquisa (${path}) — vira lacuna explícita.`)
      return normalizeDossierResearchInput(
        {
          themeSlug: slug,
          era,
          researchedAt: generatedAt.toISOString(),
          items: [],
        },
        { unit: THEME_UNIT },
      )
    }
    die(
      `Pesquisa da Era ${era} inválida (${path}): ${error instanceof Error ? error.message : error}`,
    )
  }
}

const researches = []
for (const era of DOSSIER_ERA_IDS) researches.push(await readEraResearch(era))
const research = mergeDossierResearch(researches, { unit: THEME_UNIT })

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

const readNarrative = async () => {
  const path = join(researchDir, `${slug}.narrative.json`)
  try {
    const raw = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    if (raw.themeSlug !== slug) {
      die(`Redação é de "${raw.themeSlug}", não de "${slug}" (${path}) — pare e regenere.`)
    }
    return raw
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    die(`Redação inválida (${path}): ${error instanceof Error ? error.message : error}`)
  }
}

const narrative = await readNarrative()
if (!narrative) {
  console.log(
    `[${LABEL}] sem redação autoral (${slug}.narrative.json) — a abertura repete os números.`,
  )
}

const report = buildDossierReport({
  snapshot,
  research,
  generatedAt,
  unit: THEME_UNIT,
  narrative,
})
const bulletin = buildBulletin({
  facts: report.bulletinFacts,
  identity: {
    name: report.meta.subjectName,
    badges: report.meta.identityBadges,
    value: report.meta.identity?.value ?? null,
    taxonomyNote: report.meta.identity?.taxonomyNote ?? null,
  },
  unit: THEME_UNIT,
  generatedAt,
})

const dossierMd = renderDossierMd(report)
const bulletinHtml = renderBulletinHtml(bulletin)

const baseName = `${slug}-${generatedAt.toISOString().slice(0, 10)}`

await mkdir(resolve(ROOT, CACHE_DIR), { recursive: true })
await writeFile(resolve(ROOT, join(CACHE_DIR, `${baseName}.boletim.html`)), bulletinHtml)

await mkdir(resolve(ROOT, outDir), { recursive: true })
const dossierMdFile = join(outDir, `${baseName}-dossie.md`)
const dossierPdfFile = join(outDir, `${baseName}-dossie.pdf`)
const bulletinPdfFile = join(outDir, `${baseName}-boletim.pdf`)
await writeFile(resolve(ROOT, dossierMdFile), dossierMd)
console.log(`[${LABEL}] companion → ${dossierMdFile}`)

/**
 * Flowing sheets: probe the real height of every unit, pack the sections, then
 * re-render and measure — an overflowing sheet gives a row to the next chunk, a
 * sheet with room takes the next row, until the plan stops changing. Nothing is
 * capped and no page is left half empty; the final emit still guards the A4.
 */
const browser = await launchPdfBrowser()
let dossierHtml = null
let pack = null
try {
  const probe = await measureDocumentPackProbe(browser, renderDossierHtml(report, { probe: true }))
  const anchors = Object.fromEntries(
    Object.entries(dossierPackAnchors(THEME_UNIT)).map(([anchor, key]) => [key, anchor]),
  )
  pack = packProbeSections(probe, A4_PAGE_BUDGET_PX)
  console.log(
    `[${LABEL}] probe: ${probe.map((section) => `${section.key}=${section.rows.length}`).join(' ')}`,
  )

  let settled = false
  const lockedAnchors = new Set()
  for (let attempt = 0; attempt < 16 && !settled; attempt += 1) {
    dossierHtml = renderDossierHtml(report, { pack })
    const sheets = await measureDocumentSheets(browser, dossierHtml)
    for (const sheet of sheets) {
      if (sheet.height > A4_PAGE_BUDGET_PX) lockedAnchors.add(sheet.page)
    }
    const adjusted = adjustPackPlan({
      plan: pack,
      probe,
      sheets,
      anchors,
      budgetPx: A4_PAGE_BUDGET_PX,
      lockedAnchors,
    })
    if (!adjusted) {
      settled = true
      break
    }
    pack = adjusted
  }
  if (!dossierHtml) dossierHtml = renderDossierHtml(report, { pack })
  console.log(
    `[${LABEL}] pack ${settled ? 'estável' : 'no teto de tentativas'}: ${Object.entries(pack)
      .map(([key, sizes]) => `${key}=${sizes.join('+')}`)
      .join(' ')}`,
  )

  await writeFile(resolve(ROOT, join(CACHE_DIR, `${baseName}.dossie.html`)), dossierHtml)
  await emitHtmlPairPdf(browser, {
    dossierHtml,
    bulletinHtml,
    dossierPdf: resolve(ROOT, dossierPdfFile),
    bulletinPdf: resolve(ROOT, bulletinPdfFile),
  })
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

console.log(`[${LABEL}] PDF → ${dossierPdfFile}`)
console.log(`[${LABEL}] boletim PDF → ${bulletinPdfFile}`)
console.log(
  `[${LABEL}] ${report.meta.subjectName}: eras=${report.eras.length} entregas=${report.page1.deliveries.items.length} ` +
    `highlights=${bulletin.highlights.length} lacunas=${research.gaps.length} páginas=${report.meta.pageTotal} html_bytes=${Buffer.byteLength(dossierHtml)}`,
)

if (isTruthyEnv(process.env.DOSSIER_STRICT) && research.gaps.length > 0) {
  die(
    `DOSSIER_STRICT=1 e ${research.gaps.length} lacuna(s) de pesquisa — o dossiê saiu, mas o modo estrito falha.`,
  )
}
