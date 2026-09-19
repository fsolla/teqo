import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildBeatPcm,
  buildNarrationTrack,
  DEFAULT_TTS_VOICE,
  resolveEdgeTts,
  setupEdgeTts,
  synthesizeBeat,
  TTS_VENV_DIR,
} from '../../scripts/lib/reelTts.mjs'

// C197 — the TTS draft provider: resolution is fail-closed (explicit path →
// dedicated venv → PATH), the spoken text never rides argv, and the track is
// padded/trimmed to the exact video duration (silence for mute scenes).

type RunResult = { ok: boolean; stdout: string; stderr: string; error?: { code?: string } }

const venvBin = join('/repo', TTS_VENV_DIR, 'bin', 'edge-tts')

describe('resolveEdgeTts', () => {
  it('uses EDGE_TTS_PATH strictly: a broken explicit path never falls back', async () => {
    const run = async (bin: string): Promise<RunResult> =>
      bin === '/custom/edge-tts'
        ? { ok: false, stdout: '', stderr: '', error: { code: 'EACCES' } }
        : { ok: true, stdout: '', stderr: '' }
    await expect(
      resolveEdgeTts({ env: { EDGE_TTS_PATH: '/custom/edge-tts' }, root: '/repo', run }),
    ).rejects.toThrow(/Nenhum edge-tts utilizável/)
  })

  it('falls back to the dedicated venv, then to PATH', async () => {
    const venv = await resolveEdgeTts({
      env: {},
      root: '/repo',
      run: async (bin: string): Promise<RunResult> =>
        bin === venvBin
          ? { ok: true, stdout: '', stderr: '' }
          : { ok: false, stdout: '', stderr: '', error: { code: 'ENOENT' } },
    })
    expect(venv).toEqual({ bin: venvBin, source: 'venv' })

    const path = await resolveEdgeTts({
      env: {},
      root: '/repo',
      run: async (bin: string): Promise<RunResult> =>
        bin === 'edge-tts'
          ? { ok: true, stdout: '', stderr: '' }
          : { ok: false, stdout: '', stderr: '', error: { code: 'ENOENT' } },
    })
    expect(path).toEqual({ bin: 'edge-tts', source: 'PATH' })
  })

  it('fails with the setup hint when nothing is usable', async () => {
    await expect(
      resolveEdgeTts({
        env: {},
        root: '/repo',
        run: async (): Promise<RunResult> => ({
          ok: false,
          stdout: '',
          stderr: '',
          error: { code: 'ENOENT' },
        }),
      }),
    ).rejects.toThrow(/pnpm reels:tts:setup/)
  })
})

describe('setupEdgeTts', () => {
  it('creates the venv, installs edge-tts and returns the resolved binary', async () => {
    const calls: Array<{ bin: string; args: string[] }> = []
    const run = async (bin: string, args: string[]): Promise<RunResult> => {
      calls.push({ bin, args })
      return { ok: true, stdout: '', stderr: '' }
    }
    const result = await setupEdgeTts({ root: '/repo', run })
    expect(calls[0]).toEqual({ bin: 'python3', args: ['-m', 'venv', join('/repo', TTS_VENV_DIR)] })
    expect(calls[1]).toEqual({
      bin: join('/repo', TTS_VENV_DIR, 'bin', 'pip'),
      args: ['install', '--upgrade', 'edge-tts'],
    })
    expect(result).toEqual({ bin: venvBin, source: 'venv' })
  })
})

