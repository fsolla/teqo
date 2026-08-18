import 'server-only'

import type { SocialFeedSetting } from '@/payload-types'
import { REVALIDATE_SOCIAL_FEED_TAG } from '@/utilities/revalidateRequest'
import configPromise from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'

const YOUTUBE_API_BASE_URL =
  process.env.YOUTUBE_API_BASE_URL ?? 'https://www.googleapis.com/youtube/v3'

export const YOUTUBE_MAX_RESULTS_CAP = 50

export type YouTubeVideo = {
  id: string
  title: string
  publishedAt: string
  thumbnailUrl?: string
  viewCount?: number
}

export type LoadYouTubeFeedArgs = {
  apiKey: string
  channelId: string
  maxResults: number
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
  baseUrl?: string
}

export type YouTubeFeedResult = {
  channelId: string
  videos: YouTubeVideo[]
}

/**
 * Parses the `search.list` response into videos (id, title, publishedAt and
 * best thumbnail). Throws on a protocol-level violation (no `items` array);
 * individual malformed items are skipped, but a video without an id or a
 * publish date is dropped — it could not be placed in the recency merge.
 */
export const parseYouTubeSearchResponse = (json: unknown): YouTubeVideo[] => {
  if (!json || typeof json !== 'object') {
    throw new Error('Resposta de busca do YouTube inválida')
  }
  const items = (json as { items?: unknown }).items
  if (!Array.isArray(items)) {
    throw new Error('Resposta de busca do YouTube sem lista de itens')
  }

  const videos: YouTubeVideo[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue

    const rawId = (item as { id?: unknown }).id
    const videoId =
      typeof rawId === 'object' && rawId !== null
        ? (rawId as { videoId?: unknown }).videoId
        : undefined
    if (typeof videoId !== 'string' || !videoId) continue

    const snippet = (item as { snippet?: unknown }).snippet
    if (typeof snippet !== 'object' || snippet === null) continue

    const rawSnippet = snippet as { title?: unknown; publishedAt?: unknown; thumbnails?: unknown }
    if (typeof rawSnippet.title !== 'string' || !rawSnippet.title) continue
    if (typeof rawSnippet.publishedAt !== 'string' || !rawSnippet.publishedAt) continue

    videos.push({
      id: videoId,
      title: rawSnippet.title,
      publishedAt: rawSnippet.publishedAt,
      thumbnailUrl: pickThumbnailUrl(rawSnippet.thumbnails),
    })
  }
  return videos
}

/** Best available thumbnail of a search snippet: maxres, then high, then medium. */
export const pickThumbnailUrl = (thumbnails: unknown): string | undefined => {
  if (typeof thumbnails !== 'object' || thumbnails === null) return undefined
  const byQuality = thumbnails as { maxres?: unknown; high?: unknown; medium?: unknown }
  for (const quality of ['maxres', 'high', 'medium'] as const) {
    const entry = byQuality[quality]
    if (typeof entry === 'object' && entry !== null) {
      const url = (entry as { url?: unknown }).url
      if (typeof url === 'string' && url) return url
    }
  }
  return undefined
}

/**
 * Parses the `videos.list?part=statistics` response into a videoId → viewCount
 * map. `viewCount` arrives as a string; a missing or non-numeric value is
 * dropped so the card renders without the counter instead of with a lie.
 */
export const parseYouTubeVideosResponse = (json: unknown): Map<string, number> => {
  const counts = new Map<string, number>()
  if (!json || typeof json !== 'object') return counts

  const items = (json as { items?: unknown }).items
  if (!Array.isArray(items)) return counts

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const rawItem = item as { id?: unknown; statistics?: unknown }
    if (typeof rawItem.id !== 'string' || !rawItem.id) continue
    if (typeof rawItem.statistics !== 'object' || rawItem.statistics === null) continue

    const viewCount = (rawItem.statistics as { viewCount?: unknown }).viewCount
    const parsed = typeof viewCount === 'string' ? Number(viewCount) : Number.NaN
    if (Number.isFinite(parsed) && parsed >= 0) counts.set(rawItem.id, parsed)
  }
  return counts
}

/**
 * pt-BR short count the way the platform spells it: "987", "12,4 mil",
 * "1,2 mi", "1 bi" — one decimal with a comma, no trailing zero. A value that
 * rounds across the next unit reads as that unit ("1 mi" at 999,95 mil).
 */
export const formatYouTubeViews = (count: number): string => {
  if (count < 1_000) return String(count)

  const tenthsOf = (base: number): number => Math.round((count / base) * 10)
  const formatTenths = (tenths: number, suffix: string): string => {
    const whole = Math.floor(tenths / 10)
    const decimal = tenths % 10
    return `${decimal === 0 ? String(whole) : `${whole},${decimal}`} ${suffix}`
  }

  if (count < 1_000_000) {
    const tenths = tenthsOf(1_000)
    return tenths < 10_000 ? formatTenths(tenths, 'mil') : '1 mi'
  }
  if (count < 1_000_000_000) {
    const tenths = tenthsOf(1_000_000)
    return tenths < 10_000 ? formatTenths(tenths, 'mi') : '1 bi'
  }
  return formatTenths(tenthsOf(1_000_000_000), 'bi')
}

