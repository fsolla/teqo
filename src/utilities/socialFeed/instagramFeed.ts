import 'server-only'

import type { SocialFeedSetting } from '@/payload-types'
import { REVALIDATE_SOCIAL_FEED_TAG } from '@/utilities/revalidateRequest'
import configPromise from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'

const INSTAGRAM_API_BASE_URL = process.env.INSTAGRAM_API_BASE_URL ?? 'https://graph.instagram.com'

export const INSTAGRAM_MAX_RESULTS_CAP = 50

type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'REEL' | 'CAROUSEL_ALBUM'

export type InstagramPost = {
  id: string
  caption: string | null
  mediaType: InstagramMediaType
  permalink: string
  thumbnailUrl?: string
  timestamp: string
}

export type InstagramFeedResult = {
  username: string | null
  posts: InstagramPost[]
}

export type LoadInstagramFeedArgs = {
  accessToken: string
  userId: string
  maxResults: number
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
  baseUrl?: string
}

export type LoadInstagramFeedResult = InstagramFeedResult & {
  /** Present only when the fetch had to refresh the token mid-flight. */
  refreshedAccessToken?: string
}

const MEDIA_FIELDS = [
  'id',
  'caption',
  'media_type',
  'media_url',
  'permalink',
  'thumbnail_url',
  'timestamp',
  'children{media_url,thumbnail_url}',
].join(',')

/**
 * Best thumbnail of a media item, by type: images use the media URL, videos
 * and reels the thumbnail (never the mp4), carousels the first child that
 * carries either. A missing value reads as undefined and the card renders
 * without a cover (already supported) instead of a broken image.
 */
export const pickInstagramThumbnail = (item: {
  media_type?: unknown
  media_url?: unknown
  thumbnail_url?: unknown
  children?: unknown
}): string | undefined => {
  const urlOf = (value: unknown): string | undefined =>
    typeof value === 'string' && value ? value : undefined

  const mediaType = item.media_type
  if (mediaType === 'IMAGE') return urlOf(item.media_url)
  if (mediaType === 'VIDEO' || mediaType === 'REEL') return urlOf(item.thumbnail_url)

  if (mediaType === 'CAROUSEL_ALBUM') {
    const children = item.children as { data?: unknown } | undefined
    if (typeof children === 'object' && children !== null && Array.isArray(children.data)) {
      for (const child of children.data) {
        if (typeof child !== 'object' || child === null) continue
        const rawChild = child as { media_url?: unknown; thumbnail_url?: unknown }
        const url = urlOf(rawChild.media_url) ?? urlOf(rawChild.thumbnail_url)
        if (url) return url
      }
    }
  }
  return undefined
}

/**
 * Parses a `/media` response into posts. Throws on a protocol-level violation
 * (no `data` array); individual malformed items are skipped, but an item
 * without an id, a timestamp or a permalink is dropped — it could not be
 * placed in the recency merge nor opened on the platform. A null caption is
 * kept: captionless posts (e.g. grid mosaics) still show with a fallback
 * title so the assessoria can exclude them item by item.
 */
export const parseInstagramMediaResponse = (json: unknown): InstagramPost[] => {
  if (!json || typeof json !== 'object') {
    throw new Error('Resposta de mídia do Instagram inválida')
  }
  const data = (json as { data?: unknown }).data
  if (!Array.isArray(data)) {
    throw new Error('Resposta de mídia do Instagram sem lista de itens')
  }

  const posts: InstagramPost[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue

    const rawItem = item as {
      id?: unknown
      caption?: unknown
      media_type?: unknown
      permalink?: unknown
      timestamp?: unknown
    }
    if (typeof rawItem.id !== 'string' || !rawItem.id) continue
    if (typeof rawItem.permalink !== 'string' || !rawItem.permalink) continue
    if (typeof rawItem.timestamp !== 'string' || !rawItem.timestamp) continue

    posts.push({
      id: rawItem.id,
      caption: typeof rawItem.caption === 'string' ? rawItem.caption : null,
      mediaType: (rawItem.media_type as InstagramMediaType) ?? 'IMAGE',
      permalink: rawItem.permalink,
      timestamp: rawItem.timestamp,
      thumbnailUrl: pickInstagramThumbnail(rawItem),
    })
  }
  return posts
}

