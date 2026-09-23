/**
 * Dossiê + boletim builder (C187, institution unit): institution snapshot +
 * per-era research → dossiê PDF A4 + `.md` and the one-page boletim PDF.
 *
 * Runs on the workstation: no database access, no persistence. Official
 * sources are NOT fetched here — the Transparency Portal does not filter by
 * institution and the Câmara does not either, so institutional emendas and
 * propositions come from the per-era research items (with phase + source);
 * anything unattributed becomes an explicit gap, never a silent zero.
 *
 * Usage:
 *   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-instituicao.mjs \
 *     --snapshot=data/dossie-solla-instituicao/<slug>.institution.snapshot.json \
 *     --research-dir=data/dossie-solla-instituicao \
 *     --out-dir=docs/research/dossie-solla-instituicao
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
import { buildBulletin, nextBulletinFit } from './lib/dossieBulletin.mjs'
import { renderBulletinHtml } from './lib/dossieBulletinRender.mjs'
import { DOSSIER_ERA_IDS } from './lib/dossieCareer.mjs'
import { adjustPackPlan, packProbeSections } from './lib/dossiePack.mjs'
import {
  INSTITUTION_PACK_ANCHORS,
  renderDossierHtml,
  renderDossierMd,
} from './lib/dossieRender.mjs'
import { mergeDossierResearch, normalizeDossierResearchInput } from './lib/dossieResearch.mjs'
import { INSTITUTION_UNIT } from './lib/dossieUnit.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-dossie-solla-instituicao'
const die = dieWithLabel(LABEL)
const DEFAULT_OUT_DIR = 'docs/research/dossie-solla-instituicao'
const CACHE_DIR = 'data/dossie-solla-instituicao'

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
const slug = snapshot.institution?.slug
if (!slug) die('Snapshot sem "institution.slug" — extração inválida.')

const readEraResearch = async (era) => {
  const path = join(researchDir, `${slug}.${era.toLowerCase()}.research.json`)
  try {
    const raw = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    if (raw.institutionSlug !== slug) {
      die(
        `Pesquisa da Era ${era} é de "${raw.institutionSlug}", não de "${slug}" (${path}) — pare e regenere.`,
      )
    }
    if (raw.era !== era) {
      die(`Pesquisa em ${path} declara Era ${raw.era}, não Era ${era} — pare e regenere.`)
    }
    return normalizeDossierResearchInput(raw, { unit: INSTITUTION_UNIT })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(`[${LABEL}] Era ${era}: sem pesquisa (${path}) — vira lacuna explícita.`)
      return normalizeDossierResearchInput(
        {
          institutionSlug: slug,
          era,
          researchedAt: generatedAt.toISOString(),
          items: [],
        },
        { unit: INSTITUTION_UNIT },
      )
    }
    die(
      `Pesquisa da Era ${era} inválida (${path}): ${error instanceof Error ? error.message : error}`,
    )
  }
}

const researches = []
for (const era of DOSSIER_ERA_IDS) researches.push(await readEraResearch(era))
const research = mergeDossierResearch(researches, { unit: INSTITUTION_UNIT })

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
    if (raw.institutionSlug !== slug) {
      die(`Redação é de "${raw.institutionSlug}", não de "${slug}" (${path}) — pare e regenere.`)
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
  unit: INSTITUTION_UNIT,
  narrative,
})
const buildInstitutionBulletin = ({ printLimit = null, defenseLimit = null } = {}) =>
  buildBulletin({
    facts: report.bulletinFacts,
    identity: { name: report.meta.subjectName, badges: report.meta.identityBadges },
    unit: INSTITUTION_UNIT,
    generatedAt,
    printLimit,
    ...(defenseLimit === null ? {} : { defenseLimit }),
  })

let bulletin = buildInstitutionBulletin()
let bulletinHtml = renderBulletinHtml(bulletin)

const dossierMd = renderDossierMd(report)

const baseName = `${slug}-${generatedAt.toISOString().slice(0, 10)}`

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
    Object.entries(INSTITUTION_PACK_ANCHORS).map(([anchor, key]) => [key, anchor]),
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

  await emitHtmlPairPdf(browser, {
    dossierHtml,
    bulletinHtml,
    dossierPdf: resolve(ROOT, dossierPdfFile),
    bulletinPdf: resolve(ROOT, bulletinPdfFile),
    // C209: same fit fallbacks as the other builders — index without page
    // numbers for the dossiê, fewer printed facts/defenses for the boletim.
    onDossierOverflow: async () => {
      dossierHtml = renderDossierHtml(report, { pack, indexMode: 'labels' })
      return dossierHtml
    },
    onBulletinOverflow: async () => {
      const next = nextBulletinFit(bulletin)
      if (!next) return null
      bulletin = buildInstitutionBulletin(next)
      bulletinHtml = renderBulletinHtml(bulletin)
      return bulletinHtml
    },
  })
  // The cache carries the final documents (after any fit fallback), not the first pass.
  await writeFile(resolve(ROOT, join(CACHE_DIR, `${baseName}.dossie.html`)), dossierHtml)
  await writeFile(resolve(ROOT, join(CACHE_DIR, `${baseName}.boletim.html`)), bulletinHtml)
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

console.log(`[${LABEL}] PDF → ${dossierPdfFile}`)
console.log(`[${LABEL}] boletim PDF → ${bulletinPdfFile}`)
console.log(
  `[${LABEL}] ${report.meta.subjectName}: eras=${report.eras.length} pontos=${report.synthesis.totals.items} defesas=${report.defends.positions.length} ` +
    `highlights=${bulletin.highlights.length} lacunas=${research.gaps.length} páginas=${report.meta.pageTotal} html_bytes=${Buffer.byteLength(dossierHtml)}`,
)

if (isTruthyEnv(process.env.DOSSIER_STRICT) && research.gaps.length > 0) {
  die(
    `DOSSIER_STRICT=1 e ${research.gaps.length} lacuna(s) de pesquisa — o dossiê saiu, mas o modo estrito falha.`,
  )
}
