/**
 * Briefing de capacitação builder (C210): snapshot + per-era research + the
 * authored `<slug>.briefing.json` → one internal A4 PDF (fixed four sheets) and
 * the `.md` companion.
 *
 * Runs on the workstation, offline: no database access, no official-source
 * fetch — the briefing derives from the dossiê JSONs already researched, and
 * every anchor must resolve in the `bulletinFacts` ledger (facts with source).
 * The four-page cap is a hard guard: on overflow the lowest-priority lists shed
 * by priority (declared on the sheet, complete in the `.md`), never silently.
 *
 * Usage:
 *   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-briefing.mjs \
 *     --unit=municipality \
 *     --snapshot=data/dossie-solla-cidade/<slug>.snapshot.json \
 *     --research-dir=data/dossie-solla-cidade \
 *     --out-dir=docs/research/dossie-solla-cidade
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BRIEFING_ANCHORS,
  BRIEFING_PAGE_TOTAL,
  normalizeBriefingContent,
  trimBriefing,
} from './lib/briefingContent.mjs'
import { briefingSubjectName, renderBriefingHtml, renderBriefingMd } from './lib/briefingRender.mjs'
import { emitHtmlSinglePdf, launchPdfBrowser } from './lib/buildPdf.mjs'
import { dieWithLabel, parseEqualsFlags } from './lib/cli.mjs'
import { buildDossierReport } from './lib/dossieBlocks.mjs'
import { DOSSIER_ERA_IDS } from './lib/dossieCareer.mjs'
import { mergeDossierResearch, normalizeDossierResearchInput } from './lib/dossieResearch.mjs'
import { resolveDossierUnit } from './lib/dossieUnit.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-dossie-solla-briefing'
const die = dieWithLabel(LABEL)

const { flags } = parseEqualsFlags(process.argv.slice(2))
const unitId = typeof flags.unit === 'string' ? flags.unit : 'municipality'
let unit
try {
  unit = resolveDossierUnit(unitId)
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
}
const snapshotPath = typeof flags.snapshot === 'string' ? flags.snapshot : null
const researchDir =
  typeof flags['research-dir'] === 'string' ? flags['research-dir'] : unit.researchDir
const outDir = typeof flags['out-dir'] === 'string' ? flags['out-dir'] : unit.outDir
const generatedAt =
  typeof flags['generated-at'] === 'string' ? new Date(flags['generated-at']) : new Date()

if (!snapshotPath) {
  die(
    'Uso: --snapshot=<json> [--unit=municipality|institution|theme] [--research-dir=<dir>] [--out-dir=<dir>] [--generated-at=<ISO>]',
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
const slug = snapshot[unit.snapshotField]?.slug
if (!slug) die(`Snapshot sem "${unit.snapshotField}.slug" — extração inválida.`)

const readEraResearch = async (era) => {
  const path = join(researchDir, `${slug}.${era.toLowerCase()}.research.json`)
  try {
    const raw = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    if (raw[unit.slugField] !== slug) {
      die(
        `Pesquisa da Era ${era} é de "${raw[unit.slugField]}", não de "${slug}" (${path}) — pare e regenere.`,
      )
    }
    if (raw.era !== era) {
      die(`Pesquisa em ${path} declara Era ${raw.era}, não Era ${era} — pare e regenere.`)
    }
    return normalizeDossierResearchInput(raw, { unit })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(`[${LABEL}] Era ${era}: sem pesquisa (${path}) — vira lacuna explícita.`)
      return normalizeDossierResearchInput(
        { [unit.slugField]: slug, era, researchedAt: generatedAt.toISOString(), items: [] },
        { unit },
      )
    }
    die(
      `Pesquisa da Era ${era} inválida (${path}): ${error instanceof Error ? error.message : error}`,
    )
  }
}

const researches = []
for (const era of DOSSIER_ERA_IDS) researches.push(await readEraResearch(era))
const research = mergeDossierResearch(researches, { unit })

const report = buildDossierReport({ snapshot, research, generatedAt, unit })
const facts = report.bulletinFacts
const sourcedFactIds = new Set(
  facts.filter((fact) => Boolean(fact.sourceUrl) && !fact.sourcePanel).map((fact) => fact.id),
)

const readBriefing = async () => {
  const path = join(researchDir, `${slug}.briefing.json`)
  try {
    return JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      die(
        `Briefing autoral ausente (${path}) — rode a etapa de redação da skill briefing-capacitacao-solla e tente de novo.`,
      )
    }
    die(`Briefing inválido (${path}): ${error instanceof Error ? error.message : error}`)
  }
}

const rawBriefing = await readBriefing()
const content = normalizeBriefingContent(rawBriefing, { unit, slug, facts })
for (const warning of content.warnings) console.warn(`[${LABEL}] AVISO: ${warning}`)

const baseName = `${slug}-${generatedAt.toISOString().slice(0, 10)}`
const briefingPdfFile = join(outDir, `${baseName}-briefing.pdf`)
const briefingMdFile = join(outDir, `${baseName}-briefing.md`)
const htmlCacheFile = join(researchDir, `${baseName}.briefing.html`)

const briefingMd = renderBriefingMd(content, { unit, report })

let printContent = content
let briefingHtml = renderBriefingHtml(printContent, { unit, report })
const browser = await launchPdfBrowser()
try {
  await emitHtmlSinglePdf(browser, {
    html: briefingHtml,
    pdf: resolve(ROOT, briefingPdfFile),
    maxPages: BRIEFING_PAGE_TOTAL,
    requiredAnchors: BRIEFING_ANCHORS,
    label: 'O briefing',
    // Four fixed sheets: on overflow the lowest-priority list sheds one item
    // per pass (qa → defesas → conferir → evitar) until it fits; the remainder
    // stays counted on the sheet and complete in the `.md`.
    onOverflow: () => {
      const trimmed = trimBriefing(printContent)
      if (!trimmed) return null
      printContent = trimmed
      briefingHtml = renderBriefingHtml(printContent, { unit, report })
      return briefingHtml
    },
  })
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

await mkdir(resolve(ROOT, researchDir), { recursive: true })
await writeFile(resolve(ROOT, htmlCacheFile), briefingHtml)

await mkdir(resolve(ROOT, outDir), { recursive: true })
await writeFile(resolve(ROOT, briefingMdFile), briefingMd)
console.log(`[${LABEL}] companion → ${briefingMdFile}`)
console.log(`[${LABEL}] PDF → ${briefingPdfFile}`)

const shedTotal = Object.values(printContent.shed).reduce((total, count) => total + count, 0)
console.log(
  `[${LABEL}] ${briefingSubjectName(report, content)}: fatos_com_fonte=${sourcedFactIds.size} ` +
    `essencial=${printContent.essential.length} qa=${printContent.qa.length} defesas=${printContent.defenses.length} ` +
    `folhas=${BRIEFING_PAGE_TOTAL} shed=${shedTotal} html_bytes=${Buffer.byteLength(briefingHtml)}`,
)