/**
 * Keeps only the posts whose ids are not excluded, in API order (newest
 * first), capped at `maxItems`. The board skips an excluded post — it never
 * counts as "the latest" (grid mosaics get filtered this way).
 */
export const eligibleInstagramPosts = (
  posts: InstagramPost[],
  excludedIds: string[],
  maxItems: number,
): InstagramPost[] => posts.filter((post) => !excludedIds.includes(post.id)).slice(0, maxItems)

const jsonFrom = async (response: Response): Promise<unknown> => response.json()

/**
 * Fetches the username and the latest media of a Business/Creator profile:
 * `GET /{userId}` for the username, then `GET /{userId}/media` for the posts
 * (permalink, caption, thumbnail, timestamp). On any failure it attempts one
 * token refresh (`refresh_access_token` — only mints/refreshes Instagram
 * Login tokens; page tokens from Facebook Login error out and the caller
 * falls back to the snapshot) and retries once. Throws when the retry also
 * fails so the cached wrapper can fail closed.
 */
export const loadInstagramFeed = async ({
  accessToken,
  userId,
  maxResults,
  fetchImpl = fetch,
  baseUrl = INSTAGRAM_API_BASE_URL,
}: LoadInstagramFeedArgs): Promise<LoadInstagramFeedResult> => {
  const attempt = async (token: string): Promise<InstagramFeedResult> => {
    const userParams = new URLSearchParams({ fields: 'username', access_token: token })
    const userResponse = await fetchImpl(`${baseUrl}/${userId}?${userParams}`)
    if (!userResponse.ok) {
      throw new Error(`Instagram user falhou com status ${userResponse.status}`)
    }
    const userJson = (await jsonFrom(userResponse)) as { username?: unknown }
    const username = typeof userJson.username === 'string' ? userJson.username : null

    const mediaParams = new URLSearchParams({
      fields: MEDIA_FIELDS,
      limit: String(Math.min(Math.max(maxResults, 1), INSTAGRAM_MAX_RESULTS_CAP)),
      access_token: token,
    })
    const mediaResponse = await fetchImpl(`${baseUrl}/${userId}/media?${mediaParams}`)
    if (!mediaResponse.ok) {
      throw new Error(`Instagram media falhou com status ${mediaResponse.status}`)
    }

    return { username, posts: parseInstagramMediaResponse(await jsonFrom(mediaResponse)) }
  }

  try {
    return await attempt(accessToken)
  } catch {
    const refreshParams = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: accessToken,
    })
    const refreshResponse = await fetchImpl(`${baseUrl}/refresh_access_token?${refreshParams}`)
    if (!refreshResponse.ok) {
      throw new Error(`Instagram token refresh falhou com status ${refreshResponse.status}`)
    }
    const refreshJson = (await jsonFrom(refreshResponse)) as { access_token?: unknown }
    if (typeof refreshJson.access_token !== 'string' || !refreshJson.access_token) {
      throw new Error('Instagram token refresh sem novo token')
    }
    return {
      ...(await attempt(refreshJson.access_token)),
      refreshedAccessToken: refreshJson.access_token,
    }
  }
}

const excludedInstagramIds = (settings: SocialFeedSetting): string[] =>
  (settings.excludedItems ?? [])
    .filter((item) => item.platform === 'instagram')
    .map((item) => item.itemId)
    .filter(Boolean)

const isInstagramSnapshot = (value: unknown): value is { username?: unknown; posts?: unknown } =>
  typeof value === 'object' && value !== null

