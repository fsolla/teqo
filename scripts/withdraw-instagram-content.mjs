/**
 * C230-followup — withdraws from the public Central the pieces whose original
 * Instagram post is BEFORE a civil cutoff (the electoral campaign boundary in
 * 2026 is 16/08). The cutoff (`--before`, required) is a Bahia civil date, the
 * post dates come from the official feed and the action is the kill switch
 * (unpublish): slug, file and `publishedAt` are preserved and the receipt names
 * every piece. A published piece the feed cannot date is never touched, only
 * named. Re-executing converges — what is already a draft leaves the listing.
 *
 * Modes:
 *   pnpm content:instagram:withdraw --before 2026-08-16
 *     plan/dry-run (default): reads the feed and the DB, lists and writes nothing
 *   pnpm content:instagram:withdraw --before 2026-08-16 --apply
 *     withdraws; needs CONTENT_INSTAGRAM_WITHDRAW_CONFIRM=1 on a non-local
 *     target and the declared TEQO_ENV matching the exact database name
 *
 * Options: --scan-days <n> (feed walk depth to date the published pieces,
 * default 90), --out <dir> (receipts, default `data/content-instagram`), --help.
 *
 * Runbook: on the homeserver, inside the compose maintenance service with the
 * stack env file — see docs/ops/teqo-1313-deploy.md.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { getPayload } from 'payload'

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
  formatInstagramContentWithdrawReport,
  instagramContentReportStamp,
  parseInstagramContentWithdrawCliArgs,
  planInstagramContentWithdraw,
} from './lib/instagramContentPlan.mjs'

loadCliEnv()

const die = dieWithLabel('content:instagram:withdraw')

const WRITE_CONFIRM_FLAG = 'CONTENT_INSTAGRAM_WITHDRAW_CONFIRM'

const HELP = `Uso: pnpm content:instagram:withdraw --before YYYY-MM-DD [opções]

Retira da Central pública (despublica) as peças cujo post original no Instagram
é ANTERIOR à data de corte — o kill switch preserva slug, arquivo e publishedAt,
então a operação é reversível pela ficha. Sem --apply, é um plano read-only.

Opções:
  --before <data>  corte civil na Bahia (obrigatório; posts anteriores saem)
  --scan-days <n>  profundidade da varredura do feed para datar as peças
                   (default 90; 1..365)
  --apply          executa a retirada (exige ${WRITE_CONFIRM_FLAG}=1 em alvo
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
  formatInstagramContentWithdrawReport({
    target: report.target,
    mode: report.mode,
    before: report.before,
    scanDays: report.scanDays,
    feedCount: report.feed.count,
    publishedCount: report.publishedCount,
    plan: report.plan,
    withdrawn: report.withdrawn,
    failures: report.failures,
    revalidation: report.revalidation,
    reportPath: report.reportPath,
  })

async function main() {
  let options
  try {
    options = parseInstagramContentWithdrawCliArgs()
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
      label: 'content:instagram:withdraw',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm content:instagram:withdraw --before <data> --apply',
    })
    assertEnvironmentDatabaseTarget()
  }

  console.log(
    `[content:instagram:withdraw] alvo: ${databaseTarget()} | modo: ${mode} | corte: ${options.before} (Bahia)`,
  )

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })

  const window = await loadInstagramContentWindowFeed({ payload, days: options.scanDays })
  if ('error' in window) {
    die(
      window.error === 'unavailable'
        ? 'Instagram ainda não configurado (token/ID ausentes ou feed desligado no global Social Feed) — a retirada precisa das datas oficiais do feed.'
        : 'não foi possível ler o feed oficial do Instagram agora (API ou credencial) — tente novamente.',
    )
  }
  const { feed } = window

  const published = await payload.find({
    collection: 'contentPiece',
    where: { status: { equals: 'publicado' } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { title: true, sourceUrl: true },
    // Intentional admin bypass: the ops run must see every published row.
    overrideAccess: true,
  })

  const plan = planInstagramContentWithdraw({
    pieces: published.docs,
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
    publishedCount: published.docs.length,
    plan,
    reportPath: null,
  }

  if (mode === 'plan') {
    report.reportPath = await writeReport(options, report)
    for (const line of reportLines(report)) console.log(line)
    console.log(
      `\n[content:instagram:withdraw] plano sem escrita — para retirar: --apply com ${WRITE_CONFIRM_FLAG}=1 (e TEQO_ENV).`,
    )
    process.exit(0)
  }

  const startedAt = Date.now()
  let withdrawn = 0
  const failures = []
  for (const entry of plan.toWithdraw) {
    try {
      await payload.update({
        collection: 'contentPiece',
        id: entry.id,
        data: { status: 'rascunho' },
        depth: 0,
        // Intentional admin bypass: the ops run retires what it listed.
        overrideAccess: true,
      })
      withdrawn += 1
      if (withdrawn % 25 === 0) console.log(`[content:instagram:withdraw] ${withdrawn}…`)
    } catch (error) {
      failures.push({
        id: entry.id,
        reason: error instanceof Error && error.message !== '' ? error.message : 'falha',
      })
    }
  }

  let revalidation = { attempted: false, ok: false, reason: null }
  if (withdrawn > 0) revalidation = await revalidateInstagramContentCentral()

  report.withdrawn = withdrawn
  report.failures = failures
  report.revalidation = revalidation
  report.durationMs = Date.now() - startedAt
  report.reportPath = await writeReport(options, report, '-withdraw')

  for (const line of reportLines(report)) console.log(line)
  console.log(`\n[content:instagram:withdraw] recibo JSON: ${report.reportPath}`)

  if (withdrawn === 0 && plan.toWithdraw.length > 0) {
    die('nenhuma peça foi retirada — veja o recibo.')
  }
  process.exit(0)
}

main().catch((error) => {
  die(error instanceof Error && error.message !== '' ? error.message : 'falha inesperada.')
})
