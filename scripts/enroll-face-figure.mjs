/**
 * C244 — enrolls the reference descriptors of one curated public figure of the
 * album's "Pessoa pública" facet. Each `--image` is a portrait (official/archive
 * photo, curated by a human); the CLI prepares it exactly like the batch
 * (`prepareFaceImage`) and detects faces with the SAME face-api engine the
 * browser and `faces:index` use, so reference and archive vectors share one
 * space. The reference is refused unless the image yields EXACTLY one face
 * (crop the portrait); the descriptor never leaves the server, and no score is
 * ever produced.
 *
 * Modes:
 *   pnpm faces:enroll-figure …            plan/dry-run (default) — resolves the
 *                                         figure and the images; no engine, no write
 *   pnpm faces:enroll-figure … --apply    detects and writes the references;
 *                                         requires FACE_FIGURE_CONFIRM=1 outside
 *                                         local dev and the declared TEQO_ENV
 *
 * Options: --figure <slug> --name "Nome" (required to create) [--full-name]
 * [--source "Origem"] --image <path> (repeatable) [--replace] [--out <dir>]
 * [--help]. The facet only lights up after the runbook's bust of the
 * `archivePhotos` tag (the CLI runs outside Next).
 */
import { stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { getPayload } from 'payload'

import { FACE_SEARCH_MODEL, readFaceVector } from '../src/lib/faceSearch.ts'

import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
  writeRepoFile,
} from './lib/cli.mjs'
import { createNodeFaceEngine } from './lib/faceEngine.mjs'
import {
  FACE_FIGURE_DEFAULT_OUT_DIR,
  faceFigureReportStamp,
  formatEnrollFigureReport,
  parseEnrollFigureArgs,
} from './lib/faceFigurePlan.mjs'

loadCliEnv()

const die = dieWithLabel('faces:enroll-figure')

const WRITE_CONFIRM_FLAG = 'FACE_FIGURE_CONFIRM'

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm faces:enroll-figure --figure <slug> [opções]

Enrola os descritores de referência de uma figura pública curada do filtro
"Pessoa pública" do álbum (C244). Cada --image precisa ter EXATAMENTE um rosto
(retrato oficial/arquivo); o descriptor nunca sai do servidor.

Opções:
  --figure <slug>    slug da figura (valor de ?pessoa=<slug>)
  --name "Nome"      nome público; obrigatório quando a figura ainda não existe
  --full-name "…"    proveniência (não aparece no site)
  --source "Origem"  origem das imagens (default: retrato: <arquivo>)
  --image <arquivo>  retrato a enrolar (repetível; 1–3 por figura)
  --replace          substitui as referências existentes pelas novas
  --apply            grava (sem a flag é plano/dry-run, sem engine)
  --out <dir>        diretório dos recibos (default ${FACE_FIGURE_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1 e TEQO_ENV=${envLines}
casando o banco exato. Ao final, buste a tag archivePhotos:
  POST /api/revalidate?tag=archivePhotos (x-revalidate-secret)
`

const findFigure = (payload, slug) =>
  payload.find({
    collection: 'faceFigure',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

const writeReport = async (options, report) => {
  const stamp = faceFigureReportStamp(report.runAt)
  const relativePath = join(options.out, 'reports', `face-figure-${stamp}.json`)
  await writeRepoFile({
    label: 'faces:enroll-figure',
    root: process.cwd(),
    relativePath,
    body: JSON.stringify(report, null, 2),
  })
  return join(process.cwd(), relativePath)
}

const ensureImagesExist = async (images) => {
  for (const image of images) {
    try {
      const info = await stat(image)
      if (!info.isFile()) throw new Error('não é um arquivo')
    } catch (error) {
      die(`imagem inacessível "${image}": ${error?.message || error}`)
    }
  }
}

async function main() {
  const options = parseEnrollFigureArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }
  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')

  const mode = options.apply ? 'apply' : 'plan'
  const runAt = new Date().toISOString()
  const startedAt = Date.now()
  console.log(`[faces:enroll-figure] alvo: ${databaseTarget()} | modo: ${mode}`)

  if (options.apply) {
    assertWriteConfirm({
      label: 'faces:enroll-figure',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm faces:enroll-figure --figure <slug> --image <arquivo> --apply',
    })
    assertEnvironmentDatabaseTarget()
  }

  await ensureImagesExist(options.images)

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })

  const existingResult = await findFigure(payload, options.figure)
  const existing = existingResult.docs[0] ?? null
  if (!existing && !options.name) {
    die(`figura "${options.figure}" não existe; informe --name para criá-la.`)
  }

  const referencesBefore = existing?.references?.length ?? 0
  const action = existing ? 'atualizar' : 'criar'

  if (!options.apply) {
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      model: FACE_SEARCH_MODEL,
      figure: options.figure,
      action,
      referencesBefore,
      referencesAfter: referencesBefore,
      images: options.images.map((image) => basename(image)),
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatEnrollFigureReport(report)) console.log(line)
    console.log(`\n[faces:enroll-figure] recibo JSON: ${reportPath}`)
    console.log('[faces:enroll-figure] dry-run — use --apply para gravar.')
    process.exit(0)
  }

  const { prepareFaceImage } = await import('../src/utilities/faceIndex/faceDescriptorIndex.ts')
  const engine = await createNodeFaceEngine(process.cwd()).catch((error) => {
    die(error?.message || String(error))
  })

  const added = []
  for (const image of options.images) {
    const prepared = await prepareFaceImage(image)
    const descriptors = await engine.detectPixels(prepared)
    if (descriptors.length !== 1) {
      die(
        `"${image}": ${descriptors.length} rosto(s) detectado(s); a referência exige exatamente 1 (recorte o retrato e tente de novo).`,
      )
    }
    const vector = readFaceVector(descriptors[0])
    if (!vector) die(`"${image}": descriptor inválido.`)
    added.push({
      vector,
      model: FACE_SEARCH_MODEL,
      source: options.source ?? `retrato: ${basename(image)}`,
      addedAt: new Date().toISOString(),
    })
  }

  const current = options.replace ? [] : (existing?.references ?? [])
  const seen = new Set(current.map((reference) => JSON.stringify(reference.vector)))
  const additions = []
  for (const reference of added) {
    const key = JSON.stringify(reference.vector)
    if (seen.has(key)) continue
    seen.add(key)
    additions.push(reference)
  }
  const references = [...current, ...additions]

  if (existing) {
    await payload.update({
      collection: 'faceFigure',
      id: existing.id,
      data: {
        ...(options.name ? { name: options.name } : {}),
        ...(options.fullName ? { fullName: options.fullName } : {}),
        references,
      },
      depth: 0,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'faceFigure',
      data: {
        name: options.name,
        slug: options.figure,
        ...(options.fullName ? { fullName: options.fullName } : {}),
        active: true,
        references,
      },
      depth: 0,
      overrideAccess: true,
    })
  }

  const report = {
    runAt,
    mode,
    target: databaseTarget(),
    model: FACE_SEARCH_MODEL,
    figure: options.figure,
    action,
    referencesBefore,
    referencesAfter: references.length,
    added: additions.length,
    images: options.images.map((image) => basename(image)),
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatEnrollFigureReport(report)) console.log(line)
  console.log(`\n[faces:enroll-figure] recibo JSON: ${reportPath}`)
  console.log(
    '[faces:enroll-figure] OK — buste a tag archivePhotos para a faceta refletir as referências.',
  )
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
