/**
 * Recovers the production `media` objects (article covers) into the S3 bucket
 * configured by the S3_* envs (OPS52: Garage bucket `teqo-media`).
 *
 * Background (Issue #10 / OPS52-media): the 40 pre-existing `media` rows hold
 * relative URLs (`/api/media/file/<filename>`) and the files exist nowhere —
 * the rows are correct, the objects are missing. This script restores the
 * objects from the WordPress origin (jorgesolla.com.br — the same source the
 * post seed uses) WITHOUT touching the database: rows keep their URLs and the
 * Payload staticHandler starts streaming the objects through
 * `/api/media/file/<filename>`.
 *
 * Safety model (fail-closed, mirrors scripts/seed-posts.mjs):
 *   - Reads the DB (media rows + posts.coverImage), writes ONLY objects in the
 *     bucket — no payload.create/update anywhere.
 *   - Requires the COMPLETE S3_* env set for reconcile/dry-run
 *     (resolveS3StorageEnv throws on a partial config) — recovery is a
 *     production-bucket operation, never local storage; --verify skips storage
 *     entirely (it only HEADs public URLs).
 *   - Refuses a non-local DATABASE_URL unless ALLOW_REMOTE_DB=true is set
 *     explicitly, and echoes the target (DB host, endpoint, bucket, verify
 *     origin) before any write.
 *   - Bucket calls fail fast: short connection/request timeouts, so an
 *     unreachable endpoint errors in seconds instead of hanging.
 *   - Covers are constrained to http(s) on the WordPress origin and only
 *     image/* responses are stored (no SSRF on the homeserver, no non-image
 *     object served same-origin through the proxy).
 *
 * Modes:
 *   pnpm media:recover                reconcile — plan + upload every
 *                                     recoverable cover (PutObject overwrites,
 *                                     idempotent by filename)
 *   pnpm media:recover --dry-run      plan only — resolve covers + headObject
 *                                     each key (present/missing), zero writes
 *   pnpm media:recover --verify       acceptance check — HEAD every filename
 *                                     against the public URL (no bucket creds
 *                                     needed)
 *
 * Runbook (production): run on the homeserver inside the compose network with
 * the stack env (see docs/plans/ops52-media-recuperar-arquivos-impl.md).
 */
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'
import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'
import {
  fetchArticlesFromWordPress,
  resolveCoverDownloadUrl,
  resolveMediaCoverSources,
  WP_USER_AGENT,
} from './lib/wpArticles.mjs'

import { resolveS3StorageEnv } from '../src/utilities/mediaStorage.ts'

loadCliEnv()

const die = dieWithLabel('media:recover')

const PROD_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://jorgesolla1313.com.br'

const args = new Set(process.argv.slice(2))
const unknown = [...args].filter((a) => a !== '--dry-run' && a !== '--verify')
if (unknown.length > 0) die(`argumento desconhecido: ${unknown.join(', ')}`)
if (args.size > 1)
  die('modos são mutuamente exclusivos: use apenas um de --dry-run / --verify (ou nenhum).')
const mode = args.has('--dry-run') ? 'dry-run' : args.has('--verify') ? 'verify' : 'reconcile'

assertLocalDatabase(
  'media:recover',
  `Este script LÊ o banco de produção (rows de media) e ESCREVE apenas objetos no bucket S3 das envs S3_*.\n` +
    `  Runbook: rodar no homeserver, dentro da rede do compose, com o env do stack (ver\n` +
    `  docs/plans/ops52-media-recuperar-arquivos-impl.md).\n` +
    `  Se você REALMENTE quer apontar para o banco remoto de propósito, re-rodar com: ALLOW_REMOTE_DB=true …`,
)

const storage = mode === 'verify' ? { enabled: false } : resolveS3StorageEnv(process.env)
if (mode !== 'verify' && !storage.enabled) {
  die(
    'nenhuma env S3_* configurada — a recuperação é operação do bucket de produção, nunca do storage local.\n' +
      '  Configure as 4 S3_* (bucket, endpoint, access key, secret) ou use --verify (só URLs públicas).',
  )
}

const targetSummary = [
  `Alvo da execução:`,
  `  DB     : ${new URL(process.env.DATABASE_URL).host}`,
  ...(storage.enabled ? [`  Bucket : ${storage.bucket}`, `  Endpoint: ${storage.endpoint}`] : []),
  ...(mode === 'verify' ? [`  Origin : ${PROD_PUBLIC_ORIGIN}`] : []),
  `  Modo   : ${mode}`,
].join('\n')
console.log(`\n[media:recover] ${targetSummary}`)

// ---------------------------------------------------------------------------
// S3 client — fail fast on unreachable endpoints (E3: a hanging headObject
// looks like "Garage morto" when the real cause is routing). Only used by
// reconcile/dry-run — verify needs no bucket credentials.
// ---------------------------------------------------------------------------

const s3 = storage.enabled
  ? new S3Client({
      region: storage.region,
      endpoint: storage.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
      requestHandler: new NodeHttpHandler({ connectionTimeout: 5_000, requestTimeout: 15_000 }),
    })
  : null

// ---------------------------------------------------------------------------
// Reads (read-only — the script never writes the database)
// ---------------------------------------------------------------------------

