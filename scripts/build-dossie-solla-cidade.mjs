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
import { CAMARA_DEFAULT_FROM, fetchCamaraActivity } from './lib/dossieCamara.mjs'
import { DOSSIER_ERA_IDS } from './lib/dossieCareer.mjs'
import { fetchHealthData } from './lib/dossieHealthData.mjs'
import { adjustPackPlan, packProbeSections } from './lib/dossiePack.mjs'
import { dossierPackAnchors, renderDossierHtml, renderDossierMd } from './lib/dossieRender.mjs'
import { mergeDossierResearch, normalizeDossierResearchInput } from './lib/dossieResearch.mjs'
import { DEFAULT_AUTHOR_NAME, fetchAuthorEmendas } from './lib/portalTransparenciaEmendas.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-dossie-solla-cidade'
const die = dieWithLabel(LABEL)
const DEFAULT_OUT_DIR = 'docs/research/dossie-solla-cidade'
const CACHE_DIR = 'data/dossie-solla-cidade'
/** The whole federal mandate, not just the C163 default window. */
const DOSSIER_EMENDAS_YEARS = Array.from({ length: 12 }, (_value, index) => 2015 + index)

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
const dossierPdfFile = join(outDir, `${baseName}-dossie.pdf`)
const bulletinPdfFile = join(outDir, `${baseName}-boletim.pdf`)
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

const readNarrative = async () => {
  const path = join(researchDir, `${slug}.narrative.json`)
  try {
    const raw = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    if (raw.municipalitySlug !== slug) {
      die(`Redação é de "${raw.municipalitySlug}", não de "${slug}" (${path}) — pare e regenere.`)
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

/**
 * Builds the dossiê + boletim for a given pack plan and fit fallback. The
 * flowing sections multiply sheets by measurement (`pack`), so nothing is
 * capped; if the resumo sheet overflows the A4 guard, the fallback re-renders
 * with the index without page numbers (`indexMode: 'labels'`) before failing
 * closed. The one-page boletim shrinks by printed facts (`printLimit`) and then
 * by defenses (`defenseLimit`) until it fits — never truncated.
 */
/** Set by the dossier fit fallback; reused by every later rebuild. */
let dossierIndexMode = 'pages'

const buildArtifacts = ({
  indexMode = dossierIndexMode,
  pack = null,
  probe = false,
  printLimit = null,
  defenseLimit = null,
} = {}) => {
  const report = buildDossierReport({
    snapshot,
    research,
    emendas,
    camara,
    health,
    generatedAt,
    narrative,
  })
  const bulletin = buildBulletin({
    facts: report.bulletinFacts,
    municipality: snapshot.municipality.name,
    region: snapshot.municipality.region ?? null,
    generatedAt,
    printLimit,
    ...(defenseLimit === null ? {} : { defenseLimit }),
  })
  return {
    report,
    bulletin,
    dossierHtml: renderDossierHtml(report, { pack, probe, indexMode }),
    dossierMd: renderDossierMd(report),
    bulletinHtml: renderBulletinHtml(bulletin),
  }
}

/**
 * Flowing sheets: probe the real height of every unit, pack the sections, then
 * re-render and measure — an overflowing sheet gives a row to the next chunk, a
 * sheet with room takes the next row, until the plan stops changing. Nothing is
 * capped and no page is left half empty; the final emit still guards the A4.
 */
const browser = await launchPdfBrowser()
let artifacts = buildArtifacts()
let pack = null
try {
  const probeArtifacts = buildArtifacts({ probe: true })
  const probe = await measureDocumentPackProbe(browser, probeArtifacts.dossierHtml)
  const anchors = Object.fromEntries(
    Object.entries(dossierPackAnchors(probeArtifacts.report.unit)).map(([anchor, key]) => [
      key,
      anchor,
    ]),
  )
  pack = packProbeSections(probe, A4_PAGE_BUDGET_PX)
  console.log(
    `[${LABEL}] probe: ${probe.map((section) => `${section.key}=${section.rows.length}`).join(' ')}`,
  )

  let settled = false
  const lockedAnchors = new Set()
  for (let attempt = 0; attempt < 16 && !settled; attempt += 1) {
    artifacts = buildArtifacts({ pack })
    const sheets = await measureDocumentSheets(browser, artifacts.dossierHtml)
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
  artifacts = buildArtifacts({ pack })
  console.log(
    `[${LABEL}] pack ${settled ? 'estável' : 'no teto de tentativas'}: ${Object.entries(pack)
      .map(([key, sizes]) => `${key}=${sizes.join('+')}`)
      .join(' ')}`,
  )

  await emitHtmlPairPdf(browser, {
    dossierHtml: artifacts.dossierHtml,
    bulletinHtml: artifacts.bulletinHtml,
    dossierPdf: resolve(ROOT, dossierPdfFile),
    bulletinPdf: resolve(ROOT, bulletinPdfFile),
    // Budget-gated fallback (C188/C209): if the resumo sheet with the full index
    // overflows, rebuild with the index without page numbers before failing
    // closed. The boletim shrinks its printed facts and then its defenses.
    onDossierOverflow: async () => {
      dossierIndexMode = 'labels'
      artifacts = buildArtifacts({ pack })
      return artifacts.dossierHtml
    },
    onBulletinOverflow: async () => {
      const next = nextBulletinFit(artifacts.bulletin)
      if (!next) return null
      artifacts = buildArtifacts({ pack, ...next })
      return artifacts.bulletinHtml
    },
    resumoOnly: true,
  })
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

const { report, bulletin, dossierHtml, dossierMd, bulletinHtml } = artifacts

await mkdir(resolve(ROOT, CACHE_DIR), { recursive: true })
await writeFile(resolve(ROOT, join(CACHE_DIR, `${baseName}.dossie.html`)), dossierHtml)
await writeFile(resolve(ROOT, join(CACHE_DIR, `${baseName}.boletim.html`)), bulletinHtml)

await mkdir(resolve(ROOT, outDir), { recursive: true })
const dossierMdFile = join(outDir, `${baseName}-dossie.md`)
await writeFile(resolve(ROOT, dossierMdFile), dossierMd)
console.log(`[${LABEL}] companion → ${dossierMdFile}`)

console.log(`[${LABEL}] PDF → ${dossierPdfFile}`)
console.log(`[${LABEL}] boletim PDF → ${bulletinPdfFile}`)
console.log(
  `[${LABEL}] ${snapshot.municipality.name}: eras=${report.eras.length} pontos=${report.synthesis.totals.items} defesas=${report.defends.positions.length} ` +
    `highlights=${bulletin.highlights.length} lacunas=${research.gaps.length} páginas=${report.meta.pageTotal} html_bytes=${Buffer.byteLength(dossierHtml)}`,
)

if (isTruthyEnv(process.env.DOSSIER_STRICT) && research.gaps.length > 0) {
  die(
    `DOSSIER_STRICT=1 e ${research.gaps.length} lacuna(s) de pesquisa — o dossiê saiu, mas o modo estrito falha.`,
  )
}

process.exit(0)
