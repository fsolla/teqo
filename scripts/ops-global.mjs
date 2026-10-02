/**
 * C247 — ops CLI to flip an operational public global outside the admin:
 *
 *   pnpm ops:global photoAlbum --selfie-search on
 *
 * Why this exists: the global's `afterChange` revalidates its `unstable_cache`
 * tag only inside the deployed Next process, so a CLI/DB write left the public
 * cache frozen and the ops had to click the admin to open/close the selfie
 * search (C242 friction). This CLI writes through the Local API and busts the
 * tag on the live server through the allowlisted `POST /api/revalidate`.
 *
 * Modes:
 *   (sem flag)                     plan/dry-run (default) — previous → new; no write
 *   --apply                        writes the single field and busts the tag;
 *                                  requires OPS_GLOBAL_CONFIRM=1 outside local
 *                                  dev and TEQO_ENV matching the exact database
 *   --verify                       rereads the flag; exit 1 when it diverges
 *
 * The write surface is the closed table in `scripts/lib/opsGlobal.mjs` — a
 * flag only becomes writable by editing it there. The receipt records the
 * previous/new value and the rollback (the same command with the previous
 * value); the endpoint secret never enters the receipt or the log.
 *
 * Runbook recipe: `docs/ops/teqo-1313-deploy.md` (C247).
 */
import { join } from 'node:path'

import { getPayload } from 'payload'

import { isArchivePhotoRemovalChannelUrl } from '../src/lib/archivePhotoCatalog.ts'
import { getGlobalCacheTag } from '../src/utilities/globals.ts'
import { resolveRevalidateTag } from '../src/utilities/revalidateRequest.ts'

import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
  writeRepoFile,
} from './lib/cli.mjs'
import {
  OPS_GLOBAL_DEFAULT_OUT_DIR,
  OPS_GLOBAL_WRITE_CONFIRM_FLAG,
  buildOpsGlobalWrite,
  formatOpsGlobalCommand,
  formatOpsGlobalOperations,
  formatOpsGlobalRecoveryCommand,
  formatOpsGlobalReport,
  opsGlobalReportStamp,
  parseOpsGlobalCliArgs,
} from './lib/opsGlobal.mjs'

loadCliEnv()

const die = dieWithLabel('ops:global')

const BUST_TIMEOUT_MS = 15_000

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm ops:global <global> --<flag> <on|off> [opções]

Liga/desliga uma flag operacional de global público pela CLI, gravando pelo
Local API e revalidando a tag no servidor vivo (sem restart e sem admin).

Modos:
  (sem flag)         plano/dry-run — valor anterior → novo; sem escrita
  --apply            grava e revalida (exige ${OPS_GLOBAL_WRITE_CONFIRM_FLAG}=1 fora do dev local)
  --verify           relê a flag; exit 1 se divergir do valor pedido

Operações (tabela fechada):
${formatOpsGlobalOperations().join('\n')}

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)
  NEXT_PUBLIC_SITE_URL / REVALIDATE_SECRET   exigidos no --apply (alvo da revalidação)

