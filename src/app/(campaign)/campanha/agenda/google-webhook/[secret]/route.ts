import config from '@payload-config'
import { getPayload } from 'payload'

import { isGooglePushNotificationValid } from '@/lib/googleCalendarPushNotification'
import {
  loadGoogleCalendarSyncConfig,
  recordGoogleCalendarSyncError,
  runCampaignCalendarSync,
} from '@/utilities/googleCalendarSync'

type RouteContext = {
  params: Promise<{ secret: string }>
}

// C115: the push channel is validated against the live config on every
// delivery — an explicit marker per repo convention (dynamic campaign routes
// declare it) so a cached handler can never accept a stale channel.
export const dynamic = 'force-dynamic'

/** Google re-delivers failed notifications — a lean pass needs the extra headroom. */
export const maxDuration = 60

const notFoundResponse = () =>
  new Response('Não encontrado.', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })

export const GET = async (): Promise<Response> => notFoundResponse()

/**
 * C115 — Google Calendar push notifications (events.watch). Google POSTs a
 * bare "something changed" ping with channel headers and NO event data — the
 * handler validates the origin (URL secret + channel id + resource id +
 * channel token, all constant-time) and then runs the same bidirectional
 * reconciliation every other trigger runs. A valid ping answers 200 even if
 * the pass fails (the failure lands in the `paused` state and the local
 * auto-retry paths recover) — retries would only replicate work.
 */
export const POST = async (request: Request, context: RouteContext): Promise<Response> => {
  const { secret } = await context.params

  const payload = await getPayload({ config })

  // Intentional admin bypass: the endpoint is unauthenticated by design
  // (Google delivers by URL); the secret + channel identity are the
  // credential, validated below — fail-closed.
  const doc = await loadGoogleCalendarSyncConfig(payload)
  if (
    !isGooglePushNotificationValid({
      secret,
      channelId: request.headers.get('x-goog-channel-id'),
      resourceId: request.headers.get('x-goog-resource-id'),
      channelToken: request.headers.get('x-goog-channel-token'),
      config: {
        pushChannelSecret: doc?.pushChannelSecret ?? null,
        pushChannelId: doc?.pushChannelId ?? null,
        pushChannelResourceId: doc?.pushChannelResourceId ?? null,
      },
    })
  ) {
    return notFoundResponse()
  }

  const resourceState = request.headers.get('x-goog-resource-state')

  // `sync` is the channel-creation ping — nothing to reconcile yet.
  // `not_exists` means the watched calendar itself is gone — record it so
  // the staff sees why the sync stopped, instead of a silent no-op.
  if (resourceState === 'not_exists') {
    await recordGoogleCalendarSyncError(
      payload,
      'O calendário configurado não existe mais no Google.',
    )
    return new Response('OK', { status: 200 })
  }
  if (resourceState === 'sync') {
    return new Response('OK', { status: 200 })
  }

  await runCampaignCalendarSync(payload, { reason: 'webhook' })
  return new Response('OK', { status: 200 })
}