/**
 * Persists the raw feed as the global's snapshot column. Deliberately raw SQL
 * (`payload.db.drizzle`) instead of `payload.updateGlobal`: this runs INSIDE
 * `unstable_cache` during a page render, and Next 15.4 throws when
 * `revalidateTag` (the global's `afterChange` hook) fires inside a cached
 * function. Raw SQL bypasses hooks; the row is created on first write when the
 * admin has not saved the global yet (a serial id is assigned, so no id
 * assumption is made).
 *
 * Precondition: at most one `social_feed_settings` row exists. The UPDATE
 * targets the single row and the INSERT only fires when none exists; a
 * concurrent double-insert would need two writers racing the very first write
 * (the row is created by the first admin save or feed render) — accepted.
 */
const persistInstagramSnapshot = async (
  payload: Payload,
  snapshot: InstagramFeedResult,
): Promise<void> => {
  const database = payload.db.drizzle
  const json = JSON.stringify(snapshot)
  const updated = await database.execute(sql`
    UPDATE "social_feed_settings"
    SET "instagram_feed_snapshot" = ${json}::jsonb, "updated_at" = now()
    WHERE "id" = (SELECT "id" FROM "social_feed_settings" ORDER BY "id" LIMIT 1)
  `)
  if (!updated?.rowCount) {
    await database.execute(sql`
      INSERT INTO "social_feed_settings" ("instagram_feed_snapshot", "created_at", "updated_at")
      VALUES (${json}::jsonb, now(), now())
    `)
  }
}

/** Persists a refreshed token the same way as the snapshot (raw SQL, no hooks). */
const persistInstagramAccessToken = async (payload: Payload, token: string): Promise<void> => {
  await payload.db.drizzle.execute(sql`
    UPDATE "social_feed_settings"
    SET "instagram_access_token" = ${token}, "updated_at" = now()
    WHERE "id" = (SELECT "id" FROM "social_feed_settings" ORDER BY "id" LIMIT 1)
  `)
}

/**
 * Cached Instagram feed for the campaign home content board: `null` when the
 * feed is off (kill switch, platform toggle or missing credentials), otherwise
 * the latest eligible posts plus the profile username. A successful fetch
 * persists the RAW list (pre-exclusion) as the global snapshot; a failed fetch
 * falls back to that snapshot with the current exclusions applied — so a new
 * exclusion works even while the API is down, and the page never breaks.
 * Busted by the global's `afterChange` (tag `social-feed`); the per-entry
 * `revalidate` keeps new uploads appearing without an admin edit.
 */
export const getInstagramFeed = unstable_cache(
  async (): Promise<InstagramFeedResult | null> => {
    const payload = await getPayload({ config: configPromise })
    const settings = await payload.findGlobal({
      slug: 'social-feed-settings',
      depth: 0,
    })

    if (
      settings.enabled === false ||
      settings.instagramEnabled === false ||
      !settings.instagramAccessToken ||
      !settings.instagramUserId
    ) {
      return null
    }

    const maxItems = Math.min(Math.max(settings.instagramMaxItems ?? 3, 1), 5)
    const excludedIds = excludedInstagramIds(settings)

    try {
      const result = await loadInstagramFeed({
        accessToken: settings.instagramAccessToken,
        userId: settings.instagramUserId,
        maxResults: Math.min(maxItems + 10, INSTAGRAM_MAX_RESULTS_CAP),
      })
      await persistInstagramSnapshot(payload, { username: result.username, posts: result.posts })
      if (result.refreshedAccessToken) {
        await persistInstagramAccessToken(payload, result.refreshedAccessToken)
      }
      return {
        username: result.username,
        posts: eligibleInstagramPosts(result.posts, excludedIds, maxItems),
      }
    } catch {
      const snapshot = settings.instagramFeedSnapshot as unknown
      if (!isInstagramSnapshot(snapshot) || !Array.isArray(snapshot.posts)) {
        return { username: null, posts: [] }
      }
      return {
        username: typeof snapshot.username === 'string' ? snapshot.username : null,
        posts: eligibleInstagramPosts(snapshot.posts, excludedIds, maxItems),
      }
    }
  },
  ['instagram-feed'],
  { tags: [REVALIDATE_SOCIAL_FEED_TAG], revalidate: 300 },
)