--apply em alvo não-local/produção exige ${OPS_GLOBAL_WRITE_CONFIRM_FLAG}=1 e TEQO_ENV=${envLines}
casando o banco exato. Plano e verify são read-only.
`

const writeReport = async (report) => {
  const stamp = opsGlobalReportStamp(report.runAt)
  const relativePath = join(OPS_GLOBAL_DEFAULT_OUT_DIR, 'reports', `ops-global-${stamp}.json`)
  await writeRepoFile({
    label: 'ops:global',
    root: process.cwd(),
    relativePath,
    body: JSON.stringify(report, null, 2),
  })
  return join(process.cwd(), relativePath)
}

/**
 * Bust the global's tag on the live server; a failure is returned, never
 * silent. The same shape as the Instagram import helper — except here the
 * caller fails the run on `ok: false`, because the bust is the outcome.
 */
const revalidateGlobalOnServer = async (tag) => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  const secret = process.env.REVALIDATE_SECRET?.trim()
  if (!baseUrl || !secret) {
    return { ok: false, tag, reason: 'NEXT_PUBLIC_SITE_URL/REVALIDATE_SECRET ausentes' }
  }

  try {
    const response = await fetch(`${baseUrl}/api/revalidate?tag=${encodeURIComponent(tag)}`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret },
      signal: AbortSignal.timeout(BUST_TIMEOUT_MS),
    })
    return response.ok
      ? { ok: true, tag, reason: null }
      : { ok: false, tag, reason: `HTTP ${response.status}` }
  } catch (error) {
    return {
      ok: false,
      tag,
      reason: error instanceof Error && error.message !== '' ? error.message : 'falha de rede',
    }
  }
}

const printReport = (report, reportPath) => {
  for (const line of formatOpsGlobalReport(report)) console.log(line)
  console.log(`\n[ops:global] recibo JSON: ${reportPath}`)
}

async function main() {
  const options = parseOpsGlobalCliArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')

  const target = databaseTarget()
  const tag = getGlobalCacheTag(options.slug)
  console.log(`[ops:global] alvo: ${target} | modo: ${options.mode}`)

  if (options.mode === 'apply') {
    assertWriteConfirm({
      label: 'ops:global',
      flag: OPS_GLOBAL_WRITE_CONFIRM_FLAG,
      command: formatOpsGlobalCommand(options.slug, options.operation, options.value),
    })
    assertEnvironmentDatabaseTarget()
    if (!process.env.NEXT_PUBLIC_SITE_URL?.trim() || !process.env.REVALIDATE_SECRET?.trim()) {
      die(
        'NEXT_PUBLIC_SITE_URL/REVALIDATE_SECRET ausentes — sem eles não há como revalidar a tag no servidor vivo. Rode no ambiente do alvo (env file do stack).',
      )
    }
    // Fail-closed BEFORE the write: a tag outside the endpoint allowlist would
    // only surface after the global had already changed.
    const allowed = resolveRevalidateTag(tag, null)
    if (!allowed.ok) {
      die(`tag "${tag}" fora da allowlist do /api/revalidate — ${allowed.error}.`)
    }
  }

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })
  const startedAt = Date.now()

  const currentDoc = await payload.findGlobal({
    slug: options.slug,
    depth: 0,
    // Intentional bypass: the ops CLI is a trusted operator with no session.
    overrideAccess: true,
  })

  const write = buildOpsGlobalWrite({
    slug: options.slug,
    operation: options.operation,
    value: options.value,
    currentDoc,
  })

  const baseReport = {
    runAt: new Date().toISOString(),
    mode: options.mode,
    target,
    slug: write.slug,
    operation: write.operation,
    field: write.field,
    previousValue: write.previousValue,
    newValue: write.newValue,
    changed: write.changed,
    rollbackCommand: write.rollbackCommand,
  }

  if (options.mode !== 'apply') {
    const report = {
      ...baseReport,
      write: 'none',
      revalidation: null,
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(report)
    printReport(report, reportPath)
    process.exit(options.mode === 'verify' && write.changed ? 1 : 0)
  }

  if (
    write.changed &&
    write.field === 'published' &&
    write.newValue === true &&
    !isArchivePhotoRemovalChannelUrl(currentDoc?.removalChannelUrl)
  ) {
    die(
      'canal de remoção não configurado no global Álbum de fotos — configure-o pelo admin antes de publicar (o hook fail-closed recusaria a escrita).',
    )
  }

  if (write.changed) {
    await payload.updateGlobal({
      slug: options.slug,
      data: write.data,
      depth: 0,
      // Intentional bypass: same trusted operator.
      overrideAccess: true,
    })
  }

  const revalidation = await revalidateGlobalOnServer(tag)
  const report = {
    ...baseReport,
    write: write.changed ? 'applied' : 'skipped',
    revalidation,
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(report)
  printReport(report, reportPath)

  if (!revalidation.ok) {
    die(
      `global ${write.changed ? 'atualizado' : 'já estava no valor pedido'}, mas a revalidação da tag falhou (${revalidation.reason}).\n` +
        `Recupere manualmente:\n  ${formatOpsGlobalRecoveryCommand({
          baseUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') ?? '',
          tag,
        })}\n` +
        `Rollback: ${write.rollbackCommand}\n` +
        `Recibo: ${reportPath}`,
    )
  }

  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
