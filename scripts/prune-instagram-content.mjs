/**
 * C230-followup — hard-deletes from the Central de Conteúdos the pieces whose
 * original Instagram post is BEFORE a civil cutoff: the off-period rows leave
 * the catalogue (row + private media) so a later import/publish run can never
 * surface them again. The cutoff (`--before`, required) is a Bahia civil date
 * and the post dates come from the official feed; this is the irreversible
 * sibling of `content:instagram:withdraw` (which only unpublishes). A piece the
 * feed cannot date is NEVER touched, only named — deleting on an unknown date
 * would risk a campaign-period piece.
 *
 * Modes:
 *   pnpm content:instagram:prune --before 2026-08-16
 *     plan/dry-run (default): reads the feed and the DB, lists and writes nothing
 *   pnpm content:instagram:prune --before 2026-08-16 --apply
 *     deletes; needs CONTENT_INSTAGRAM_PRUNE_CONFIRM=1 on a non-local target and
 *     the declared TEQO_ENV matching the exact database name
 *
 * Options: --scan-days <n> (feed walk depth to date the catalogue rows, default
 * 365), --out <dir> (receipts, default `data/content-instagram`), --help.
 *
 * Runbook: on the homeserver, inside the compose maintenance service with the
 * stack env file — see docs/ops/teqo-1313-deploy.md.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { getPayload } from 'payload'

import { CONTENT_MEDIA_SLUG } from '../src/lib/contentPiece.ts'
import { contentPieceFrameFilename } from '../src/lib/contentPieceFrame.ts'
import {
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
} from './lib/cli.mjs'
import {
  loadInstagramContentWindowFeed,
  revalidateInstagramContentCentral,
} from './lib/instagramContentCli.mjs'
import {
  formatInstagramContentPruneReport,
  instagramContentReportStamp,
  parseInstagramContentPruneCliArgs,
  planInstagramContentPrune,
} from './lib/instagramContentPlan.mjs'

loadCliEnv()

const die = dieWithLabel('content:instagram:prune')

const WRITE_CONFIRM_FLAG = 'CONTENT_INSTAGRAM_PRUNE_CONFIRM'

const HELP = `Uso: pnpm content:instagram:prune --before YYYY-MM-DD [opções]

APAGA (hard delete, irreversível) da Central as peças cujo post original no
Instagram é ANTERIOR à data de corte — rascunhos e publicadas. A linha e a
mídia privada saem do catálogo, então uma importação futura não as recria nem
as publica. Peça que o feed oficial não consegue datar nunca é tocada (seria
risco de apagar peça de campanha) e aparece nomeada no recibo. Sem --apply, é um
plano read-only.

Opções:
  --before <data>  corte civil na Bahia (obrigatório; posts anteriores saem)
  --scan-days <n>  profundidade da varredura do feed para datar as peças
                   (default 365; 1..365)
  --apply          executa o expurgo (exige ${WRITE_CONFIRM_FLAG}=1 em alvo
                   não-local)
  --out <dir>      recibos JSON (default data/content-instagram)
  --help           esta ajuda

Flags: TEQO_ENV=staging|production (obrigatória no --apply fora de teste; o nome
do banco tem de casar) e ${WRITE_CONFIRM_FLAG}=1 para a escrita.
`

const writeReport = async (options, report, suffix = '') => {
  const stamp = instagramContentReportStamp(report.runAt)
  const reportPath = join(options.out, `${stamp}${suffix}.json`)
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return reportPath
}

const reportLines = (report) =>
  formatInstagramContentPruneReport({
    target: report.target,
    mode: report.mode,
    before: report.before,
    scanDays: report.scanDays,
    feedCount: report.feed.count,
    piecesCount: report.piecesCount,
    plan: report.plan,
    deleted: report.deleted,
    failures: report.failures,
    revalidation: report.revalidation,
    reportPath: report.reportPath,
  })

/**
 * Deletes the piece row, then its private media and the C226 frame (a separate
 * `contentMedia` row under a deterministic filename), both best-effort after the
 * row is gone — the same order and tolerance as the C222 delete action, without
 * an actor. Returns whether the deleted piece was published, so the caller only
 * busts the public Central when the delete could have changed it.
 *
 * @param {import('payload').Payload} payload
 * @param {{ id: number, status?: string | null }} entry
 */
