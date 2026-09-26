/**
 * C231 — thin Flickr API client for the photo-archive ingestion: plain `fetch`
 * (injectable), a proper `User-Agent`, sequential pacing and retry with
 * backoff for transient failures only. There is no SDK dependency: the account
 * is read-only and the endpoints used here answer JSON.
 *
 * `stat=fail` answers (auth, permission, not-found) are terminal and surface
 * as `FlickrApiError` with the Flickr code — the receipt names them. The API
 * key travels in the query string (Flickr's own model for public reads) and
 * never enters logs or receipts.
 */

const FLICKR_API_URL = 'https://api.flickr.com/services/rest/'
export const FLICKR_USER_AGENT = 'teqo-flickr-archive/1.0 (+https://jorgesolla1313.com.br)'
const FLICKR_LISTING_PAGE_SIZE = 500
/** Flickr documents 3,600 calls/hour — one call per second stays under it. */
const FLICKR_PACING_MS = 1000

/** One listing call carries every metadata field the archive needs. */
export const FLICKR_PHOTO_EXTRAS =
  'description,date_taken,date_upload,license,owner_name,tags,geo,media,url_o,path_alias'

const FLICKR_TIMEOUT_MS = 30_000
const FLICKR_RETRY_ATTEMPTS = 4
const FLICKR_RETRY_BASE_DELAY_MS = 1_000

class FlickrApiError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string | number | null, status?: number | null }} [options]
   */
  constructor(message, { code = null, status = null } = {}) {
    super(message)
    this.name = 'FlickrApiError'
    this.code = code
    this.status = status
  }
}

/** HTTP 429/5xx and thrown network/timeout errors retry; `stat=fail` never does. */
const isRetryable = (error) => {
  if (error instanceof FlickrApiError) {
    return error.status === 429 || (error.status !== null && error.status >= 500)
  }
  return true
}

/**
 * @param {{
 *   apiKey?: string,
 *   fetchImpl?: typeof fetch,
 *   pacingMs?: number,
 *   retryAttempts?: number,
 *   retryBaseDelayMs?: number,
 *   timeoutMs?: number,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 * }} [options]
 */
export const createFlickrClient = ({
  apiKey,
  fetchImpl = fetch,
  pacingMs = FLICKR_PACING_MS,
  retryAttempts = FLICKR_RETRY_ATTEMPTS,
  retryBaseDelayMs = FLICKR_RETRY_BASE_DELAY_MS,
  timeoutMs = FLICKR_TIMEOUT_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
} = {}) => {
  const key = typeof apiKey === 'string' ? apiKey.trim() : ''
  if (key === '') {
    throw new Error('FLICKR_API_KEY ausente — a ingestão exige a chave da API do Flickr.')
  }

  let lastCallAt = null

  const pace = async () => {
    if (lastCallAt !== null && pacingMs > 0) {
      const wait = lastCallAt + pacingMs - now()
      if (wait > 0) await sleep(wait)
    }
    lastCallAt = now()
  }

  /**
   * One REST call with pacing + transient retry. Returns the parsed body with
   * `stat: 'ok'`; anything else is a named refusal.
   */
  const call = async (method, params = {}) => {
    for (let attempt = 1; ; attempt += 1) {
      await pace()
      try {
        const url = new URL(FLICKR_API_URL)
        url.searchParams.set('method', method)
        url.searchParams.set('api_key', key)
        url.searchParams.set('format', 'json')
        url.searchParams.set('nojsoncallback', '1')
        for (const [name, value] of Object.entries(params)) {
          if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(name, String(value))
          }
        }

        const response = await fetchImpl(url.toString(), {
          headers: { 'User-Agent': FLICKR_USER_AGENT, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) {
          throw new FlickrApiError(`HTTP ${response.status}`, { status: response.status })
        }
        const body = await response.json()
        if (body?.stat !== 'ok') {
          throw new FlickrApiError(
            `Flickr ${body?.code ?? '?'}: ${body?.message ?? 'erro desconhecido'}`,
            { code: body?.code ?? null },
          )
        }
        return body
      } catch (error) {
        if (attempt >= retryAttempts || !isRetryable(error)) throw error
        await sleep(retryBaseDelayMs * 2 ** (attempt - 1))
      }
    }
  }

  return {
    call,

    /** One page of the account photostream (`flickr.people.getPhotos`). */
    listPhotosPage: async ({
      userId,
      page = 1,
      perPage = FLICKR_LISTING_PAGE_SIZE,
      extras = FLICKR_PHOTO_EXTRAS,
    }) => {
      const body = await call('flickr.people.getPhotos', {
        user_id: userId,
        page,
        per_page: perPage,
        extras,
      })
      return body.photos ?? { page: 1, pages: 1, per_page: perPage, total: 0, photo: [] }
    },

    /** One page of the account albums (`flickr.photosets.getList`). */
    listPhotoSets: async ({ userId, page = 1, perPage = FLICKR_LISTING_PAGE_SIZE }) => {
      const body = await call('flickr.photosets.getList', {
        user_id: userId,
        page,
        per_page: perPage,
      })
      return body.photosets ?? { page: 1, pages: 1, per_page: perPage, total: 0, photoset: [] }
    },

    /** One page of an album's photos (`flickr.photosets.getPhotos`). */
    listPhotoSetPage: async ({ userId, albumId, page = 1, perPage = FLICKR_LISTING_PAGE_SIZE }) => {
      const body = await call('flickr.photosets.getPhotos', {
        user_id: userId,
        photoset_id: albumId,
        page,
        per_page: perPage,
      })
      return body.photoset ?? { page: 1, pages: 1, per_page: perPage, photo: [] }
    },

    /**
     * `flickr.photos.getExif` — tolerant by contract: a photo without readable
     * EXIF is not a failure (the receipt records the gap). HTTP/network errors
     * still propagate.
     */
    getExif: async (photoId) => {
      try {
        const body = await call('flickr.photos.getExif', { photo_id: photoId })
        return body.photo?.exif ?? []
      } catch (error) {
        if (error instanceof FlickrApiError && error.status === null) return []
        throw error
      }
    },

    /**
     * Largest available image from `flickr.photos.getSizes` — the documented
     * fallback when the listing has no `url_o`. Sizes without usable
     * dimensions are ignored (never a NaN winner); null when nothing usable is
     * returned.
     */
    getLargestSize: async (photoId) => {
      const body = await call('flickr.photos.getSizes', { photo_id: photoId })
      const sizes = Array.isArray(body.sizes?.size) ? body.sizes.size : []
      let largest = null
      let largestArea = -1
      for (const size of sizes) {
        if (size?.media !== 'photo' || typeof size.source !== 'string') continue
        const area = Number(size.width) * Number(size.height)
        if (!Number.isFinite(area) || area <= largestArea) continue
        largest = size
        largestArea = area
      }
      return largest ? { url: largest.source } : null
    },
  }
}
