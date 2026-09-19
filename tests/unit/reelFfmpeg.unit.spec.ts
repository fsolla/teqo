import { describe, expect, it } from 'vitest'

import {
  buildAudioDecodeArgs,
  buildConcatArgs,
  buildFrameListContent,
  buildMuxAudioVideoArgs,
  buildNarrationEncodeArgs,
  buildSceneClipArgs,
  concatListContent,
  encodeFrames,
  probeFfmpeg,
  resolveFfmpeg,
} from '../../scripts/lib/reelFfmpeg.mjs'

// C196 — ffmpeg resolution/args are pinned: the capability probe fails closed
// (libx264 + the filters the composer uses) and the clip/concat commands are
// deterministic.

type RunResult = { ok: boolean; stdout: string; stderr: string; error?: { code?: string } }

const okRun = async (_bin: string, args: string[]): Promise<RunResult> => {
  if (args.includes('-version'))
    return { ok: true, stdout: 'ffmpeg version 7.0.2-test\n', stderr: '' }
  if (args.includes('-encoders')) return { ok: true, stdout: ' V....D libx264 H.264\n', stderr: '' }
  if (args.includes('-filters')) {
    return {
      ok: true,
      stdout: [
        ' ... overlay VV->V',
        ' ..C crop V->V',
        ' ..C scale V->V',
        ' ... zoompan V->V',
        ' .S. fade V->V',
      ].join('\n'),
      stderr: '',
    }
  }
  return { ok: true, stdout: '', stderr: '' }
}

const zoom = {
  z: 'if(lt(on,3),1,1.18)',
  x: 'max(0,min(iw-iw/zoom,0))',
  y: 'max(0,min(ih-ih/zoom,0))',
  inputWidth: 2_160,
  inputHeight: 3_840,
}

