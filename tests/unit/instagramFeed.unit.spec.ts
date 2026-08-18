import { describe, expect, it } from 'vitest'

import type { InstagramPost } from '@/utilities/socialFeed/instagramFeed'
import {
  INSTAGRAM_MAX_RESULTS_CAP,
  eligibleInstagramPosts,
  loadInstagramFeed,
  parseInstagramMediaResponse,
  pickInstagramThumbnail,
} from '@/utilities/socialFeed/instagramFeed'

const MEDIA_ITEM = (
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  caption: `Legenda ${id}`,
  media_type: 'IMAGE',
  media_url: `https://scontent.cdninstagram.com/${id}.jpg`,
  permalink: `https://www.instagram.com/p/${id}/`,
  timestamp: '2026-08-18T10:00:00+00:00',
  ...overrides,
})

describe('pickInstagramThumbnail', () => {
  it('uses the media URL for images', () => {
    expect(pickInstagramThumbnail(MEDIA_ITEM('img'))).toBe(
      'https://scontent.cdninstagram.com/img.jpg',
    )
  })

  it('uses the thumbnail for videos and reels, never the mp4', () => {
    expect(
      pickInstagramThumbnail(
        MEDIA_ITEM('vid', {
          media_type: 'VIDEO',
          media_url: 'https://scontent.cdninstagram.com/vid.mp4',
          thumbnail_url: 'https://scontent.cdninstagram.com/vid.jpg',
        }),
      ),
    ).toBe('https://scontent.cdninstagram.com/vid.jpg')

    expect(
      pickInstagramThumbnail(
        MEDIA_ITEM('reel', {
          media_type: 'REEL',
          thumbnail_url: 'https://scontent.cdninstagram.com/reel.jpg',
        }),
      ),
    ).toBe('https://scontent.cdninstagram.com/reel.jpg')
  })

  it('resolves carousels from the first child that carries a URL', () => {
    expect(
      pickInstagramThumbnail(
        MEDIA_ITEM('car', {
          media_type: 'CAROUSEL_ALBUM',
          children: {
            data: [
              { media_url: 'https://scontent.cdninstagram.com/first.jpg' },
              { media_url: 'https://scontent.cdninstagram.com/second.jpg' },
            ],
          },
        }),
      ),
    ).toBe('https://scontent.cdninstagram.com/first.jpg')

    expect(
      pickInstagramThumbnail(
        MEDIA_ITEM('car2', {
          media_type: 'CAROUSEL_ALBUM',
          children: {
            data: [
              { thumbnail_url: 'https://scontent.cdninstagram.com/child-video.jpg' },
              { media_url: 'https://scontent.cdninstagram.com/child-image.jpg' },
            ],
          },
        }),
      ),
    ).toBe('https://scontent.cdninstagram.com/child-video.jpg')
  })

  it('reads missing or malformed thumbnails as undefined', () => {
    expect(
      pickInstagramThumbnail(
        MEDIA_ITEM('no-thumb', { media_type: 'REEL', thumbnail_url: undefined }),
      ),
    ).toBeUndefined()
    expect(
      pickInstagramThumbnail(
        MEDIA_ITEM('empty-children', { media_type: 'CAROUSEL_ALBUM', children: { data: [] } }),
      ),
    ).toBeUndefined()
    expect(
      pickInstagramThumbnail(
        MEDIA_ITEM('bad-children', {
          media_type: 'CAROUSEL_ALBUM',
          children: { data: ['nope'] },
        }),
      ),
    ).toBeUndefined()
    expect(
      pickInstagramThumbnail(
        MEDIA_ITEM('no-type', { media_type: undefined, media_url: undefined }),
      ),
    ).toBeUndefined()
  })
})

