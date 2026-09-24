import { describe, expect, it } from 'vitest'

import {
  downloadWithYtDlp,
  parseYtDlpMetadata,
  readYtDlpMetadata,
  resolveYtDlp,
  YTDLP_FORMAT,
  type YtDlpResult,
} from '@/utilities/media/ytdlp'

// C215 — the yt-dlp owner: fail-closed resolution, metadata parsing and the
// deterministic download command (format cap, merge, ffmpeg location).

const okRun =
  (stdout = '') =>
  async (): Promise<YtDlpResult> => ({ ok: true, stdout, stderr: '' })

describe('resolveYtDlp', () => {
  it('accepts the explicit YTDLP_PATH and the PATH fallback', async () => {
    await expect(
      resolveYtDlp({ env: { YTDLP_PATH: '/custom/yt-dlp' }, run: okRun('2026.09.20') }),
    ).resolves.toEqual({ ok: true, bin: '/custom/yt-dlp' })
    await expect(resolveYtDlp({ env: {}, run: okRun('2026.09.20') })).resolves.toEqual({
      ok: true,
      bin: 'yt-dlp',
    })
  })

  it('fails closed with the reason when the binary is missing', async () => {
    const missing = async (): Promise<YtDlpResult> => ({
      ok: false,
      stdout: '',
      stderr: '',
      error: { code: 'ENOENT' },
    })
    const resolved = await resolveYtDlp({ env: {}, run: missing })
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.reason).toContain('não encontrado')
  })
})

describe('parseYtDlpMetadata', () => {
  it('maps the dump-json document and falls back to uploader', () => {
    expect(
      parseYtDlpMetadata({
        id: 'dQw4w9WgXcQ',
        title: '  Entrevista  ',
        uploader: 'Canal do Solla',
        duration: 123.4,
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg',
      }),
    ).toEqual({
      externalId: 'dQw4w9WgXcQ',
      title: 'Entrevista',
      channel: 'Canal do Solla',
      durationSeconds: 123.4,
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg',
    })
  })

  it('keeps absent/invalid fields null instead of guessing', () => {
    expect(parseYtDlpMetadata({ duration: -5, title: '' })).toEqual({
      externalId: null,
      title: null,
      channel: null,
      durationSeconds: null,
      thumbnailUrl: null,
    })
  })
})

describe('readYtDlpMetadata', () => {
  it('parses the JSON stdout', async () => {
    const run = okRun(JSON.stringify({ id: 'x', title: 'Fala', duration: 60 }))
    await expect(
      readYtDlpMetadata({ bin: 'yt-dlp', url: 'https://x', run }),
    ).resolves.toMatchObject({ externalId: 'x', title: 'Fala', durationSeconds: 60 })
  })

  it('throws with the stderr tail on failure and on malformed JSON', async () => {
    const failing = async (): Promise<YtDlpResult> => ({
      ok: false,
      stdout: '',
      stderr: 'ERROR: Video unavailable',
    })
    await expect(
      readYtDlpMetadata({ bin: 'yt-dlp', url: 'https://x', run: failing }),
    ).rejects.toThrow(/Video unavailable/)

    await expect(
      readYtDlpMetadata({ bin: 'yt-dlp', url: 'https://x', run: okRun('not json') }),
    ).rejects.toThrow(/fora do formato/)
  })
})

describe('downloadWithYtDlp', () => {
  it('caps quality, merges to mp4 and forwards the ffmpeg location', async () => {
    const calls: string[][] = []
    const run = async (_bin: string, args: string[]): Promise<YtDlpResult> => {
      calls.push(args)
      return { ok: true, stdout: '', stderr: '' }
    }

    await downloadWithYtDlp({
      bin: '/bin/yt-dlp',
      url: 'https://www.youtube.com/watch?v=x',
      outputTemplate: '/tmp/source.%(ext)s',
      ffmpegLocation: '/packed/ffmpeg',
      run,
    })

    expect(calls).toHaveLength(1)
    const args = calls[0]
    expect(args).toContain('--no-playlist')
    expect(args.slice(args.indexOf('-f'), args.indexOf('-f') + 2)).toEqual(['-f', YTDLP_FORMAT])
    expect(
      args.slice(args.indexOf('--merge-output-format'), args.indexOf('--merge-output-format') + 2),
    ).toEqual(['--merge-output-format', 'mp4'])
    expect(
      args.slice(args.indexOf('--ffmpeg-location'), args.indexOf('--ffmpeg-location') + 2),
    ).toEqual(['--ffmpeg-location', '/packed/ffmpeg'])
    expect(args.slice(args.indexOf('-o'), args.indexOf('-o') + 2)).toEqual([
      '-o',
      '/tmp/source.%(ext)s',
    ])
    expect(args.at(-1)).toBe('https://www.youtube.com/watch?v=x')
  })

  it('throws with the stderr tail when yt-dlp fails', async () => {
    const failing = async (): Promise<YtDlpResult> => ({
      ok: false,
      stdout: '',
      stderr: 'ERROR: unable to download',
    })
    await expect(
      downloadWithYtDlp({
        bin: 'yt-dlp',
        url: 'https://x',
        outputTemplate: '/tmp/source.%(ext)s',
        run: failing,
      }),
    ).rejects.toThrow(/unable to download/)
  })
})
