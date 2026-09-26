// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { FLICKR_PHOTO_EXTRAS, createFlickrClient } from '../../scripts/lib/flickrApi.mjs'

// C231 — the Flickr client contract: request shape, pacing, transient retry,
// named `stat=fail` refusals, the exif tolerance and the largest-size
// fallback. `fetch` is always a fake — the real API never enters the suite.

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

const fakeFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) =>
  vi.fn(impl) as unknown as typeof fetch

const clientWith = (
  fetchImpl: typeof fetch,
  overrides: Record<string, unknown> = {},
): ReturnType<typeof createFlickrClient> =>
  createFlickrClient({
    apiKey: 'test-key',
    fetchImpl,
    pacingMs: 0,
    retryAttempts: 1,
    ...overrides,
  })

describe('createFlickrClient (C231)', () => {
  it('refuses to be created without the API key', () => {
    expect(() => createFlickrClient({ apiKey: '  ' })).toThrow(/FLICKR_API_KEY/)
    expect(() => createFlickrClient()).toThrow(/FLICKR_API_KEY/)
  })

  it('sends the method, key, JSON contract and extras; parses the listing', async () => {
    const fetchImpl = fakeFetch(async () =>
      jsonResponse({
        stat: 'ok',
        photos: { page: 1, pages: 2, total: 7000, photo: [{ id: '1' }] },
      }),
    )
    const client = clientWith(fetchImpl)

    const photos = await client.listPhotosPage({ userId: '123@N00', page: 2 })

    const called = new URL(
      String((fetchImpl as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]),
    )
    expect(called.origin + called.pathname).toBe('https://api.flickr.com/services/rest/')
    expect(called.searchParams.get('method')).toBe('flickr.people.getPhotos')
    expect(called.searchParams.get('api_key')).toBe('test-key')
    expect(called.searchParams.get('nojsoncallback')).toBe('1')
    expect(called.searchParams.get('user_id')).toBe('123@N00')
    expect(called.searchParams.get('page')).toBe('2')
    expect(called.searchParams.get('extras')).toBe(FLICKR_PHOTO_EXTRAS)
    expect(photos).toMatchObject({ page: 1, pages: 2, total: 7000 })
  })

  it('paces sequential calls with the configured interval', async () => {
    const sleeps: number[] = []
    let clock = 0
    const fetchImpl = fakeFetch(async () =>
      jsonResponse({ stat: 'ok', photos: { page: 1, pages: 1, total: 0, photo: [] } }),
    )
    const client = createFlickrClient({
      apiKey: 'k',
      fetchImpl,
      pacingMs: 1000,
      retryAttempts: 1,
      sleep: async (ms: number) => {
        sleeps.push(ms)
        clock += ms
      },
      now: () => clock,
    })

    await client.call('a')
    clock += 200
    await client.call('b')

    expect(sleeps).toEqual([800])
  })

  it('retries HTTP 429/5xx and thrown network errors with growing backoff', async () => {
    const sleeps: number[] = []
    const serverError = fakeFetch(async () => jsonResponse({}, 500))
    const failing = clientWith(serverError, {
      retryAttempts: 3,
      retryBaseDelayMs: 100,
      sleep: async (ms: number) => {
        sleeps.push(ms)
      },
    })

    await expect(failing.call('x')).rejects.toMatchObject({
      name: 'FlickrApiError',
      status: 500,
    })
    expect(serverError).toHaveBeenCalledTimes(3)
    expect(sleeps).toEqual([100, 200])

    const rateLimited = fakeFetch(async () => jsonResponse({}, 429))
    await expect(clientWith(rateLimited, { retryAttempts: 2 }).call('x')).rejects.toMatchObject({
      status: 429,
    })
    expect(rateLimited).toHaveBeenCalledTimes(2)

    const networkError = fakeFetch(async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    })
    await expect(clientWith(networkError, { retryAttempts: 2 }).call('x')).rejects.toThrow(
      'ENOTFOUND',
    )
    expect(networkError).toHaveBeenCalledTimes(2)
  })

  it('never retries a named stat=fail refusal', async () => {
    const fetchImpl = fakeFetch(async () =>
      jsonResponse({ stat: 'fail', code: 100, message: 'Invalid API Key' }),
    )
    const client = clientWith(fetchImpl, { retryAttempts: 4 })

    await expect(client.call('x')).rejects.toThrow('Flickr 100: Invalid API Key')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('tolerates an exif refusal but propagates transport failures', async () => {
    const exifFail = fakeFetch(async () =>
      jsonResponse({ stat: 'fail', code: 2, message: 'Photo not found' }),
    )
    expect(await clientWith(exifFail).getExif('1')).toEqual([])

    const exifBody = fakeFetch(async () =>
      jsonResponse({ stat: 'ok', photo: { id: '1', exif: [{ tag: 'Make', raw: 'Canon' }] } }),
    )
    expect(await clientWith(exifBody).getExif('1')).toEqual([{ tag: 'Make', raw: 'Canon' }])

    const httpError = fakeFetch(async () => jsonResponse({}, 503))
    await expect(clientWith(httpError).getExif('1')).rejects.toMatchObject({ status: 503 })
  })

  it('picks the largest image size, ignoring videos and sizes without dimensions', async () => {
    const fetchImpl = fakeFetch(async () =>
      jsonResponse({
        stat: 'ok',
        sizes: {
          size: [
            { label: 'Small', media: 'photo', width: 240, height: 160, source: 'small' },
            { label: 'Original', media: 'photo', width: 4000, height: 3000, source: 'original' },
            { label: 'Sem dims', media: 'photo', source: 'no-dims' },
            { label: 'Vídeo', media: 'video', width: 9999, height: 9999, source: 'video' },
          ],
        },
      }),
    )

    expect(await clientWith(fetchImpl).getLargestSize('1')).toEqual({ url: 'original' })

    const noSizes = fakeFetch(async () => jsonResponse({ stat: 'ok', sizes: { size: [] } }))
    expect(await clientWith(noSizes).getLargestSize('1')).toBeNull()

    const onlyUndimensioned = fakeFetch(async () =>
      jsonResponse({
        stat: 'ok',
        sizes: { size: [{ media: 'photo', source: 'no-dims' }] },
      }),
    )
    expect(await clientWith(onlyUndimensioned).getLargestSize('1')).toBeNull()
  })
})