const deleteContentPieceSystem = async (payload, entry) => {
  const deleted = await payload.delete({
    collection: 'contentPiece',
    id: entry.id,
    depth: 0,
    select: { media: true },
    // Intentional admin bypass: the ops prune owns the rows it listed.
    overrideAccess: true,
  })

  const mediaId = typeof deleted.media === 'number' ? deleted.media : (deleted.media?.id ?? null)
  if (mediaId !== null) {
    await payload
      .delete({
        collection: CONTENT_MEDIA_SLUG,
        id: mediaId,
        // Intentional admin bypass: cleanup of the file that belonged to the
        // piece this run was told to prune.
        overrideAccess: true,
      })
      .catch(() => undefined)
  }

  const frame = await payload
    .find({
      collection: CONTENT_MEDIA_SLUG,
      where: { filename: { equals: contentPieceFrameFilename(entry.id) } },
      limit: 1,
      depth: 0,
      // Intentional admin bypass: the derived-file probe, same as C226.
      overrideAccess: true,
    })
    .catch(() => null)
  const frameId = frame?.docs?.[0]?.id ?? null
  if (frameId !== null) {
    await payload
      .delete({ collection: CONTENT_MEDIA_SLUG, id: frameId, overrideAccess: true })
      .catch(() => undefined)
  }

  return entry.status === 'publicado'
}

async function main() {
  let options
  try {
    options = parseInstagramContentPruneCliArgs()
  } catch (error) {
    die(error instanceof Error ? error.message : String(error))
  }
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')
  const mode = options.apply ? 'apply' : 'plan'

  if (mode === 'apply') {
    assertWriteConfirm({
      label: 'content:instagram:prune',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm content:instagram:prune --before <data> --apply',
    })
    assertEnvironmentDatabaseTarget()
  }

  console.log(
    `[content:instagram:prune] alvo: ${databaseTarget()} | modo: ${mode} | corte: ${options.before} (Bahia)`,
  )

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })

  const window = await loadInstagramContentWindowFeed({ payload, days: options.scanDays })
  if ('error' in window) {
    die(
      window.error === 'unavailable'
        ? 'Instagram ainda não configurado (token/ID ausentes ou feed desligado no global Social Feed) — o expurgo precisa das datas oficiais do feed.'
        : 'não foi possível ler o feed oficial do Instagram agora (API ou credencial) — tente novamente.',
    )
  }
  const { feed } = window

  const pieces = await payload.find({
    collection: 'contentPiece',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { title: true, sourceUrl: true, status: true },
    // Intentional admin bypass: the ops run must see every catalogue row,
    // including drafts no actor could read.
    overrideAccess: true,
  })

  const plan = planInstagramContentPrune({
    pieces: pieces.docs,
    posts: feed.posts,
    before: options.before,
  })

  const runAt = new Date().toISOString()
  const report = {
    runAt,
    mode,
    target: databaseTarget(),
    before: options.before,
    scanDays: options.scanDays,
    cutoffIso: plan.cutoffIso,
    feed: { username: feed.username, count: feed.posts.length },
    piecesCount: pieces.docs.length,
    plan,
    reportPath: null,
  }

  if (mode === 'plan') {
    report.reportPath = await writeReport(options, report)
    for (const line of reportLines(report)) console.log(line)
    console.log(
      `\n[content:instagram:prune] plano sem escrita — para apagar: --apply com ${WRITE_CONFIRM_FLAG}=1 (e TEQO_ENV).`,
    )
    process.exit(0)
  }

  const startedAt = Date.now()
  let deleted = 0
  let deletedPublished = 0
  const failures = []
  for (const entry of plan.toDelete) {
    try {
      if (await deleteContentPieceSystem(payload, entry)) deletedPublished += 1
      deleted += 1
      if (deleted % 25 === 0) console.log(`[content:instagram:prune] ${deleted}…`)
    } catch (error) {
      failures.push({
        id: entry.id,
        reason: error instanceof Error && error.message !== '' ? error.message : 'falha',
      })
    }
  }

  let revalidation = { attempted: false, ok: false, reason: null }
  if (deletedPublished > 0) revalidation = await revalidateInstagramContentCentral()

  report.deleted = deleted
  report.deletedPublished = deletedPublished
  report.failures = failures
  report.revalidation = revalidation
  report.durationMs = Date.now() - startedAt
  report.reportPath = await writeReport(options, report, '-prune')

  for (const line of reportLines(report)) console.log(line)
  console.log(`\n[content:instagram:prune] recibo JSON: ${report.reportPath}`)

  if (deleted === 0 && plan.toDelete.length > 0) {
    die('nenhuma peça foi apagada — veja o recibo.')
  }
  process.exit(0)
}

main().catch((error) => {
  die(error instanceof Error && error.message !== '' ? error.message : 'falha inesperada.')
})
