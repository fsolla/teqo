import { describe, expect, it } from 'vitest'

import type { YouTubeVideo } from '@/utilities/socialFeed/youtubeFeed'
import {
  YOUTUBE_MAX_RESULTS_CAP,
  eligibleYouTubeVideos,
  formatYouTubeViews,
  loadYouTubeFeed,
  parseYouTubeSearchResponse,
  parseYouTubeVideosResponse,
  pickThumbnailUrl,
} from '@/utilities/socialFeed/youtubeFeed'

const SEARCH_ITEM = (videoId: string, title: string, publishedAt: string, extra?: object) => ({
  id: { videoId },
  snippet: {
    publishedAt,
    title,
    thumbnails: {
      default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` },
      high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
      maxres: { url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` },
    },
  },
  ...extra,
})

describe('formatYouTubeViews', () => {
  it('keeps raw counts below 1k', () => {
    expect(formatYouTubeViews(0)).toBe('0')
    expect(formatYouTubeViews(987)).toBe('987')
    expect(formatYouTubeViews(999)).toBe('999')
  })

  it('spells thousands in pt-BR short form with one comma decimal', () => {
    expect(formatYouTubeViews(1_000)).toBe('1 mil')
    expect(formatYouTubeViews(12_000)).toBe('12 mil')
    expect(formatYouTubeViews(12_400)).toBe('12,4 mil')
    expect(formatYouTubeViews(8_100)).toBe('8,1 mil')
    expect(formatYouTubeViews(999_999)).toBe('1 mi')
  })

  it('spells millions and billions with mi/bi', () => {
    expect(formatYouTubeViews(1_000_000)).toBe('1 mi')
    expect(formatYouTubeViews(1_234_567)).toBe('1,2 mi')
    expect(formatYouTubeViews(12_450_000)).toBe('12,5 mi')
    expect(formatYouTubeViews(1_000_000_000)).toBe('1 bi')
    expect(formatYouTubeViews(1_999_999_999)).toBe('2 bi')
  })
})

describe('pickThumbnailUrl', () => {
  it('prefers maxres, then high, then medium', () => {
    const thumbnails = {
      default: { url: 'default.jpg' },
      medium: { url: 'medium.jpg' },
      high: { url: 'high.jpg' },
      maxres: { url: 'maxres.jpg' },
    }
    expect(pickThumbnailUrl(thumbnails)).toBe('maxres.jpg')
    expect(pickThumbnailUrl({ high: { url: 'high.jpg' }, medium: { url: 'medium.jpg' } })).toBe(
      'high.jpg',
    )
    expect(pickThumbnailUrl({ medium: { url: 'medium.jpg' } })).toBe('medium.jpg')
  })

  it('reads missing or malformed thumbnails as undefined', () => {
    expect(pickThumbnailUrl(undefined)).toBeUndefined()
    expect(pickThumbnailUrl(null)).toBeUndefined()
    expect(pickThumbnailUrl({ high: { url: 42 } })).toBeUndefined()
    expect(pickThumbnailUrl({ high: { url: '' } })).toBeUndefined()
  })
})

describe('parseYouTubeSearchResponse', () => {
  it('parses a valid search response into videos with the best thumbnail', () => {
    const videos = parseYouTubeSearchResponse({
      items: [
        SEARCH_ITEM('video1', 'Primeiro vídeo', '2026-08-18T10:00:00Z'),
        SEARCH_ITEM('video2', 'Segundo vídeo', '2026-08-17T10:00:00Z', {
          snippet: {
            publishedAt: '2026-08-17T10:00:00Z',
            title: 'Segundo vídeo',
            thumbnails: { high: { url: 'https://i.ytimg.com/vi/video2/hqdefault.jpg' } },
          },
        }),
      ],
    })
    expect(videos).toHaveLength(2)
    expect(videos[0]).toEqual({
      id: 'video1',
      title: 'Primeiro vídeo',
      publishedAt: '2026-08-18T10:00:00Z',
      thumbnailUrl: 'https://i.ytimg.com/vi/video1/maxresdefault.jpg',
    })
    expect(videos[1].thumbnailUrl).toBe('https://i.ytimg.com/vi/video2/hqdefault.jpg')
  })

  it('skips malformed items but throws on protocol violations', () => {
    expect(
      parseYouTubeSearchResponse({
        items: [
          { id: { notAVideo: true } },
          { id: { videoId: 'no-title' }, snippet: { publishedAt: '2026-08-18T10:00:00Z' } },
          { id: { videoId: 'no-date' }, snippet: { title: 'Sem data' } },
          SEARCH_ITEM('ok1', 'Válido', '2026-08-18T10:00:00Z'),
        ],
      }),
    ).toEqual([expect.objectContaining({ id: 'ok1', title: 'Válido' })])

    expect(() => parseYouTubeSearchResponse({})).toThrow()
    expect(() => parseYouTubeSearchResponse(null)).toThrow()
    expect(() => parseYouTubeSearchResponse({ items: 'nope' })).toThrow()
  })
})

