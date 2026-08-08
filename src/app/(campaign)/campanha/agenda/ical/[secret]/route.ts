import config from '@payload-config'
import { getPayload } from 'payload'

import {
  generateICalFeed,
  loadFeedActivities,
  loadMunicipalityNames,
  resolveFeedCreatorAccess,
} from '@/utilities/calendarFeed'

type RouteContext = {
  params: Promise<{ secret: string }>
}

const notFoundResponse = () =>
  new Response('Feed não encontrado.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })

export const GET = async (_request: Request, context: RouteContext): Promise<Response> => {
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

    return new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return notFoundResponse()
  }
}
