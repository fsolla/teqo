import { buildCalendarEventIcs } from '@/lib/calendarEvent'
import { shareLinkIcsUid } from '@/lib/shareLink'
import { getCachedPublishedShareLinkBySlug } from '@/utilities/shareLinkReads'

type RouteParams = { type: string }

/**
 * S29 — the `.ics` download of an announcement link, served under the slug's
 * own namespace (`/<slug>/evento.ics`, a static sibling of `[category]`). It
 * fails closed to 404 for a draft/unknown value or a link without a start date
 * — never an empty/broken file. The `type` param name is the `[type]` folder
 * contract; its value is the share-link slug.
 */
export async function GET(_request: Request, { params }: { params: Promise<RouteParams> }) {
  const { type: slug } = await params
  const link = await getCachedPublishedShareLinkBySlug(slug, 0)()
  if (!link) return new Response(null, { status: 404 })

  const body = buildCalendarEventIcs({
    uid: shareLinkIcsUid(slug),
    title: link.title,
    description: link.description,
    location: link.location,
    startsAt: link.startsAt,
    endsAt: link.endsAt,
    updatedAt: link.updatedAt,
  })
  if (!body) return new Response(null, { status: 404 })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'public, no-cache',
    },
  })
}