describe('parseYouTubeVideosResponse', () => {
  it('maps string viewCounts to numbers', () => {
    const counts = parseYouTubeVideosResponse({
      items: [
        { id: 'video1', statistics: { viewCount: '12400' } },
        { id: 'video2', statistics: { viewCount: '0' } },
        { id: 'no-count', statistics: {} },
        { id: 'bad-count', statistics: { viewCount: 'abc' } },
        'malformed',
        { id: 'no-stats' },
      ],
    })
    expect(counts.get('video1')).toBe(12_400)
    expect(counts.get('video2')).toBe(0)
    expect(counts.has('no-count')).toBe(false)
    expect(counts.has('bad-count')).toBe(false)
  })

  it('reads missing or malformed payloads as an empty map', () => {
    expect(parseYouTubeVideosResponse(undefined).size).toBe(0)
    expect(parseYouTubeVideosResponse({ items: 'nope' }).size).toBe(0)
    expect(parseYouTubeVideosResponse(null).size).toBe(0)
  })
})

describe('eligibleYouTubeVideos', () => {
  const videos: YouTubeVideo[] = [
    { id: 'a', title: 'A', publishedAt: '2026-08-18T10:00:00Z' },
    { id: 'b', title: 'B', publishedAt: '2026-08-17T10:00:00Z' },
    { id: 'c', title: 'C', publishedAt: '2026-08-16T10:00:00Z' },
    { id: 'd', title: 'D', publishedAt: '2026-08-15T10:00:00Z' },
  ]

  it('drops excluded ids and caps at maxItems, keeping API order', () => {
    expect(eligibleYouTubeVideos(videos, ['b'], 2)).toEqual([videos[0], videos[2]])
    expect(eligibleYouTubeVideos(videos, [], 3)).toEqual(videos.slice(0, 3))
    expect(eligibleYouTubeVideos(videos, ['a', 'b', 'c', 'd'], 5)).toEqual([])
  })
})

describe('loadYouTubeFeed', () => {
  const fakeResponse = (body: unknown, ok = true): Response =>
    ({ ok, json: async () => body }) as unknown as Response

  const calls: string[] = []
  const fetchImpl = async (input: string): Promise<Response> => {
    calls.push(input)
    if (input.includes('/search')) {
      return fakeResponse({
        items: [
          SEARCH_ITEM('v1', 'Vídeo 1', '2026-08-18T10:00:00Z'),
          SEARCH_ITEM('v2', 'Vídeo 2', '2026-08-17T10:00:00Z'),
        ],
      })
    }
    return fakeResponse({
      items: [
        { id: 'v1', statistics: { viewCount: '12400' } },
        { id: 'v2', statistics: { viewCount: '8100' } },
      ],
    })
  }

  const args = {
    apiKey: 'test-key',
    channelId: 'UCtest123',
    maxResults: 3,
    fetchImpl,
    baseUrl: 'http://localhost:4000',
  }

  it('fetches search then statistics and merges view counts', async () => {
    calls.length = 0
    const videos = await loadYouTubeFeed(args)

    expect(videos).toEqual([
      {
        id: 'v1',
        title: 'Vídeo 1',
        publishedAt: '2026-08-18T10:00:00Z',
        thumbnailUrl: expect.stringContaining('v1'),
        viewCount: 12_400,
      },
      {
        id: 'v2',
        title: 'Vídeo 2',
        publishedAt: '2026-08-17T10:00:00Z',
        thumbnailUrl: expect.stringContaining('v2'),
        viewCount: 8_100,
      },
    ])

    const searchCall = calls[0]
    expect(searchCall).toContain('/search?')
    expect(searchCall).toContain('channelId=UCtest123')
    expect(searchCall).toContain('type=video')
    expect(searchCall).toContain('order=date')
    expect(searchCall).toContain('key=test-key')
    expect(calls[1]).toContain('/videos?')
    expect(calls[1]).toContain('id=v1%2Cv2')
  })

  it('clamps maxResults to the API cap and the minimum of 1', async () => {
    calls.length = 0
    await loadYouTubeFeed({ ...args, maxResults: 100 })
    expect(calls[0]).toContain(`maxResults=${YOUTUBE_MAX_RESULTS_CAP}`)

    calls.length = 0
    await loadYouTubeFeed({ ...args, maxResults: 0 })
    expect(calls[0]).toContain('maxResults=1')
  })

  it('returns an empty feed without calling statistics when the channel has no public videos', async () => {
    calls.length = 0
    const videos = await loadYouTubeFeed({
      ...args,
      fetchImpl: async (input) => {
        calls.push(input)
        return fakeResponse({ items: [] })
      },
    })
    expect(videos).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('throws on non-2xx responses and protocol violations (fail-closed to the snapshot)', async () => {
    await expect(
      loadYouTubeFeed({ ...args, fetchImpl: async () => fakeResponse({}, false) }),
    ).rejects.toThrow()

    await expect(
      loadYouTubeFeed({
        ...args,
        fetchImpl: async () => fakeResponse({ items: 'nope' }),
      }),
    ).rejects.toThrow()
  })

  it('throws when the statistics call fails', async () => {
    await expect(
      loadYouTubeFeed({
        ...args,
        fetchImpl: async (input) =>
          input.includes('/search')
            ? fakeResponse({ items: [SEARCH_ITEM('v1', 'Vídeo 1', '2026-08-18T10:00:00Z')] })
            : fakeResponse({}, false),
      }),
    ).rejects.toThrow(/statistics/)
  })
})
