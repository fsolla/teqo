// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resolveSpeechVod,
  SPEECH_VOD_CUT_POLICY,
  SPEECH_VOD_PLAYER_POLICY,
} from '@/utilities/speech/speechVodResolver'

const VOD_PLAYBACK = 'https://vod.camara.leg.br/trecho.mp4'
const VOD_DOWNLOAD = 'https://vod.camara.leg.br/trecho-download.mp4'
const CACHED_PLAYBACK = 'https://cdn.camara.leg.br/fala-gravada.mp4'
const CACHED_DOWNLOAD = 'https://cdn.camara.leg.br/fala-gravada-download.mp4'

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const mediaResponse = (status: number, contentType: string | null): Response =>
  new Response(status >= 200 && status < 300 ? 'video-bytes' : '', {
    status,
    ...(contentType ? { headers: { 'content-type': contentType } } : {}),
  })

type FetchCall = { url: string; method: string; range: string | null; userAgent: string | null }

const stubFetch = (
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): FetchCall[] => {
  const calls: FetchCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({
        url: String(input),
        method: (init?.method ?? 'GET').toUpperCase(),
        range: headers.Range ?? null,
        userAgent: headers['User-Agent'] ?? null,
      })
      return handler(String(input), init)
    }),
  )
  return calls
}