describe('parseInstagramMediaResponse', () => {
  it('parses a valid media response, keeping null captions', () => {
    const posts = parseInstagramMediaResponse({
      data: [
        MEDIA_ITEM('post1'),
        MEDIA_ITEM('post2', { caption: null, media_type: 'REEL', thumbnail_url: 'thumb.jpg' }),
        MEDIA_ITEM('post3', {
          media_type: 'CAROUSEL_ALBUM',
          children: { data: [{ media_url: 'child.jpg' }] },
        }),
      ],
    })
    expect(posts).toHaveLength(3)
    expect(posts[0]).toEqual({
      id: 'post1',
      caption: 'Legenda post1',
      mediaType: 'IMAGE',
      permalink: 'https://www.instagram.com/p/post1/',
      thumbnailUrl: 'https://scontent.cdninstagram.com/post1.jpg',
      timestamp: '2026-08-18T10:00:00+00:00',
    })
    expect(posts[1].caption).toBeNull()
    expect(posts[1].thumbnailUrl).toBe('thumb.jpg')
    expect(posts[2].thumbnailUrl).toBe('child.jpg')
  })

  it('drops items without id, permalink or timestamp but throws on protocol violations', () => {
    expect(
      parseInstagramMediaResponse({
        data: [
          MEDIA_ITEM('ok'),
          { ...MEDIA_ITEM('no-permalink'), permalink: undefined },
          { ...MEDIA_ITEM('no-timestamp'), timestamp: undefined },
          { id: 'no-caption', permalink: 'https://instagram.com/p/x/', timestamp: 't' },
          'malformed',
        ],
      }),
    ).toEqual([
      expect.objectContaining({ id: 'ok' }),
      expect.objectContaining({ id: 'no-caption', caption: null }),
    ])

    expect(() => parseInstagramMediaResponse({})).toThrow()
    expect(() => parseInstagramMediaResponse(null)).toThrow()
    expect(() => parseInstagramMediaResponse({ data: 'nope' })).toThrow()
  })
})

describe('eligibleInstagramPosts', () => {
  const posts: InstagramPost[] = [
    {
      id: 'a',
      caption: 'A',
      mediaType: 'IMAGE',
      permalink: 'https://instagram.com/p/a/',
      timestamp: 't1',
    },
    {
      id: 'b',
      caption: 'B',
      mediaType: 'IMAGE',
      permalink: 'https://instagram.com/p/b/',
      timestamp: 't2',
    },
    {
      id: 'c',
      caption: 'C',
      mediaType: 'IMAGE',
      permalink: 'https://instagram.com/p/c/',
      timestamp: 't3',
    },
    {
      id: 'd',
      caption: 'D',
      mediaType: 'IMAGE',
      permalink: 'https://instagram.com/p/d/',
      timestamp: 't4',
    },
  ]

  it('drops excluded ids and caps at maxItems, keeping API order', () => {
    expect(eligibleInstagramPosts(posts, ['b'], 2)).toEqual([posts[0], posts[2]])
    expect(eligibleInstagramPosts(posts, [], 3)).toEqual(posts.slice(0, 3))
    expect(eligibleInstagramPosts(posts, ['a', 'b', 'c', 'd'], 5)).toEqual([])
  })
})

