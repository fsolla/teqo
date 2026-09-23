import { isValidShareLinkSlug } from '@/lib/shareLink'
import { loadPublishedShareLinkLiveTarget } from '@/utilities/shareLinkReads'

export const dynamic = 'force-dynamic'

type RouteParams = { slug: string }

/**
 * S29 — the fresh read behind the announcement page's activation poll. It is
 * deliberately a route handler (not a server action): the poll must never carry
 * an RSC refresh of the route, or the open page would be re-rendered into the
 * live redirect the moment the team flags a destination. Fail-closed: an
 * invalid slug, an unpublished link or any read failure answers `{ target: null }`
 * — never a 5xx the client would have to interpret, and never a private field.
 */
export async function GET(_request: Request, { params }: { params: Promise<RouteParams> }) {
  const { slug } = await params

  const target = isValidShareLinkSlug(slug)
    ? await loadPublishedShareLinkLiveTarget(slug).catch(() => null)
    : null

  return Response.json(
    { target },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
