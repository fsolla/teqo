import 'server-only'

import type { SocialFeedSetting } from '@/payload-types'
import type { PostgresTransactionDatabase } from '@/utilities/postgresTransactionLocks'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

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
  /** Deadline for the Graph API calls (hook-triggered sync must not hang a save). */
  signal?: AbortSignal
}

export type LoadInstagramFeedResult = InstagramFeedResult & {
  /** Present only when the fetch had to refresh the token mid-flight. */
  refreshedAccessToken?: string
}

/**
 * API-level failure of the Instagram Graph API: carries the HTTP status and
 * the parsed `{ error: { message, type } }` body when present, so
 * `describeInstagramError` can turn it into product language (invalid token
 * vs wrong user id vs API down) for the admin sync-status panel.
 */
export class InstagramApiError extends Error {
  readonly status: number | undefined
  readonly apiMessage: string | null
  readonly apiType: string | null

  constructor(
    status: number | undefined,
    apiMessage: string | null,
    apiType: string | null,
    message: string,
  ) {
    super(message)
    this.name = 'InstagramApiError'
    this.status = status
    this.apiMessage = apiMessage
    this.apiType = apiType
  }
}

const parseApiErrorBody = async (
  response: Response,
): Promise<{ message: string | null; type: string | null }> => {
  try {
    const body = (await response.json()) as { error?: { message?: unknown; type?: unknown } } | null
    const error = body?.error
    if (typeof error !== 'object' || error === null) return { message: null, type: null }
    return {
      message: typeof error.message === 'string' && error.message ? error.message : null,
      type: typeof error.type === 'string' && error.type ? error.type : null,
    }
  } catch {
    return { message: null, type: null }
  }
}