describe('synthesizeBeat', () => {
  it('passes the text through a file, never through argv', async () => {
    const calls: Array<{ bin: string; args: string[] }> = []
    const writes: Array<{ path: string; content: string | Buffer }> = []
    const text = 'Frase com "aspas", emoji 🎯 e\nquebra de linha.'
    await synthesizeBeat({
      edgeTtsBin: '/venv/edge-tts',
      text,
      voice: DEFAULT_TTS_VOICE,
      textPath: '/w/audio/beat.txt',
      output: '/w/audio/beat.mp3',
      run: async (bin: string, args: string[]): Promise<RunResult> => {
        calls.push({ bin, args })
        return { ok: true, stdout: '', stderr: '' }
      },
      writeFileImpl: async (path: string, content: string | Buffer) => {
        writes.push({ path, content })
      },
    })
    expect(writes).toEqual([{ path: '/w/audio/beat.txt', content: `${text}\n` }])
    expect(calls).toEqual([
      {
        bin: '/venv/edge-tts',
        args: [
          '--voice',
          DEFAULT_TTS_VOICE,
          '--file',
          '/w/audio/beat.txt',
          '--write-media',
          '/w/audio/beat.mp3',
        ],
      },
    ])
    expect(calls[0].args.join(' ')).not.toContain('aspas')
  })
})

describe('buildBeatPcm', () => {
  const run = async (): Promise<RunResult> => ({ ok: true, stdout: '', stderr: '' })

  it('speeds the line up with atempo and pads to the exact window', async () => {
    const calls: Array<{ bin: string; args: string[] }> = []
    const pcm = await buildBeatPcm({
      ffmpegBin: '/ffmpeg',
      mp3Path: '/w/audio/step-1.mp3',
      id: 'step-1',
      targetMs: 2_000,
      workDir: '/w/audio',
      run: async (bin: string, args: string[]): Promise<RunResult> => {
        calls.push({ bin, args })
        return run()
      },
      readFileImpl: async (path: string) =>
        path.includes('-fit') ? Buffer.alloc(96_000) : Buffer.alloc(144_000),
    })
    expect(pcm).toHaveLength(96_000)
    const atempo = calls.find((call) => call.args.includes('-filter:a'))
    expect(atempo?.args).toContain('atempo=1.5')
  })

  it('fails closed when the line does not fit under the ceiling', async () => {
    await expect(
      buildBeatPcm({
        ffmpegBin: '/ffmpeg',
        mp3Path: '/w/audio/step-2.mp3',
        id: 'step-2',
        targetMs: 2_000,
        workDir: '/w/audio',
        run,
        readFileImpl: async () => Buffer.alloc(192_000),
      }),
    ).rejects.toThrow(/não cabe na cena[\s\S]*atempo/)
  })
})

describe('buildNarrationTrack', () => {
  it('concatenates spoken beats and silence to the exact video duration', async () => {
    const synthesized: string[] = []
    const runs: string[][] = []
    const writes: Array<{ path: string; content: string | Buffer }> = []
    const workDir = join(tmpdir(), 'teqo-reel-tts-unit')
    const result = await buildNarrationTrack({
      ffmpegBin: '/ffmpeg',
      edgeTtsBin: '/venv/edge-tts',
      voice: DEFAULT_TTS_VOICE,
      beats: [
        { id: 'hook', durationMs: 1_000, text: 'Abertura.' },
        { id: 'cta', durationMs: 2_000, text: null },
      ],
      workDir,
      mp3Path: '/out/narracao.mp3',
      run: async (_bin: string, args: string[]): Promise<RunResult> => {
        runs.push(args)
        return { ok: true, stdout: '', stderr: '' }
      },
      readFileImpl: async () => Buffer.alloc(48_000),
      writeFileImpl: async (path: string, content: string | Buffer) => {
        writes.push({ path, content })
      },
      synthesize: async ({ text }: { text: string }) => {
        synthesized.push(text)
      },
    })
    expect(synthesized).toEqual(['Abertura.'])
    expect(result.durationMs).toBe(3_000)
    expect(writes).toHaveLength(1)
    expect(writes[0].path).toBe(join(workDir, 'audio', 'narracao.pcm'))
    expect(writes[0].content).toHaveLength(48_000 + 96_000)
    const encode = runs[runs.length - 1]
    expect(encode).toContain('libmp3lame')
    expect(encode).toContain('/out/narracao.mp3')
  })
})
