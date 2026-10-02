/**
 * C246 — one repair decision of the archive integrity sweep: resolve the
 * Flickr source by `flickrId`, download it, prove it decodes, replace the
 * stored object through the collection's own write path and verify the result.
 * Every side effect is injected (Flickr client, download, inspector, Payload
 * repair, withdraw, sha256), so the unit spec drives every branch with fakes and
 * the CLI stays a thin composition. No writes happen here beyond the caller's
 * functions.
 *
 * Classification: a gone/refused source (deleted/private Flickr photo) or a
 * source that does not decode is `unrecoverable` (withdraw); a transient
 * source/download failure is `failed` (retried on the next run); a write or
 * verification failure is `failed` too — the object was not proven good.
 */
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

import { archivePhotoStorageFilename } from '../../src/lib/archivePhoto.ts'

import { sha256Hex } from './cli.mjs'
import { FLICKR_USER_AGENT, isFlickrSourceGone } from './flickrApi.mjs'

/** A photo original is MBs; the guard only catches a stalled/runaway server. */
const PHOTO_DOWNLOAD_MAX_BYTES = 512 * 1024 * 1024
/**
 * Flickr originals can pass 50 MB (a 7952px panorama was 54 MB) and the
 * homeserver's direct egress runs ~260 KB/s — ~3,5 min for that file — so a
 * 2 min ceiling aborted a legitimate repair (C246 ops, 2026-10-02). 15 min
 * still catches a stall without capping a slow-but-working link.
 */
export const ARCHIVE_INTEGRITY_DOWNLOAD_TIMEOUT_MS = 15 * 60_000
/** Long edge of the decode proof; the same size the face index feeds the engine. */
const DECODE_MAX_EDGE = 1024

const messageOf = (error) => (error instanceof Error ? error.message : String(error))

/**
 * Every side effect arrives injected; loose types are deliberate (the unit spec
 * drives them with `vi.fn` fakes and the CLI with the real owners).
 *
 * @typedef {object} ArchiveIntegrityRepairDeps
 * @property {{ id: number, flickrId: string | number, filename?: string | null }} row
 * @property {string} tempRoot
 * @property {string} staticDir
 * @property {(args: { media: { filename: string | null }, staticDir: string, destinationPath: string }) => Promise<{ status: string, stage?: string | null, reason?: string | null, bytes?: number | null }>} inspect
 * @property {any} payload
 * @property {{ getLargestSize: (flickrId: string) => Promise<{ url?: string | null } | null> }} client
 * @property {(payload: any, args: { id: number, filePath: string }) => Promise<{ status: string, filename?: string | null, error?: string | null }>} repair
 * @property {(args: { url: string, destinationPath: string, headers: Record<string, string>, timeoutMs: number, maxBytes: number }) => Promise<void>} download
 * @property {(entry: { id: number, flickrId: string, filename: string | null, reason: string }) => Promise<any>} withdraw
 */

/**
 * @param {ArchiveIntegrityRepairDeps} deps
 * @returns {Promise<any>}
 */
export const repairArchivePhotoFromSource = async ({
  row,
  tempRoot,
  staticDir,
  inspect,
  payload,
  client,
  repair,
  download,
  withdraw,
}) => {
  const flickrId = String(row.flickrId)
  const base = { id: row.id, flickrId, filename: row.filename ?? null }
  const dir = join(tempRoot, `repair-${row.id}`)
  await mkdir(dir, { recursive: true })

  try {
    let source
    try {
      source = await client.getLargestSize(flickrId)
    } catch (error) {
      if (isFlickrSourceGone(error)) {
        return await withdraw({
          ...base,
          reason: `o Flickr recusou a fonte (${messageOf(error)})`,
        })
      }
      return { ...base, action: 'failed', stage: 'source', reason: messageOf(error) }
    }
    if (!source?.url) {
      return await withdraw({
        ...base,
        reason: 'o Flickr não devolveu nenhum tamanho utilizável para a foto',
      })
    }

    const filename = row.filename ?? archivePhotoStorageFilename(flickrId, source.url)
    const filePath = join(dir, filename)
    try {
      await download({
        url: source.url,
        destinationPath: filePath,
        headers: { 'User-Agent': FLICKR_USER_AGENT },
        timeoutMs: ARCHIVE_INTEGRITY_DOWNLOAD_TIMEOUT_MS,
        maxBytes: PHOTO_DOWNLOAD_MAX_BYTES,
      })
    } catch (error) {
      return { ...base, action: 'failed', stage: 'download', reason: messageOf(error) }
    }

    let bytes = 0
    try {
      bytes = (await stat(filePath)).size
      await sharp(filePath, { failOn: 'error' })
        .rotate()
        .resize({ width: DECODE_MAX_EDGE, withoutEnlargement: true })
        .toBuffer()
    } catch (error) {
      return await withdraw({
        ...base,
        reason: `a fonte do Flickr não decodifica (${messageOf(error)})`,
      })
    }

    const repaired = await repair(payload, { id: row.id, filePath })
    if (repaired.status === 'failed') {
      return { ...base, action: 'failed', stage: 'repair', reason: repaired.error }
    }

    const repairedFilename = repaired.filename ?? filename
    const verification = await inspect({
      media: { filename: repairedFilename },
      staticDir,
      destinationPath: join(dir, `verify-${repairedFilename}`),
    })
    if (verification.status !== 'ok') {
      const reason =
        verification.status === 'missing'
          ? 'o objeto reparado não foi encontrado depois da escrita'
          : `${verification.stage}: ${verification.reason}`
      return { ...base, filename: repairedFilename, action: 'failed', stage: 'verify', reason }
    }

    return {
      ...base,
      filename: repairedFilename,
      action: 'recovered',
      sourceUrl: source.url,
      sha256: sha256Hex(await readFile(filePath)),
      bytes: verification.bytes || bytes,
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