const readyBody = {
  estado: 'PRONTO',
  video: {
    titulo: 'Trecho',
    linkParaReproducao: VOD_PLAYBACK,
    linkParaDownload: VOD_DOWNLOAD,
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveSpeechVod', () => {
  it('returns both URLs only after the ranged probes verify them', async () => {
    const calls = stubFetch(async (url) =>
      url.includes('video-sob-demanda') ? jsonResponse(readyBody) : mediaResponse(206, 'video/mp4'),
    )

    await expect(
      resolveSpeechVod({ eventId: 67091, audioId: 558641, excerptTms: 3 }),
    ).resolves.toEqual({
      state: 'pronto',
      playbackUrl: VOD_PLAYBACK,
      downloadUrl: VOD_DOWNLOAD,
    })

    const probes = calls.filter((call) => call.method === 'GET' && call.range === 'bytes=0-1023')
    expect(probes).toHaveLength(2)
    expect(probes.every((probe) => probe.userAgent?.includes('Mozilla'))).toBe(true)
    expect(calls[0]?.url).toContain('trecho=3')
  })

  it('drops a playback link whose probe fails but keeps the verified download', async () => {
    stubFetch(async (url) =>
      url.includes('video-sob-demanda')
        ? jsonResponse(readyBody)
        : url === VOD_PLAYBACK
          ? mediaResponse(403, null)
          : mediaResponse(206, 'video/mp4'),
    )

    await expect(resolveSpeechVod({ eventId: 1, audioId: 2, excerptTms: 3 })).resolves.toEqual({
      state: 'pronto',
      playbackUrl: null,
      downloadUrl: VOD_DOWNLOAD,
    })
  })

  it('rejects a link that answers 200 with an HTML error page', async () => {
    stubFetch(async (url) =>
      url.includes('video-sob-demanda')
        ? jsonResponse(readyBody)
        : mediaResponse(200, 'text/html; charset=utf-8'),
    )

    await expect(resolveSpeechVod({ eventId: 1, audioId: 2, excerptTms: 3 })).resolves.toEqual({
      state: 'pronto',
      playbackUrl: null,
      downloadUrl: null,
    })
  })

  it('falls back to HEAD when the ranged GET is refused', async () => {
    stubFetch(async (url, init) => {
      if (url.includes('video-sob-demanda')) return jsonResponse(readyBody)
      return (init?.method ?? 'GET').toUpperCase() === 'GET'
        ? mediaResponse(405, null)
        : mediaResponse(200, 'video/mp4')
    })

    await expect(resolveSpeechVod({ eventId: 1, audioId: 2, excerptTms: 3 })).resolves.toEqual({
      state: 'pronto',
      playbackUrl: VOD_PLAYBACK,
      downloadUrl: VOD_DOWNLOAD,
    })
  })

  it('maps GERANDO and INDISPONIVEL without probing anything', async () => {
    const calls = stubFetch(async () => jsonResponse({ estado: 'GERANDO', video: null }))
    await expect(resolveSpeechVod({ eventId: 1, audioId: 2, excerptTms: 3 })).resolves.toEqual({
      state: 'gerando',
    })
    expect(calls).toHaveLength(1)

    vi.unstubAllGlobals()
    const unavailableCalls = stubFetch(async () =>
      jsonResponse({ estado: 'INDISPONIVEL', video: null }),
    )
    await expect(resolveSpeechVod({ eventId: 1, audioId: 2, excerptTms: 3 })).resolves.toEqual({
      state: 'indisponivel',
    })
    expect(unavailableCalls).toHaveLength(1)
  })

  it('throws after the bounded retries when the Câmara is unreachable', async () => {
    vi.useFakeTimers()
    try {
      const calls = stubFetch(async () => {
        throw new Error('connect ETIMEDOUT')
      })

      const assertion = expect(
        resolveSpeechVod({ eventId: 1, audioId: 2, excerptTms: 3 }),
      ).rejects.toThrow('connect ETIMEDOUT')
      await vi.advanceTimersByTimeAsync(SPEECH_VOD_PLAYER_POLICY.retryDelayMs + 100)
      await assertion
      expect(calls).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the C162 player click pinned to the short policy', () => {
    expect(SPEECH_VOD_PLAYER_POLICY).toEqual({
      statusTimeoutMs: 15_000,
      statusRetries: 1,
      retryDelayMs: 1_000,
      pollAttempts: 0,
      pollDelayMs: 1_000,
    })
  })
})

describe('resolveSpeechVod under the C169 cut policy', () => {
  const coordinates = { eventId: 1, audioId: 2, excerptTms: 3 }

  it('polls a GERANDO answer until PRONTO instead of failing on the first read', async () => {
    vi.useFakeTimers()
    try {
      let statusReads = 0
      const calls = stubFetch(async (url) => {
        if (url.includes('video-sob-demanda')) {
          statusReads += 1
          return statusReads === 1
            ? jsonResponse({ estado: 'GERANDO', video: null })
            : jsonResponse(readyBody)
        }
        return mediaResponse(206, 'video/mp4')
      })

      const assertion = resolveSpeechVod(coordinates, { policy: SPEECH_VOD_CUT_POLICY })
      await vi.advanceTimersByTimeAsync(SPEECH_VOD_CUT_POLICY.pollDelayMs + 100)

      await expect(assertion).resolves.toEqual({
        state: 'pronto',
        playbackUrl: VOD_PLAYBACK,
        downloadUrl: VOD_DOWNLOAD,
      })
      expect(statusReads).toBe(2)
      expect(calls[0]?.url).toContain('trecho=3')
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives up on GERANDO only after the declared poll budget', async () => {
    vi.useFakeTimers()
    try {
      const calls = stubFetch(async () => jsonResponse({ estado: 'GERANDO', video: null }))

      const assertion = resolveSpeechVod(coordinates, { policy: SPEECH_VOD_CUT_POLICY })
      await vi.advanceTimersByTimeAsync(
        SPEECH_VOD_CUT_POLICY.pollDelayMs * SPEECH_VOD_CUT_POLICY.pollAttempts + 100,
      )

      await expect(assertion).resolves.toEqual({ state: 'gerando' })
      expect(calls).toHaveLength(1 + SPEECH_VOD_CUT_POLICY.pollAttempts)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves with the stored link when the API answers INDISPONIVEL', async () => {
    stubFetch(async (url) =>
      url.includes('video-sob-demanda')
        ? jsonResponse({ estado: 'INDISPONIVEL', video: null })
        : mediaResponse(206, 'video/mp4'),
    )

    await expect(
      resolveSpeechVod(coordinates, {
        policy: SPEECH_VOD_CUT_POLICY,
        cachedUrls: { playbackUrl: CACHED_PLAYBACK, downloadUrl: CACHED_DOWNLOAD },
      }),
    ).resolves.toEqual({
      state: 'pronto',
      playbackUrl: CACHED_PLAYBACK,
      downloadUrl: CACHED_DOWNLOAD,
    })
  })

  it('resolves with the stored link when the API transport keeps failing', async () => {
    vi.useFakeTimers()
    try {
      stubFetch(async (url) => {
        if (url.includes('video-sob-demanda')) throw new Error('connect ETIMEDOUT')
        return url === CACHED_PLAYBACK ? mediaResponse(206, 'video/mp4') : mediaResponse(403, null)
      })

      const assertion = resolveSpeechVod(coordinates, {
        policy: SPEECH_VOD_CUT_POLICY,
        cachedUrls: { playbackUrl: CACHED_PLAYBACK },
      })
      await vi.advanceTimersByTimeAsync(SPEECH_VOD_CUT_POLICY.retryDelayMs + 100)

      await expect(assertion).resolves.toEqual({
        state: 'pronto',
        playbackUrl: CACHED_PLAYBACK,
        downloadUrl: null,
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('prefers the live API link and never probes the stored cache', async () => {
    const calls = stubFetch(async (url) =>
      url.includes('video-sob-demanda') ? jsonResponse(readyBody) : mediaResponse(206, 'video/mp4'),
    )

    await expect(
      resolveSpeechVod(coordinates, {
        policy: SPEECH_VOD_CUT_POLICY,
        cachedUrls: { playbackUrl: CACHED_PLAYBACK, downloadUrl: CACHED_DOWNLOAD },
      }),
    ).resolves.toEqual({
      state: 'pronto',
      playbackUrl: VOD_PLAYBACK,
      downloadUrl: VOD_DOWNLOAD,
    })
    expect(calls.some((call) => call.url.startsWith('https://cdn.camara.leg.br/'))).toBe(false)
  })

  it('tries the stored link when the PRONTO hash is dead and refuses a dead cache', async () => {
    stubFetch(async (url) =>
      url.includes('video-sob-demanda')
        ? jsonResponse(readyBody)
        : url === VOD_PLAYBACK || url === VOD_DOWNLOAD
          ? mediaResponse(403, null)
          : url === CACHED_PLAYBACK
            ? mediaResponse(200, 'text/html; charset=utf-8')
            : mediaResponse(200, 'video/mp4'),
    )

    await expect(
      resolveSpeechVod(coordinates, {
        policy: SPEECH_VOD_CUT_POLICY,
        cachedUrls: { playbackUrl: CACHED_PLAYBACK },
      }),
    ).resolves.toEqual({ state: 'pronto', playbackUrl: null, downloadUrl: null })
  })

  it('still throws with cachedUrls when neither source has a verified link', async () => {
    vi.useFakeTimers()
    try {
      stubFetch(async (url) => {
        if (url.includes('video-sob-demanda')) throw new Error('connect ETIMEDOUT')
        return mediaResponse(200, 'text/html; charset=utf-8')
      })

      const assertion = expect(
        resolveSpeechVod(coordinates, {
          policy: SPEECH_VOD_CUT_POLICY,
          cachedUrls: { playbackUrl: CACHED_PLAYBACK, downloadUrl: CACHED_DOWNLOAD },
        }),
      ).rejects.toThrow('connect ETIMEDOUT')
      await vi.advanceTimersByTimeAsync(SPEECH_VOD_CUT_POLICY.retryDelayMs + 100)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
