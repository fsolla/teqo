import config from '@payload-config'
import { getPayload } from 'payload'

import {
  buildICalFeedResponse,
  generateICalFeed,
  loadFeedActivities,
  loadMunicipalityNames,
  resolveFeedCreatorAccess,
} from '@/utilities/calendarFeed'

type RouteContext = {
  params: Promise<{ secret: string }>
}

// C113: the feed must always render against the live database (a feed whose
// value is "new commitments appear without re-subscribing"). Explicit marker
// per repo convention — every dynamic campaign route declares it, and it pins
// the intent against any future default flip in Next's route caching.
export const dynamic = 'force-dynamic'

const notFoundResponse = () =>
  new Response('Feed não encontrado.', {
    status: 404,
    // C113: a revoked/unknown feed must never become a heuristically cacheable
    // 404 in a shared cache — `no-store` keeps the fail-closed revocation
    // contract from eroding at the CDN layer.
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })

export const GET = async (request: Request, context: RouteContext): Promise<Response> => {
  const { secret } = await context.params

  if (!secret || secret.length < 32) {
    return notFoundResponse()
  }

  const payload = await getPayload({ config })

  try {
    // Intentional admin bypass: the feed endpoint is unauthenticated (Google
    // Calendar subscribes by URL); the secret slug is the credential, and
    // creator access is re-evaluated below via resolveFeedCreatorAccess.
    const feeds = await payload.find({
      collection: 'calendarFeed',
      depth: 1,
      limit: 1,
      pagination: false,
      where: { secretSlug: { equals: secret } },
      overrideAccess: true,
    })

    const feed = feeds.docs[0]
    if (!feed) {
      return notFoundResponse()
    }

    if (feed.revokedAt) {
      return notFoundResponse()
    }

    const access = await resolveFeedCreatorAccess(payload, feed)
    if (!access.accessible) {
      return notFoundResponse()
    }

    const activities = await loadFeedActivities(payload, feed, access.municipalityIds)

    const municipalityIds = activities
      .map((a) => (typeof a.municipality === 'number' ? a.municipality : a.municipality?.id))
      .filter((id): id is number => id !== undefined)

    const municipalityNames = await loadMunicipalityNames(payload, [...new Set(municipalityIds)])

    const icalContent = generateICalFeed(activities, feed.label, municipalityNames)

    return buildICalFeedResponse(icalContent, activities, feed, request)
  } catch {
    return notFoundResponse()
  }
}