describe('loadInstagramFeed', () => {
  const fakeResponse = (body: unknown, ok = true): Response =>
    ({ ok, json: async () => body }) as unknown as Response

  const calls: string[] = []
  const fetchImpl = async (input: string): Promise<Response> => {
    calls.push(input)
    if (input.includes('/media')) {
      return fakeResponse({
        data: [
          MEDIA_ITEM('post1', { caption: 'Post 1' }),
          MEDIA_ITEM('post2', { caption: 'Post 2' }),
        ],
      })
    }
    if (input.includes('/refresh_access_token')) {
      return fakeResponse({ access_token: 'refreshed-token' })
    }
    return fakeResponse({ username: 'depjorgesolla' })
  }

  const args = {
    accessToken: 'test-token',
    userId: '17841400000000000',
    maxResults: 3,
    fetchImpl,
    baseUrl: 'http://localhost:5000',
  }

  it('fetches user then media and resolves the thumbnail per type', async () => {
    calls.length = 0
    const result = await loadInstagramFeed(args)

    expect(result.username).toBe('depjorgesolla')
    expect(result.refreshedAccessToken).toBeUndefined()
    expect(result.posts).toEqual([
      expect.objectContaining({ id: 'post1', caption: 'Post 1' }),
      expect.objectContaining({ id: 'post2' }),
    ])

    const userCall = calls[0]
    expect(userCall).toContain(`/17841400000000000?`)
    expect(userCall).toContain('fields=username')
    expect(userCall).toContain(`access_token=test-token`)
    expect(calls[1]).toContain('/media?')
    expect(calls[1]).toContain('fields=id%2Ccaption%2Cmedia_type%2Cmedia_url')
    expect(calls[1]).toContain('children%7Bmedia_url%2Cthumbnail_url%7D')
    expect(calls[1]).toContain('limit=3')
  })

  it('clamps maxResults to the API cap and the minimum of 1', async () => {
    calls.length = 0
    await loadInstagramFeed({ ...args, maxResults: 100 })
    expect(calls[1]).toContain(`limit=${INSTAGRAM_MAX_RESULTS_CAP}`)

    calls.length = 0
    await loadInstagramFeed({ ...args, maxResults: 0 })
    expect(calls[1]).toContain('limit=1')
  })

  it('refreshes the token once and retries when the media call fails', async () => {
    calls.length = 0
    let mediaFailures = 1
    const result = await loadInstagramFeed({
      ...args,
      fetchImpl: async (input) => {
        calls.push(input)
        if (input.includes('/media')) {
          if (mediaFailures > 0) {
            mediaFailures -= 1
            return fakeResponse({ error: { code: 190 } }, false)
          }
          return fakeResponse({ data: [MEDIA_ITEM('post-retry')] })
        }
        if (input.includes('/refresh_access_token')) {
          return fakeResponse({ access_token: 'refreshed-token' })
        }
        return fakeResponse({ username: 'depjorgesolla' })
      },
    })

    expect(result.refreshedAccessToken).toBe('refreshed-token')
    expect(result.posts).toEqual([expect.objectContaining({ id: 'post-retry' })])
    const refreshCall = calls.find((call) => call.includes('/refresh_access_token'))
    expect(calls.filter((call) => call.includes('/refresh_access_token'))).toHaveLength(1)
    expect(calls.filter((call) => call.includes('/media'))).toHaveLength(2)
    expect(refreshCall).toContain('grant_type=ig_refresh_token')
    expect(refreshCall).toContain('access_token=test-token')
  })

  it('throws when the refresh fails or returns no token (fail-closed to the snapshot)', async () => {
    await expect(
      loadInstagramFeed({
        ...args,
        fetchImpl: async () => fakeResponse({}, false),
      }),
    ).rejects.toThrow()

    await expect(
      loadInstagramFeed({
        ...args,
        fetchImpl: async (input) =>
          input.includes('/media') ? fakeResponse({}, false) : fakeResponse({}, true),
      }),
    ).rejects.toThrow(/refresh/)

    await expect(
      loadInstagramFeed({
        ...args,
        fetchImpl: async (input) =>
          input.includes('/media') ? fakeResponse({}, false) : fakeResponse({ nope: true }),
      }),
    ).rejects.toThrow(/sem novo token/)
  })

  it('throws on protocol violations and a failed retry', async () => {
    await expect(
      loadInstagramFeed({
        ...args,
        fetchImpl: async () => fakeResponse({ data: 'nope' }),
      }),
    ).rejects.toThrow()

    await expect(
      loadInstagramFeed({
        ...args,
        fetchImpl: async (input) =>
          input.includes('/media') ? fakeResponse({}, false) : fakeResponse({}, false),
      }),
    ).rejects.toThrow()
  })

  it('reads a missing or malformed username as null', async () => {
    const result = await loadInstagramFeed({
      ...args,
      fetchImpl: async (input) =>
        input.includes('/media') ? fakeResponse({ data: [MEDIA_ITEM('p')] }) : fakeResponse({}),
    })
    expect(result.username).toBeNull()
  })
})