describe('reelFfmpeg', () => {
  it('probes version, libx264 and the required filters', async () => {
    await expect(probeFfmpeg('/ffmpeg', { run: okRun })).resolves.toMatchObject({
      ok: true,
      bin: '/ffmpeg',
    })
  })

  it('fails the probe without libx264 or a required filter', async () => {
    const no264 = async (_bin: string, args: string[]): Promise<RunResult> => {
      if (args.includes('-version')) return { ok: true, stdout: 'ffmpeg version x\n', stderr: '' }
      if (args.includes('-encoders')) return { ok: true, stdout: ' V....D h264\n', stderr: '' }
      return { ok: true, stdout: '', stderr: '' }
    }
    await expect(probeFfmpeg('/ffmpeg', { run: no264 })).resolves.toMatchObject({
      ok: false,
      reason: 'sem encoder libx264',
    })

    const noZoompan = async (_bin: string, args: string[]): Promise<RunResult> => {
      if (args.includes('-version')) return { ok: true, stdout: 'ffmpeg version x\n', stderr: '' }
      if (args.includes('-encoders')) return { ok: true, stdout: 'libx264\n', stderr: '' }
      return { ok: true, stdout: 'overlay\ncrop\nscale\nfade\n', stderr: '' }
    }
    await expect(probeFfmpeg('/ffmpeg', { run: noZoompan })).resolves.toMatchObject({
      ok: false,
      reason: 'sem filtro(s): zoompan',
    })
  })

  it('requires libmp3lame and atempo only when probing for audio', async () => {
    await expect(probeFfmpeg('/ffmpeg', { run: okRun, audio: true })).resolves.toMatchObject({
      ok: false,
      reason: 'sem encoder libmp3lame',
    })

    const audioRun = async (_bin: string, args: string[]): Promise<RunResult> => {
      if (args.includes('-version'))
        return { ok: true, stdout: 'ffmpeg version 7.0.2-test\n', stderr: '' }
      if (args.includes('-encoders'))
        return { ok: true, stdout: ' V....D libx264 H.264\n A....D libmp3lame MP3\n', stderr: '' }
      return {
        ok: true,
        stdout: 'overlay\nfade\nscale\nzoompan\natempo A->A\n',
        stderr: '',
      }
    }
    await expect(probeFfmpeg('/ffmpeg', { run: audioRun, audio: true })).resolves.toMatchObject({
      ok: true,
    })

    const noAtempo = async (_bin: string, args: string[]): Promise<RunResult> => {
      if (args.includes('-version')) return { ok: true, stdout: 'ffmpeg version x\n', stderr: '' }
      if (args.includes('-encoders'))
        return { ok: true, stdout: 'libx264\nlibmp3lame\n', stderr: '' }
      return { ok: true, stdout: 'overlay\nfade\nscale\nzoompan\n', stderr: '' }
    }
    await expect(probeFfmpeg('/ffmpeg', { run: noAtempo, audio: true })).resolves.toMatchObject({
      ok: false,
      reason: 'sem filtro(s): atempo',
    })
  })

  it('resolves FFMPEG_PATH strictly, then PATH, then the packaged binary', async () => {
    const explicit = await resolveFfmpeg({
      env: { FFMPEG_PATH: '/custom/ffmpeg' },
      run: okRun,
      installer: { path: '/packed/ffmpeg' },
    })
    expect(explicit).toMatchObject({ bin: '/custom/ffmpeg', source: 'FFMPEG_PATH' })

    const pathFirst = await resolveFfmpeg({
      env: {},
      run: okRun,
      installer: { path: '/packed/ffmpeg' },
    })
    expect(pathFirst).toMatchObject({ bin: 'ffmpeg', source: 'PATH' })

    const packed = async (bin: string, args: string[]): Promise<RunResult> => {
      if (bin === 'ffmpeg') return { ok: false, stdout: '', stderr: '', error: { code: 'ENOENT' } }
      return okRun(bin, args)
    }
    const fallback = await resolveFfmpeg({
      env: {},
      run: packed,
      installer: { path: '/packed/ffmpeg' },
    })
    expect(fallback).toMatchObject({ bin: '/packed/ffmpeg', source: 'empacotado' })

    const brokenExplicit = async (bin: string, args: string[]): Promise<RunResult> =>
      bin === '/custom/ffmpeg'
        ? { ok: false, stdout: '', stderr: '', error: { code: 'ENOENT' } }
        : okRun(bin, args)
    await expect(
      resolveFfmpeg({
        env: { FFMPEG_PATH: '/custom/ffmpeg' },
        run: brokenExplicit,
        installer: { path: '/packed/ffmpeg' },
      }),
    ).rejects.toThrow(/Nenhum ffmpeg utilizável/)
  })

  it('builds the scene clip with zoom, burned captions and fades', () => {
    const args = buildSceneClipArgs({
      input: 'in.mp4',
      output: 'out.mp4',
      startMs: 1_500,
      durationMs: 3_000,
      zoom,
      captions: [
        { path: 'chrome.png', startMs: 0, endMs: 3_000 },
        { path: 'caption.png', startMs: 300, endMs: 1_800 },
      ],
      fadeInMs: 300,
      fadeOutMs: 400,
      fps: 30,
      width: 1_080,
      height: 1_920,
    })
    const graph = args[args.indexOf('-filter_complex') + 1]
    expect(graph).toContain('zoompan=')
    expect(graph).toContain("overlay=0:0:enable='between(t,0,3)'")
    expect(graph).toContain("overlay=0:0:enable='between(t,0.3,1.8)'")
    expect(graph).toContain('fade=t=in:st=0:d=0.3')
    expect(graph).toContain('fade=t=out:st=2.6:d=0.4')
    expect(args).toContain('-loop')
    expect(args.filter((arg: string) => arg === '-loop')).toHaveLength(2)
    expect(args).toContain('libx264')
    expect(args).toContain('[v2]')
    expect(args[args.indexOf('-ss') + 1]).toBe('1.5')
  })

  it('skips zoompan for scenes without clicks', () => {
    const args = buildSceneClipArgs({
      input: 'in.mp4',
      output: 'out.mp4',
      startMs: 0,
      durationMs: 2_400,
      fps: 30,
      width: 1_080,
      height: 1_920,
    })
    expect(args[args.indexOf('-filter_complex') + 1]).not.toContain('zoompan')
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('scale=1080:1920')
  })

  it('escapes concat entries and streams the final concat', () => {
    expect(concatListContent(['/tmp/a.mp4', "/tmp/o'brien.mp4"])).toBe(
      "file '/tmp/a.mp4'\nfile '/tmp/o'\\''brien.mp4'\n",
    )
    expect(buildConcatArgs({ listPath: 'list.txt', output: 'reel.mp4' })).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      'list.txt',
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      '-y',
      'reel.mp4',
    ])
  })

  it('builds the decode, encode and mux commands of the narration track', () => {
    expect(buildAudioDecodeArgs({ input: 'in.mp3', output: 'out.pcm' })).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'in.mp3',
      '-ac',
      '1',
      '-ar',
      '24000',
      '-c:a',
      'pcm_s16le',
      '-f',
      's16le',
      '-y',
      'out.pcm',
    ])
    const fitted = buildAudioDecodeArgs({ input: 'in.mp3', output: 'fit.pcm', tempo: 1.5 })
    expect(fitted).toContain('atempo=1.5')
    expect(fitted[fitted.indexOf('-filter:a') - 1]).toBe('in.mp3')

    expect(buildNarrationEncodeArgs({ input: 'narracao.pcm', output: 'narracao.mp3' })).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      's16le',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-i',
      'narracao.pcm',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      '-y',
      'narracao.mp3',
    ])

    expect(
      buildMuxAudioVideoArgs({
        video: 'reel.mp4',
        audio: 'narracao.mp3',
        output: 'reel-audio.mp4',
      }),
    ).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'reel.mp4',
      '-i',
      'narracao.mp3',
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-shortest',
      '-movflags',
      '+faststart',
      '-y',
      'reel-audio.mp4',
    ])
  })

  it('writes frame durations from capture deltas and repeats the last frame', () => {
    const content = buildFrameListContent({
      frames: [
        { file: '/f/1.jpg', captureMs: 0 },
        { file: '/f/2.jpg', captureMs: 50 },
        { file: '/f/3.jpg', captureMs: 250 },
      ],
      fps: 30,
    })
    expect(content).toBe(
      "file '/f/1.jpg'\nduration 0.05\nfile '/f/2.jpg'\nduration 0.2\nfile '/f/3.jpg'\nduration 0.033\nfile '/f/3.jpg'\n",
    )
  })

  it('encodes frames offline through the injected runner', async () => {
    const calls: Array<{ bin: string; args: string[] }> = []
    const writes: Array<{ path: string; content: string }> = []
    const run = async (bin: string, args: string[]): Promise<RunResult> => {
      calls.push({ bin, args })
      return { ok: true, stdout: '', stderr: '' }
    }
    await encodeFrames({
      ffmpegBin: '/ffmpeg',
      frames: [
        { file: '/f/1.jpg', captureMs: 0 },
        { file: '/f/2.jpg', captureMs: 40 },
      ],
      listPath: '/w/frames.txt',
      output: '/w/cap.mp4',
      fps: 30,
      run,
      writeFileImpl: async (path: string, content: string) => {
        writes.push({ path, content })
      },
    })
    expect(writes).toHaveLength(1)
    expect(writes[0].content).toContain("file '/f/1.jpg'")
    expect(calls).toHaveLength(1)
    expect(calls[0].args).toContain('concat')
    expect(calls[0].args).toContain('/w/cap.mp4')
  })
})
