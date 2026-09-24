import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import { INTERNET_SPEECH_MEDIA_SLUG } from '@/lib/webSpeech'

/**
 * C217 — shared media fixture of the web-speech int specs (the trigger the C216
 * simplify left: the third spec needing the magic bytes). Real bytes so
 * Payload's own detection derives the mime type from the upload — the detail
 * picks the native control and the cut job the ffmpeg variant from it.
 */
export const WEB_SPEECH_MP4_BYTES = Buffer.from(
  '00000018667479706d703432000000006d70343269736f6d',
  'hex',
)
export const WEB_SPEECH_MP3_BYTES = Buffer.from('fffb900000000000000000000000000000000000', 'hex')
// Real 2x2 JPEG: Payload runs sharp over image uploads (focal point), so a
// thumbnail fixture must decode like a real one.
export const WEB_SPEECH_JPEG_BYTES = Buffer.from(
  '/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCGACsH/9k=',
  'base64',
)

/**
 * Uploads one mirror artifact to `internetSpeechMedia` and returns its id. The
 * caller owns the cleanup of the row; the temp file is removed here (Payload
 * already copied it into its own static dir/S3).
 */
export const createInternetSpeechMedia = async (
  payload: Payload,
  bytes: Buffer,
  filename: string,
): Promise<number> => {
  const dir = mkdtempSync(join(tmpdir(), 'web-speech-media-'))
  try {
    const filePath = join(dir, filename)
    writeFileSync(filePath, bytes)
    const media = await payload.create({
      collection: INTERNET_SPEECH_MEDIA_SLUG,
      data: { alt: `Mídia de teste ${filename}` },
      filePath,
      // Intentional bypass: fixtures are a trusted actor with no session.
      overrideAccess: true,
    })
    return media.id
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