async function findAll(payload, collection, where) {
  const docs = []
  let page = 1
  while (true) {
    const res = await payload.find({ collection, where, page, limit: 100, depth: 0 })
    docs.push(...res.docs)
    if (page >= res.totalPages) return docs
    page += 1
  }
}

/**
 * Resolves each media row to its cover source (pure mapping in
 * scripts/lib/wpArticles.mjs — post relation first, filename fallback).
 * @returns {Promise<Map<number|string, { row: object, slug: string|null, coverUrl: string|null, source: 'post'|'filename'|null }>>}
 */
async function resolveRows(payload) {
  const mediaRows = await findAll(payload, 'media', {})
  const posts = await findAll(payload, 'post', { coverImage: { exists: true } })

  const articlesBySlug = new Map()
  console.log('[media:recover] Fetching articles from jorgesolla.com.br (WP REST API)...')
  for (const article of await fetchArticlesFromWordPress(AbortSignal.timeout(60_000))) {
    articlesBySlug.set(article.slug, article)
  }

  const resolved = new Map()
  for (const entry of resolveMediaCoverSources(mediaRows, posts, articlesBySlug)) {
    resolved.set(entry.row.id, entry)
  }
  return resolved
}

const fmt = (resolved) =>
  `id=${resolved.row.id} ${resolved.row.filename} (slug=${resolved.slug || 'não resolvido'}, ` +
  `cover=${resolved.coverUrl ? 'ok' : 'sem cover'}, fonte=${resolved.source || '—'})`

// ---------------------------------------------------------------------------
// Bucket helpers
// ---------------------------------------------------------------------------

async function keyExists(filename) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: filename }))
    return true
  } catch (err) {
    if (err?.name === 'NotFound' || err?.name === 'NoSuchKey') return false
    throw err
  }
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

async function runDryRun(payload) {
  const resolved = await resolveRows(payload)
  let present = 0
  let missing = 0
  let errored = 0
  for (const r of resolved.values()) {
    const exists = await keyExists(r.row.filename).catch(() => null)
    if (exists === true) present += 1
    else if (exists === false) missing += 1
    else errored += 1
    console.log(
      `[media:recover]   ${exists === true ? 'presente ' : exists === false ? 'ausente  ' : 'erro    '} ${fmt(r)}`,
    )
  }
  console.log(
    `[media:recover] dry-run: ${resolved.size} row(s), ${present} objeto(s) presente(s), ${missing} ausente(s), ${errored} erro(s).`,
  )
  if (errored > 0)
    die(
      `${errored} checagem(s) do bucket falharam (endpoint/credenciais?) — o pre-flight não validou nada; corrigir antes de recuperar.`,
    )
}

async function runReconcile(payload) {
  const resolved = await resolveRows(payload)
  let uploaded = 0
  let failed = 0
  for (const r of resolved.values()) {
    if (!r.coverUrl) {
      console.log(`[media:recover]   sem-cover ${fmt(r)}`)
      failed += 1
      continue
    }
    try {
      const res = await fetch(resolveCoverDownloadUrl(r.coverUrl), {
        headers: { 'User-Agent': WP_USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new Error(`download ${res.status}`)
      const contentType =
        (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim() || 'image/jpeg'
      if (!contentType.startsWith('image/')) {
        throw new Error(`resposta não é imagem (${contentType}) — cobertura recusada`)
      }
      const body = Buffer.from(await res.arrayBuffer())
      await s3.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: r.row.filename,
          Body: body,
          ContentType: contentType,
        }),
      )
      uploaded += 1
      console.log(`[media:recover]   upload   ${fmt(r)} (${body.length} bytes, ${contentType})`)
    } catch (err) {
      failed += 1
      console.log(`[media:recover]   erro     ${fmt(r)} — ${err.message}`)
    }
  }
  console.log(
    `[media:recover] reconcile: ${uploaded} upload(s), ${failed} falha(s) de ${resolved.size} row(s).`,
  )
  if (failed > 0)
    die(`houve ${failed} falha(s) — conferir o relatório acima e a Issue #10 para as exceções.`)
}

async function runVerify(payload) {
  const mediaRows = await findAll(payload, 'media', {})
  let ok = 0
  const failures = []
  for (const row of mediaRows) {
    const url = `${PROD_PUBLIC_ORIGIN}/api/media/file/${encodeURIComponent(row.filename)}`
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) })
      if (res.ok) {
        ok += 1
        console.log(`[media:recover]   200      ${row.filename}`)
      } else {
        failures.push({ filename: row.filename, status: res.status })
        console.log(`[media:recover]   ${res.status}      ${row.filename}`)
      }
    } catch (err) {
      failures.push({ filename: row.filename, status: 'erro' })
      console.log(`[media:recover]   erro     ${row.filename} — ${err.message}`)
    }
  }
  console.log(
    `[media:recover] verify: ${ok}/${mediaRows.length} filenames respondendo 200 em ${PROD_PUBLIC_ORIGIN}.`,
  )
  if (failures.length > 0) {
    console.log(
      `[media:recover] Falhas: ${failures.map((f) => `${f.filename} (${f.status})`).join(', ')}`,
    )
    die(`${failures.length} filename(s) sem 200 — aceite da Issue #10 não satisfeito.`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })
  if (mode === 'dry-run') await runDryRun(payload)
  else if (mode === 'verify') await runVerify(payload)
  else await runReconcile(payload)
  process.exit(0)
}

main().catch((err) => {
  die(err?.message || String(err))
})
