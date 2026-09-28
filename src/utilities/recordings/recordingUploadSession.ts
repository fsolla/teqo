import 'server-only'

import { mkdir, readFile, rm, statfs, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { recordingUploadFitsInDisk } from '@/lib/recording'
import { RECORDING_UPLOAD_NO_SPACE_MESSAGE } from '@/lib/schemas/recording'

/**
 * C199-fix — on-disk state of one in-flight chunked recording upload: a
 * per-recording directory under the temp dir holding the video appended chunk
 * by chunk plus the session metadata (sanitized file name and the declared
 * byte count). The recording row owns auth and visibility; this directory owns
 * the bytes.
 *
 * Lives apart from `recordingUpload` and `recordingJob` so both the upload path
 * and the reaper can create/read/remove a session without an import cycle.
 * Internal names are dot-prefixed; `sanitizeRecordingFilename` strips leading
 * dots, so a user file name can never collide with them.
 */

const SESSION_STATE_FILE = '.session.json'
const PLACEHOLDER_DIR = '.placeholder'

export type RecordingUploadSession = {
  /** Sanitized original file name; the appended file (and the stored media) keeps it. */
  uploadName: string
  /** Size the client declared; finalize only happens when it matches exactly. */
  expectedBytes: number
}

type SessionRecord = RecordingUploadSession

const recordingUploadDir = (recordingId: number): string =>
  join(tmpdir(), `recording-upload-${recordingId}`)

export const recordingUploadFilePath = (recordingId: number, uploadName: string): string =>
  join(recordingUploadDir(recordingId), uploadName)

/** Dot-prefixed placeholder subdirectory; never collides with an upload file. */
export const recordingUploadPlaceholderPath = (recordingId: number, uploadName: string): string =>
  join(recordingUploadDir(recordingId), PLACEHOLDER_DIR, uploadName)

/**
 * Fail fast on a disk that cannot hold the declared file plus margin. The
 * measurement is an optimization, not a gate: a `statfs` failure (odd
 * filesystem) skips it and lets the write path hit the real bound.
 */
export const assertRecordingUploadDiskRoom = async (expectedBytes: number): Promise<void> => {
  let freeBytes: number
  try {
    const stats = await statfs(tmpdir())
    freeBytes = Number(stats.bavail) * Number(stats.bsize)
  } catch {
    return
  }
  if (!recordingUploadFitsInDisk({ freeBytes, expectedBytes })) {
    throw new Error(RECORDING_UPLOAD_NO_SPACE_MESSAGE)
  }
}

/** Creates the empty appended file the chunks will grow and persists the state. */
export const createRecordingUploadSession = async (
  recordingId: number,
  session: RecordingUploadSession,
): Promise<void> => {
  const dir = recordingUploadDir(recordingId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, SESSION_STATE_FILE), JSON.stringify(session))
  await writeFile(recordingUploadFilePath(recordingId, session.uploadName), '')
}

/** Null when the session state is missing or unreadable (lost/never started). */
export const readRecordingUploadSession = async (
  recordingId: number,
): Promise<RecordingUploadSession | null> => {
  try {
    const raw = await readFile(join(recordingUploadDir(recordingId), SESSION_STATE_FILE), 'utf8')
    const parsed = JSON.parse(raw) as Partial<SessionRecord>
    if (
      typeof parsed.uploadName !== 'string' ||
      parsed.uploadName.length === 0 ||
      typeof parsed.expectedBytes !== 'number' ||
      !Number.isFinite(parsed.expectedBytes) ||
      parsed.expectedBytes < 0
    ) {
      return null
    }
    return { uploadName: parsed.uploadName, expectedBytes: parsed.expectedBytes }
  } catch {
    return null
  }
}

/** Best-effort removal of the whole session (finalize, abort and reaper paths). */
export const removeRecordingUploadSession = async (recordingId: number): Promise<void> => {
  await rm(recordingUploadDir(recordingId), { recursive: true, force: true }).catch(() => undefined)
}
