/**
 * C230-followup — imports the official Instagram profile's recent media into
 * the Central de Conteúdos through the C220 pipeline: the feed comes from the
 * official Graph API of the OWN account (no scraping, no third-party media),
 * each novelty is created in the link shape and processed inline (download of
 * the profile's own file, transcription and automatic cataloguing). With
 * `--publish`, every piece the pipeline finished (`pronto`) goes public at the
 * end of the batch; a `falhou` piece stays a draft and is named in the receipt.
 * Re-running converges ("novas / já estavam / falharam com motivo") and never
 * duplicates — the identity is the post, not the URL spelling.
 *
 * Modes:
 *   pnpm content:instagram:import                 plan/dry-run (default):
 *                                                 reads the feed and the DB,
 *                                                 writes nothing
 *   pnpm content:instagram:import --apply         processes the window; needs
 *                                                 CONTENT_INSTAGRAM_IMPORT_CONFIRM=1
 *                                                 on a non-local target and the
 *                                                 complete S3_* set
 *   pnpm content:instagram:import --apply --publish
 *                                                 also publishes what this run
 *                                                 processed to `pronto`
 *   pnpm content:instagram:import --apply --publish-existing
 *                                                 also publishes the READY
 *                                                 DRAFTS already in the window
 *                                                 (e.g. a batch imported without
 *                                                 `--publish`), oldest post
 *                                                 first so the newest leads
 *
 * Options: --days <n> (default 60), --limit <n> (canary), --out <dir> (receipts,
 * default `data/content-instagram`), --help.
 *
 * Guards: --apply refuses a non-local/production target without the intent flag
 * (C155) and demands the declared TEQO_ENV matching the exact database name
 * (C195/C231); a remote target also demands the complete S3_* set, because the
 * job uploads the extracted media to the private bucket (without S3 the file
 * would land on the container's ephemeral disk). The Instagram credential lives
 * in the `social-feed-settings` global and never enters a log; without it the
 * run fails closed with the product message.
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
  mirroredMediaRequired,
} from './lib/cli.mjs'
import {
  findContentPieceSourceRows,
  loadInstagramContentWindowFeed,
  revalidateInstagramContentCentral,
} from './lib/instagramContentCli.mjs'
import {
  formatInstagramContentReport,
  instagramContentFeedIdentityUrls,
  instagramContentReportStamp,
  parseInstagramContentCliArgs,
  planInstagramContentDraftsToPublish,
  planInstagramContentWindow,
  shouldPublishImportedPiece,
  summarizeInstagramContentResults,
} from './lib/instagramContentPlan.mjs'

loadCliEnv()

const die = dieWithLabel('content:instagram:import')

const WRITE_CONFIRM_FLAG = 'CONTENT_INSTAGRAM_IMPORT_CONFIRM'

const HELP = `Uso: pnpm content:instagram:import [opções]

Importa as mídias recentes do perfil oficial (@depjorgesolla) para a Central de
Conteúdos pelo caminho oficial (Graph API da própria conta), processando cada
novidade pelo pipeline da peça (download do arquivo próprio, transcrição e
catalogação). Sem --apply, é um plano read-only (não baixa, não escreve).

Opções:
  --apply          processa o lote (exige ${WRITE_CONFIRM_FLAG}=1 em alvo
                   não-local e as 4 S3_*; o job grava a mídia no bucket privado)
  --publish        publica o que ESTA rodada terminar "pronto" (exige --apply);
                   falhas ficam como rascunho e são nomeadas no recibo
  --publish-existing
                   publica os rascunhos PRONTOS já na janela (inclui o que esta
                   rodada criou se --publish não foi usado), do post mais antigo
                   para o mais novo (exige --apply)
  --days <n>       janela em dias (default 60; 1..365)
  --limit <n>      canário: processa no máximo n candidatos (o resto fica no lote)
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

async function main() {
  let options
  try {
    options = parseInstagramContentCliArgs()
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
      label: 'content:instagram:import',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm content:instagram:import --apply',
    })
    const target = assertEnvironmentDatabaseTarget()
    const { resolveS3StorageEnv } = await import('../src/utilities/mediaStorage.ts')
    const storage = resolveS3StorageEnv(process.env)
    if (mirroredMediaRequired({ s3Enabled: storage.enabled })) {
      die(
        `escrita em produção/remoto (${target.environment}) exige mídia espelhada: configure S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY; sem elas a mídia iria para o disco efêmero do container.`,
      )
    }
  }

  console.log(
    `[content:instagram:import] alvo: ${databaseTarget()} | modo: ${mode} | janela: ${options.days} dias`,
  )

  const config = (await import('../src/payload.config.ts')).default
  const { createContentPieceFromProfilePost } =
    await import('../src/utilities/content/contentPieceProfileImport.ts')
  const { runContentPieceJob } = await import('../src/utilities/content/contentPieceJob.ts')
  const { DEEPINFRA_TRANSCRIBE_COST_PER_MINUTE_USD } =
    await import('../src/utilities/ai/deepInfraTranscribe.ts')
  const payload = await getPayload({ config })

  const window = await loadInstagramContentWindowFeed({ payload, days: options.days })
  if ('error' in window) {
    die(
      window.error === 'unavailable'
        ? 'Instagram ainda não configurado (token/ID ausentes ou feed desligado no global Social Feed) — a importação só roda pelo caminho oficial.'
        : 'não foi possível ler o feed oficial do Instagram agora (API ou credencial) — tente novamente.',
    )
  }
  const { feed, from, to } = window

  // One chunked `sourceUrl in` lookup covers every spelling of every feed post.
  const identityUrls = instagramContentFeedIdentityUrls(feed.posts)
  const catalogued = await findContentPieceSourceRows({
    payload,
    sourceUrls: identityUrls,
    select: { sourceUrl: true },
  })
  const existingSourceUrls = catalogued
    .map((doc) => doc.sourceUrl)
    .filter((sourceUrl) => typeof sourceUrl === 'string' && sourceUrl !== '')

  const plan = planInstagramContentWindow({
    posts: feed.posts,
    existingSourceUrls,
    from: from.toISOString(),
    to: to.toISOString(),
  })

  if (mode === 'plan') {
    const report = {
      runAt: new Date().toISOString(),
      mode,
      target: databaseTarget(),
      window: { days: options.days, from: from.toISOString(), to: to.toISOString() },
      feed: { username: feed.username, count: feed.posts.length },
      plan,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatInstagramContentReport({
      target: report.target,
      mode,
      window: report.window,
      feedCount: report.feed.count,
      plan,
    })) {
      console.log(line)
    }
    console.log(
      `\n[content:instagram:import] plano sem escrita — para importar: --apply [--publish] [--publish-existing]`,
    )
    console.log(`[content:instagram:import] recibo JSON: ${reportPath}`)
    process.exit(0)
  }

  const selected =
    options.limit === null ? plan.candidates : plan.candidates.slice(0, options.limit)
  const results = []
  const created = []
  const startedAt = Date.now()

  for (const [index, candidate] of selected.entries()) {
    const prefix = `[${index + 1}/${selected.length}] ${candidate.shortcode}`
    try {
      const { outcome, contentPieceId } = await createContentPieceFromProfilePost({
        payload,
        actor: null,
        url: candidate.url,
        // The CLI owns the processing: the job runs inline, not after a response.
        startJob: () => {},
      })

      if (outcome === 'existing' || contentPieceId === null) {
        results.push({
          ...candidate,
          contentPieceId: null,
          outcome: 'existing',
          processingStatus: null,
          linkFailureReason: null,
          durationSeconds: null,
          error: null,
          published: false,
        })
        console.log(`${prefix} — já estava na Central`)
        continue
      }

      await runContentPieceJob(payload, contentPieceId)
      const row = await payload.findByID({
        collection: 'contentPiece',
        id: contentPieceId,
        depth: 0,
        select: {
          processingStatus: true,
          linkFailureReason: true,
          durationSeconds: true,
          error: true,
        },
        // Intentional admin bypass: the pipeline owns the row it just wrote.
        overrideAccess: true,
      })
      const failed = row.processingStatus === 'falhou'
      results.push({
        ...candidate,
        contentPieceId,
        outcome: 'created',
        processingStatus: row.processingStatus,
        linkFailureReason: row.linkFailureReason ?? null,
        durationSeconds: row.durationSeconds ?? null,
        error: failed ? (row.error ?? 'falha no processamento') : null,
        published: false,
      })
      if (!failed) created.push({ contentPieceId, processingStatus: row.processingStatus })
      console.log(
        `${prefix} — ${row.processingStatus}${row.linkFailureReason ? ` (peça-link: ${row.linkFailureReason})` : ''}`,
      )
    } catch (error) {
      const message =
        error instanceof Error && error.message !== '' ? error.message : 'falha inesperada'
      results.push({
        ...candidate,
        contentPieceId: null,
        outcome: 'failed',
        processingStatus: 'falhou',
        linkFailureReason: null,
        durationSeconds: null,
        error: message,
        published: false,
      })
      console.log(`${prefix} — falhou: ${message}`)
    }
  }

  const publishedInWindow = new Set()
  let publishedExisting = 0
  let publishFailures = 0
  const extraFailures = []

  if (options.publishExisting && identityUrls.length > 0) {
    const drafts = await findContentPieceSourceRows({
      payload,
      sourceUrls: identityUrls,
      where: [{ status: { equals: 'rascunho' } }, { processingStatus: { equals: 'pronto' } }],
      select: { title: true, sourceUrl: true, linkFailureReason: true },
    })
    const planned = planInstagramContentDraftsToPublish({ pieces: drafts, posts: feed.posts })

    // Oldest post first so the newest carries the latest `publishedAt` (the
    // public listing sorts by `-publishedAt`). This phase runs BEFORE the
    // run's own `--publish` so a combined run keeps that order.
    for (const piece of planned.ordered) {
      try {
        await payload.update({
          collection: 'contentPiece',
          id: piece.id,
          data: { status: 'publicado' },
          depth: 0,
          // Intentional admin bypass: the ops run publishes what it listed.
          overrideAccess: true,
        })
        publishedExisting += 1
        publishedInWindow.add(piece.id)
        if (publishedExisting % 50 === 0) {
          console.log(
            `[content:instagram:import] publicando rascunhos da janela: ${publishedExisting}…`,
          )
        }
      } catch (error) {
        publishFailures += 1
        const message =
          error instanceof Error && error.message !== '' ? error.message : 'falha inesperada'
        extraFailures.push({ shortcode: `#${piece.id}`, error: `publicação: ${message}` })
      }
    }
    for (const piece of planned.undateable) {
      console.log(
        `[content:instagram:import] sem data no feed — não publicada: #${piece.id} ${piece.title ?? ''}`.trim(),
      )
    }
    console.log(
      `[content:instagram:import] rascunhos prontos da janela: ${planned.ordered.length} · publicadas: ${publishedExisting}${
        planned.linkOnly > 0 ? ` (peça-link: ${planned.linkOnly})` : ''
      }`,
    )
  }

  if (options.publish) {
    // Oldest first so the newest post carries the latest `publishedAt` — the
    // public listing sorts by `-publishedAt`, so the newest leads the Central.
    for (const entry of [...created].reverse()) {
      if (publishedInWindow.has(entry.contentPieceId)) continue
      if (!shouldPublishImportedPiece({ ...entry, publish: true })) continue
      try {
        await payload.update({
          collection: 'contentPiece',
          id: entry.contentPieceId,
          data: { status: 'publicado' },
          depth: 0,
          // Intentional admin bypass: the ops run publishes what it imported.
          overrideAccess: true,
        })
        const result = results.find((item) => item.contentPieceId === entry.contentPieceId)
        if (result) result.published = true
      } catch (error) {
        publishFailures += 1
        const result = results.find((item) => item.contentPieceId === entry.contentPieceId)
        if (result) {
          result.error = `publicação: ${
            error instanceof Error && error.message !== '' ? error.message : 'falha inesperada'
          }`
        }
      }
    }
    if (publishFailures > 0) {
      console.log(`[content:instagram:import] ${publishFailures} falha(s) ao publicar`)
    }
  }

  let revalidation = { attempted: false, ok: false, reason: null }
  if (publishedExisting > 0 || results.some((result) => result.published === true)) {
    revalidation = await revalidateInstagramContentCentral()
    console.log(
      `[content:instagram:import] Central pública: ${
        revalidation.ok ? 'revalidada' : `revalidação falhou (${revalidation.reason})`
      }`,
    )
  }

  const summary = summarizeInstagramContentResults(results, {
    costPerMinuteUsd: DEEPINFRA_TRANSCRIBE_COST_PER_MINUTE_USD,
  })
  const failures = [
    ...results
      .filter((result) => result.error !== null)
      .map((result) => ({ shortcode: result.shortcode, error: result.error })),
    ...extraFailures,
  ]
  const candidatesRemaining = plan.candidates.length - selected.length
  const runAt = new Date().toISOString()
  const report = {
    runAt,
    mode,
    target: databaseTarget(),
    window: { days: options.days, from: from.toISOString(), to: to.toISOString() },
    feed: { username: feed.username, count: feed.posts.length },
    plan,
    selected: selected.map((candidate) => candidate.shortcode),
    results,
    summary: { ...summary, durationMs: Date.now() - startedAt },
    failures,
    candidatesRemaining,
    publishFailures,
    publishedExisting,
    revalidation,
  }
  const reportPath = await writeReport(options, report, '-apply')
  for (const line of formatInstagramContentReport({
    target: report.target,
    mode,
    window: report.window,
    feedCount: report.feed.count,
    plan,
    summary,
    publishedExisting,
    failures,
    candidatesRemaining,
    reportPath,
  })) {
    console.log(line)
  }
  console.log(`\n[content:instagram:import] recibo JSON: ${reportPath}`)

  // Only a systemic failure (nothing entered the Central) is an error exit.
  if (results.length > 0 && summary.created === 0 && summary.existing === 0) {
    die('nenhuma peça entrou na Central — falhas listadas no recibo.')
  }
  process.exit(0)
}

main().catch((error) => {
  die(error instanceof Error && error.message !== '' ? error.message : 'falha inesperada.')
})
