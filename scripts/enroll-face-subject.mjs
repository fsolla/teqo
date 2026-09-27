/**
 * C234 — enrolls one person in the selfie-search index (A/C scope of the gate,
 * PR #1370): the assessoria runs this WITH the person, after the signed
 * adherence consent, and the row is the only place a consented descriptor
 * exists. The selfie is read from disk, the descriptor is computed locally by
 * the same face-api nets the browser runs (only ONE face is accepted) and the
 * image is never stored or uploaded anywhere.
 *
 * Modes:
 *   pnpm faces:enroll --label "<nome>" --selfie <arquivo>
 *                                   plan/dry-run (default) — detects the face,
 *                                   resolves the consent and reports; no write
 *   pnpm faces:enroll ... --apply   writes the faceSubject row; requires
 *                                   FACE_ENROLL_CONFIRM=1 outside local dev and
 *                                   the declared TEQO_ENV matching the database
 *
 * Options: --subject <id> (re-enrollment: replaces the descriptor, advances
 * `enrolledAt` and clears the derived links), --out <dir> (receipts, default
 * `data/face`), --help.
 *
 * Guards: fails closed when the index Consent (stable key) is not configured,
 * when the selfie has 0 or more than 1 detectable face, and on a non-local
 * target without the intent flag + declared environment. The receipt never
 * carries the descriptor nor the image.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { getPayload } from 'payload'

import { FACE_INDEX_CONSENT_KEY } from '../src/lib/campaignConsentKeys.ts'
import { FACE_SEARCH_MODEL } from '../src/lib/faceSearch.ts'

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
  FACE_ENROLL_DEFAULT_OUT_DIR,
  faceEnrollReportStamp,
  formatFaceEnrollReport,
  parseFaceEnrollCliArgs,
} from './lib/faceEnrollPlan.mjs'

loadCliEnv()

const die = dieWithLabel('faces:enroll')

const WRITE_CONFIRM_FLAG = 'FACE_ENROLL_CONFIRM'

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm faces:enroll --label "<nome>" --selfie <arquivo> [opções]

Inscreve uma pessoa no índice da busca por selfie (/fotos/encontre). A selfie é
lida do disco e processada localmente (mesmos modelos do navegador): exatamente
1 rosto é exigido. O vetor fica no servidor; a imagem nunca é guardada.

Modos:
  (sem flag)         plano/dry-run — detecta o rosto e resolve o consentimento; sem escrita
  --apply            grava a pessoa no índice (exige ${WRITE_CONFIRM_FLAG}=1 fora do dev local)

Opções:
  --label <nome>     nome interno da pessoa (nunca aparece no site)
  --selfie <arquivo> foto com um único rosto
  --subject <id>     re-enrollment: substitui o vetor e limpa os vínculos derivados
  --out <dir>        diretório dos recibos (default ${FACE_ENROLL_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1 e TEQO_ENV=${envLines}
casando o banco exato. O consentimento de adesão (chave ${FACE_INDEX_CONSENT_KEY}) precisa
existir no admin; sem ele o fluxo falha fechado.
`

const writeReport = async (options, report, suffix = '') => {
  const stamp = faceEnrollReportStamp(report.runAt)
  const relativePath = join(options.out, 'reports', `face-enroll-${stamp}${suffix}.json`)
  const body = JSON.stringify(report, null, 2)
  await writeRepoFile({
    label: 'faces:enroll',
    root: process.cwd(),
    relativePath,
    body,
  })
  return join(process.cwd(), relativePath)
}

async function main() {
  const options = parseFaceEnrollCliArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')

  const mode = options.apply ? 'apply' : 'plan'
  const runAt = new Date().toISOString()
  const startedAt = Date.now()
  console.log(`[faces:enroll] alvo: ${databaseTarget()} | modo: ${mode}`)

  if (mode === 'apply') {
    assertWriteConfirm({
      label: 'faces:enroll',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm faces:enroll --label "<nome>" --selfie <arquivo> --apply',
    })
    assertEnvironmentDatabaseTarget()
  }

  try {
    // Readability probe only: the bytes are decoded by `prepareFaceImage`
    // below; this gives the operator a friendly refusal before the engine.
    await readFile(options.selfie)
  } catch (error) {
    die(`não foi possível ler a selfie ${options.selfie}: ${error?.message ?? error}`)
  }

  const engine = await createNodeFaceEngine(process.cwd()).catch((error) => {
    die(error.message)
  })

  const { prepareFaceImage } =
    await import('../src/utilities/faceSubjects/faceSubjectPhotoIndex.ts')
  let descriptors
  try {
    descriptors = await engine.detectPixels(await prepareFaceImage(options.selfie))
  } catch (error) {
    die(`engine falhou ao processar a selfie: ${error?.message ?? error}`)
  }

  const baseReport = {
    runAt,
    mode,
    target: databaseTarget(),
    model: FACE_SEARCH_MODEL,
    label: options.label.trim(),
    subjectId: options.subject,
    subjectAction: null,
    faceCount: descriptors.length,
    allowed: descriptors.length === 1,
    reason:
      descriptors.length === 1
        ? null
        : descriptors.length === 0
          ? 'nenhum rosto detectado — use uma selfie nítida, de frente e bem iluminada'
          : 'mais de um rosto na selfie — use uma foto com apenas uma pessoa',
    consentKey: FACE_INDEX_CONSENT_KEY,
    consentHash: null,
    durationMs: 0,
  }

  if (!baseReport.allowed) {
    const report = { ...baseReport, durationMs: Date.now() - startedAt }
    const reportPath = await writeReport(options, report)
    for (const line of formatFaceEnrollReport(report)) console.log(line)
    console.log(`\n[faces:enroll] recibo JSON: ${reportPath}`)
    die('enrollment recusado — detalhe no recibo acima.')
  }

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })
  const { getConsentByKey } = await import('../src/utilities/campaignConsent.ts')
  const consent = await getConsentByKey(payload, FACE_INDEX_CONSENT_KEY)
  if (!consent) {
    const report = { ...baseReport, durationMs: Date.now() - startedAt }
    await writeReport(options, report)
    for (const line of formatFaceEnrollReport(report)) console.log(line)
    die(
      `consentimento de adesão não configurado (chave ${FACE_INDEX_CONSENT_KEY}) — o fluxo falha fechado.`,
    )
  }

  const consentHash = consent.contentHash
  if (mode === 'plan') {
    const report = {
      ...baseReport,
      consentHash,
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatFaceEnrollReport(report)) console.log(line)
    console.log(`\n[faces:enroll] recibo JSON: ${reportPath}`)
    process.exit(0)
  }

  const { enrollFaceSubject } =
    await import('../src/utilities/faceSubjects/faceSubjectEnrollment.ts')
  const enrolled = await enrollFaceSubject({
    payload,
    label: baseReport.label,
    descriptor: descriptors[0],
    consent: { id: consent.id, contentHash: consentHash },
    subjectId: options.subject,
  })

  const report = {
    ...baseReport,
    subjectId: enrolled.id,
    subjectAction: enrolled.created ? 'created' : 'updated',
    consentHash,
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatFaceEnrollReport(report)) console.log(line)
  console.log(`\n[faces:enroll] recibo JSON: ${reportPath}`)
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