const apiErrorFrom = async (response: Response): Promise<InstagramApiError> => {
  const { message, type } = await parseApiErrorBody(response)
  return new InstagramApiError(
    response.status,
    message,
    type,
    `Instagram API falhou com status ${response.status}`,
  )
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
  signal,
}: LoadInstagramFeedArgs): Promise<LoadInstagramFeedResult> => {
  const attempt = async (token: string): Promise<InstagramFeedResult> => {
    const userParams = new URLSearchParams({ fields: 'username', access_token: token })
    const userResponse = await fetchImpl(`${baseUrl}/${userId}?${userParams}`, { signal })
    if (!userResponse.ok) {
      throw await apiErrorFrom(userResponse)
    }
    const userJson = (await jsonFrom(userResponse)) as { username?: unknown }
    const username = typeof userJson.username === 'string' ? userJson.username : null

    const mediaParams = new URLSearchParams({
      fields: MEDIA_FIELDS,
      limit: String(Math.min(Math.max(maxResults, 1), INSTAGRAM_MAX_RESULTS_CAP)),
      access_token: token,
    })
    const mediaResponse = await fetchImpl(`${baseUrl}/${userId}/media?${mediaParams}`, { signal })
    if (!mediaResponse.ok) {
      throw await apiErrorFrom(mediaResponse)
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
    const refreshResponse = await fetchImpl(`${baseUrl}/refresh_access_token?${refreshParams}`, {
      signal,
    })
    if (!refreshResponse.ok) {
      throw await apiErrorFrom(refreshResponse)
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

/**
 * Operational state of the Instagram sync, persisted in the global's
 * `instagram_sync_status` column and shown by the admin status panel:
 * `lastSyncAt`/`postCount` are the last SUCCESSFUL sync; `error`/`errorAt`
 * the last failure. A failure overwrites the success fields on purpose — the
 * panel shows either state, never both (draft cenas 1/2).
 */
export type InstagramSyncStatus = {
  lastSyncAt?: string
  postCount?: number
  error?: string
  errorAt?: string
}

export const successInstagramSyncStatus = (postCount: number): InstagramSyncStatus => ({
  lastSyncAt: new Date().toISOString(),
  postCount,
})

export const failedInstagramSyncStatus = (error: string): InstagramSyncStatus => ({
  error,
  errorAt: new Date().toISOString(),
})

const isTokenError = (error: InstagramApiError): boolean =>
  error.apiType === 'OAuthException' ||
  /(expired|invalid|revoked|token|session)/i.test(error.apiMessage ?? '')

/**
 * True when the API message points at a bad user id rather than a bad token.
 * Requires "user" AND "id" together (or an explicit "object with id ... does
 * not exist") — a single "user" alone is NOT enough, because real token
 * rejections read "the user must be logged in" / "the user has changed their
 * password", and those must stay on the token correction, not the ID one.
 */
const isInvalidUserIdMessage = (message: string): boolean =>
  /(?=.*\buser\b)(?=.*\bid\b)/i.test(message) ||
  /\bid\b[\s\S]*\b(?:does not exist|cannot find)\b/i.test(message)

const isAbortError = (cause: unknown): boolean =>
  cause instanceof Error && cause.name === 'AbortError'

/**
 * Turns a sync failure into product language for the admin status panel: the
 * assessoria must know WHY the board has no Instagram cards and what to do
 * (the S3 fail-closed silence is the bug this exists to fix). Token errors
 * carry the correction — regenerate via Instagram Login, never Facebook
 * Login (the Graph API refresh endpoint rejects FB-issued page tokens).
 */
export const describeInstagramError = (cause: unknown): string => {
  if (isAbortError(cause)) {
    return 'A sincronização demorou demais para responder (a API do Instagram não respondeu a tempo). Tente novamente.'
  }
  if (cause instanceof InstagramApiError) {
    if (cause.status === 400 && isInvalidUserIdMessage(cause.apiMessage ?? '')) {
      return 'O ID do usuário não foi reconhecido pela Graph API. Confira se é o ID numérico da conta Business/Creator.'
    }
    if (typeof cause.status === 'number' && cause.status >= 400 && cause.status < 500) {
      if (isTokenError(cause)) {
        return 'O token do Instagram foi recusado pela Graph API — está inválido/expirado ou foi emitido via Facebook Login (a Graph API só aceita tokens gerados pelo Instagram Login). Gere um novo token de longa duração pelo Instagram Login e atualize o campo acima.'
      }
      return 'A Graph API recusou a solicitação. Confira o token e o ID do usuário configurados.'
    }
    return 'A Graph API está indisponível no momento. Tente novamente em alguns minutos.'
  }
  if (cause instanceof TypeError) {
    return 'Não foi possível falar com a API do Instagram (rede indisponível).'
  }
  return 'Erro inesperado ao sincronizar o Instagram.'
}

/**
 * Database seam for the raw-SQL persists. The default is the pool
 * (`payload.db.drizzle`); the hook-triggered sync passes the transaction-bound
 * database (`getPostgresTransactionDatabase`, S11) so the write lands inside
 * the global save's transaction — writing the same row from a second pool
 * connection while the save holds its row lock deadlocks on that lock.
 *
 * Owner is `PostgresTransactionDatabase` (`postgresTransactionLocks.ts`);
 * this alias keeps the historical import path stable — prefer the owner type
 * for new code.
 * @deprecated Use `PostgresTransactionDatabase` directly.
 */
export type InstagramPersistDatabase = PostgresTransactionDatabase

const countAffected = (result: unknown): number | null | undefined =>
  (result as { rowCount?: number | null } | undefined)?.rowCount

/**
 * Persists the sync status the same way as the snapshot — deliberately raw
 * SQL instead of `payload.updateGlobal`: this runs INSIDE `unstable_cache`
 * during a page render, and Next 15.4 throws when `revalidateTag` (the
 * global's `afterChange` hook) fires inside a cached function. Same
 * precondition as the snapshot: at most one `social_feed_settings` row
 * exists; the INSERT only fires when none does.
 */
export const persistInstagramSyncStatus = async (
  payload: Payload,
  status: InstagramSyncStatus,
  database: InstagramPersistDatabase | null = null,
): Promise<void> => {
  const db = database ?? payload.db.drizzle
  const json = JSON.stringify(status)
  const updated = await db.execute(sql`
    UPDATE "social_feed_settings"
    SET "instagram_sync_status" = ${json}::jsonb, "updated_at" = now()
    WHERE "id" = (SELECT "id" FROM "social_feed_settings" ORDER BY "id" LIMIT 1)
  `)
  if (!countAffected(updated)) {
    await db.execute(sql`
      INSERT INTO "social_feed_settings" ("instagram_sync_status", "created_at", "updated_at")
      VALUES (${json}::jsonb, now(), now())
    `)
  }
}

/** True when the Instagram feed is armed to call the Graph API. */
export const isInstagramFeedConfigured = (settings: SocialFeedSetting): boolean =>
  settings.enabled !== false &&
  settings.instagramEnabled !== false &&
  Boolean(settings.instagramAccessToken) &&
  Boolean(settings.instagramUserId)

/**
 * Persists the raw feed as the global's snapshot column. Deliberately raw SQL
 * instead of `payload.updateGlobal`: this runs INSIDE `unstable_cache` during
 * a page render, and Next 15.4 throws when `revalidateTag` (the global's
 * `afterChange` hook) fires inside a cached function. Raw SQL bypasses hooks;
 * the row is created on first write when the admin has not saved the global
 * yet (a serial id is assigned, so no id assumption is made).
 *
 * Precondition: at most one `social_feed_settings` row exists. The UPDATE
 * targets the single row and the INSERT only fires when none exists; a
 * concurrent double-insert would need two writers racing the very first write
 * (the row is created by the first admin save or feed render) — accepted.
 */
export const persistInstagramSnapshot = async (
  payload: Payload,
  snapshot: InstagramFeedResult,
  database: InstagramPersistDatabase | null = null,
): Promise<void> => {
  const db = database ?? payload.db.drizzle
  const json = JSON.stringify(snapshot)
  const updated = await db.execute(sql`
    UPDATE "social_feed_settings"
    SET "instagram_feed_snapshot" = ${json}::jsonb, "updated_at" = now()
    WHERE "id" = (SELECT "id" FROM "social_feed_settings" ORDER BY "id" LIMIT 1)
  `)
  if (!countAffected(updated)) {
    await db.execute(sql`
      INSERT INTO "social_feed_settings" ("instagram_feed_snapshot", "created_at", "updated_at")
      VALUES (${json}::jsonb, now(), now())
    `)
  }
}

/** Persists a refreshed token the same way as the snapshot (raw SQL, no hooks). */
export const persistInstagramAccessToken = async (
  payload: Payload,
  token: string,
  database: InstagramPersistDatabase | null = null,
): Promise<void> => {
  const db = database ?? payload.db.drizzle
  await db.execute(sql`
    UPDATE "social_feed_settings"
    SET "instagram_access_token" = ${token}, "updated_at" = now()
    WHERE "id" = (SELECT "id" FROM "social_feed_settings" ORDER BY "id" LIMIT 1)
  `)
}
