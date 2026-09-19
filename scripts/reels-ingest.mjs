/**
 * `pnpm reels:ingest <diretório-do-pacote> [--apply]` — C195 ingest of a reel
 * package into the private library of `/campanha`.
 *
 * Runs on the homeserver maintenance image, where the production credentials
 * already live and the package arrives by rsync: the command writes through the
 * Payload Local API (never raw SQL, never a campaign credential on the
 * workstation). Dry-run is the default and validates everything — target,
 * package, S3 — without writing; `--apply` additionally requires the explicit
 * intent flag REELS_INGEST_CONFIRM=1 and refuses a database that does not match
 * the declared TEQO_ENV (fail-closed pair).
 *
 * Runbook (staging first, then production): docs/ops/teqo-1313-deploy.md.
 */
import { getPayload } from 'payload'

import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'
import {
  REELS_INGEST_CONFIRM_FLAG,
  assertReelIngestApplyConfirm,
  assertReelIngestTarget,
  parseReelIngestArgs,
  readReelPackage,
} from './lib/reel-ingest.mjs'

import { REEL_PACKAGE_TRANSCRIPT_FILENAME } from '../src/lib/reel.ts'
import { resolveS3StorageEnv } from '../src/utilities/mediaStorage.ts'
import {
  findReelBySourceHash,
  ingestReelPackage,
} from '../src/utilities/reels/reelPackageIngest.ts'

loadCliEnv()

const die = dieWithLabel('reels:ingest')

let args
try {
  args = parseReelIngestArgs()
} catch (error) {
  die(error.message)
}

try {
  assertReelIngestApplyConfirm({ apply: args.apply })
} catch (error) {
  die(error.message)
}

let target
try {
  target = assertReelIngestTarget()
} catch (error) {
  die(error.message)
}

let storage
try {
  storage = resolveS3StorageEnv(process.env)
} catch (error) {
  die(error.message)
}
if (target.environment !== 'test' && !storage.enabled) {
  die(
    `sem S3_* completo no alvo ${target.environment} — a ingestão é uma operação do bucket privado de produção.\n` +
      '  O container de manutenção gravaria num disco efêmero; configure as 4 S3_* no env file do ambiente.',
  )
}

let reelPackage
try {
  reelPackage = await readReelPackage(args.directory)
} catch (error) {
  die(error.message)
}

const mode = args.apply ? 'apply' : 'dry-run'
console.log(
  [
    '\n[reels:ingest] Alvo da execução:',
    `  TEQO_ENV : ${target.environment}`,
    `  DB       : ${target.databaseName}`,
    `  Bucket   : ${storage.enabled ? storage.bucket : '(storage local de teste)'}`,
    `  Modo     : ${mode}`,
  ].join('\n'),
)

const payload = await getPayload({ config: (await import('../src/payload.config.ts')).default })
const existing = await findReelBySourceHash(payload, reelPackage.metadata.shotListHash)

console.log(
  [
    `[reels:ingest] Pacote   : ${reelPackage.directory}`,
    `  Título   : ${reelPackage.metadata.title}`,
    `  Feature  : ${reelPackage.metadata.feature}`,
    `  Hash     : ${reelPackage.metadata.shotListHash}`,
    `  Operação : ${
      existing === null
        ? 'cria uma nova entrada (publicada)'
        : `atualiza o reel #${existing.id} (status atual: ${existing.status})`
    }`,
  ].join('\n'),
)

for (const artifact of reelPackage.artifacts) {
  // A missing required artifact never reaches the echo: readReelPackage refuses
  // the package first.
  const action = artifact.present ? `→ ${artifact.kind}` : 'ausente (opcional)'
  console.log(`[reels:ingest]   ${artifact.filename.padEnd(16)} ${action}`)
}
console.log(
  `[reels:ingest]   ${REEL_PACKAGE_TRANSCRIPT_FILENAME.padEnd(16)} ${
    reelPackage.transcriptPath === null ? 'ausente (opcional)' : '→ transcript'
  }`,
)

if (!args.apply) {
  console.log(
    `\n[reels:ingest] dry-run OK — nenhuma escrita. Para aplicar: ${REELS_INGEST_CONFIRM_FLAG}=1 pnpm reels:ingest ${args.directory} --apply`,
  )
  process.exit(0)
}

let result
try {
  result = await ingestReelPackage(payload, reelPackage)
} catch (error) {
  die(
    `a escrita falhou (nada parcial ficou visível — a transação foi revertida): ${error?.message ?? String(error)}`,
  )
}
console.log(
  `\n[reels:ingest] ${result.operation === 'created' ? 'criado' : 'atualizado'} o reel #${result.reelId} — a biblioteca já reflete o pacote.`,
)
process.exit(0)