/**
 * Keeps only the videos whose ids are not excluded, in API order (newest
 * first), capped at `maxItems`. The board skips an excluded video — it never
 * counts as "the latest".
 */
export const eligibleYouTubeVideos = (
  videos: YouTubeVideo[],
  excludedIds: string[],
  maxItems: number,
): YouTubeVideo[] => videos.filter((video) => !excludedIds.includes(video.id)).slice(0, maxItems)

/**
 * Fetches the latest public videos of a channel: `search.list` for the recent
 * video ids/metadata, then `videos.list` for the view counts. Throws on any
 * non-2xx response, network failure or malformed JSON so the caller can fall
 * back to the persisted snapshot (fail-closed).
 */
export const loadYouTubeFeed = async ({
  apiKey,
  channelId,
  maxResults,
  fetchImpl = fetch,
  baseUrl = YOUTUBE_API_BASE_URL,
}: LoadYouTubeFeedArgs): Promise<YouTubeVideo[]> => {
  const searchParams = new URLSearchParams({
    part: 'snippet',
    channelId,
    type: 'video',
    order: 'date',
    maxResults: String(Math.min(Math.max(maxResults, 1), YOUTUBE_MAX_RESULTS_CAP)),
    key: apiKey,
  })

  const searchResponse = await fetchImpl(`${baseUrl}/search?${searchParams}`)
  if (!searchResponse.ok) {
    throw new Error(`YouTube search falhou com status ${searchResponse.status}`)
  }
  const videos = parseYouTubeSearchResponse(await searchResponse.json())
  if (videos.length === 0) return []

  const videosParams = new URLSearchParams({
    part: 'statistics',
    id: videos.map((video) => video.id).join(','),
    key: apiKey,
  })
  const statisticsResponse = await fetchImpl(`${baseUrl}/videos?${videosParams}`)
  if (!statisticsResponse.ok) {
    throw new Error(`YouTube statistics falhou com status ${statisticsResponse.status}`)
  }

  const viewCounts = parseYouTubeVideosResponse(await statisticsResponse.json())
  return videos.map((video) => {
    const viewCount = viewCounts.get(video.id)
    return viewCount === undefined ? video : { ...video, viewCount }
  })
}

const excludedYouTubeIds = (settings: SocialFeedSetting): string[] =>
  (settings.excludedItems ?? [])
    .filter((item) => item.platform === 'youtube')
    .map((item) => item.itemId)
    .filter(Boolean)

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
const persistYouTubeSnapshot = async (payload: Payload, videos: YouTubeVideo[]): Promise<void> => {
  const database = payload.db.drizzle
  const json = JSON.stringify(videos)
  const updated = await database.execute(sql`
    UPDATE "social_feed_settings"
    SET "youtube_feed_snapshot" = ${json}::jsonb, "updated_at" = now()
    WHERE "id" = (SELECT "id" FROM "social_feed_settings" ORDER BY "id" LIMIT 1)
  `)
  if (!updated?.rowCount) {
    await database.execute(sql`
      INSERT INTO "social_feed_settings" ("youtube_feed_snapshot", "created_at", "updated_at")
      VALUES (${json}::jsonb, now(), now())
    `)
  }
}

/**
 * Cached feed for the campaign home content board: `null` when the feed is off
 * (kill switch, platform toggle or missing credentials), otherwise the latest
 * eligible videos. A successful fetch persists the RAW list (pre-exclusion) as
 * the global snapshot; a failed fetch falls back to that snapshot with the
 * current exclusions applied — so a new exclusion works even while the API is
 * down, and the page never breaks. Busted by the global's `afterChange` (tag
 * `social-feed`); the per-entry `revalidate` keeps new uploads appearing
 * without an admin edit.
 */
export const getYouTubeFeed = unstable_cache(
  async (): Promise<YouTubeFeedResult | null> => {
    const payload = await getPayload({ config: configPromise })
    const settings = await payload.findGlobal({
      slug: 'social-feed-settings',
      depth: 0,
    })

    if (
      settings.enabled === false ||
      settings.youtubeEnabled === false ||
      !settings.youtubeApiKey ||
      !settings.youtubeChannelId
    ) {
      return null
    }

    const channelId = settings.youtubeChannelId
    const maxItems = Math.min(Math.max(settings.youtubeMaxItems ?? 3, 1), 5)
    const excludedIds = excludedYouTubeIds(settings)

    try {
      const videos = await loadYouTubeFeed({
        apiKey: settings.youtubeApiKey,
        channelId,
        maxResults: Math.min(maxItems + 10, YOUTUBE_MAX_RESULTS_CAP),
      })
      await persistYouTubeSnapshot(payload, videos)
      return { channelId, videos: eligibleYouTubeVideos(videos, excludedIds, maxItems) }
    } catch {
      const snapshot = settings.youtubeFeedSnapshot as unknown
      if (!Array.isArray(snapshot)) return { channelId, videos: [] }
      return { channelId, videos: eligibleYouTubeVideos(snapshot, excludedIds, maxItems) }
    }
  },
  ['youtube-feed'],
  { tags: [REVALIDATE_SOCIAL_FEED_TAG], revalidate: 300 },
)
