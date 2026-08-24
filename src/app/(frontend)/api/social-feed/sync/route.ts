import { REVALIDATE_SOCIAL_FEED_TAG } from '@/utilities/revalidateRequest'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'
import { INSTAGRAM_SYNC_TIMEOUT_MS, syncInstagramFeed } from '@/utilities/socialFeed/instagramSync'
import configPromise from '@payload-config'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

/**
 * "Tentar sincronizar de novo" — the admin status panel's retry button
 * (`InstagramSyncStatusPanel`). Runs one Instagram sync from the persisted
 * global settings, writes the outcome status, busts the `social-feed` cache
 * so the public board reflects the new snapshot, and returns the status the
 * panel renders immediately.
 *
 * Auth: admin session (the `payload-token` cookie via `payload.auth`, `users`
 * collection only — same gate as the global's `read`) plus the same-origin
 * CSRF guard every cookie-authenticated JSON route uses. The token and the
 * Graph API are never reachable without an admin session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || user.collection !== 'users') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const outcome = await syncInstagramFeed(payload, {
      signal: AbortSignal.timeout(INSTAGRAM_SYNC_TIMEOUT_MS),
    })
    // `syncInstagramFeed` returns `{ ok: false, status: {} }` only when
    // `isInstagramFeedConfigured` is false (no token/ID) — no snapshot/status
    // was persisted, so no cache to bust.
    if (!outcome.ok && Object.keys(outcome.status).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Instagram não configurado — informe token e ID da conta.' },
        { status: 400 },
      )
    }
    revalidateTag(REVALIDATE_SOCIAL_FEED_TAG)
    return NextResponse.json({ ok: outcome.ok, status: outcome.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'Falha interna ao sincronizar' }, { status: 500 })
  }
}
