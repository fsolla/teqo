import { NextResponse } from 'next/server'

import { potentialSectionQuerySchema } from '@/lib/schemas/sectionPotentialQuery'
import { findPotentialSection } from '@/lib/sectionPotential'
import {
  checkContentEventRateLimit,
  contentEventClientKey,
} from '@/utilities/content/contentEventRateLimit'
import { loadPotentialUfShard } from '@/utilities/potencialSections'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const dynamic = 'force-dynamic'

/**
 * S46 — the raw numbers of one polling section (TSE 1st round 2026): identity
 * plus aptos/comparecimento/Lula/Flávio/válidos. The percentages are computed
 * by the shared pure module on the client, so the panel and the story image
 * can never drift. Unknown UF or section answers 404 — the page's honest
 * "não encontramos essa seção" state; a section with no valid votes is a 200
 * whose `no-data` verdict belongs to the pure calculator.
 */
const json = (body: unknown, status = 200, cacheable = false): NextResponse =>
  NextResponse.json(body, {
    status,
    headers: cacheable
      ? { 'Cache-Control': 'public, max-age=86400' }
      : { 'Cache-Control': 'no-store' },
  })

export const GET = async (request: Request): Promise<NextResponse> => {
  if (!isSameOriginRequest(request)) return json({ ok: false, error: 'origin' }, 403)

  const clientKey = contentEventClientKey(request.headers)
  if (!checkContentEventRateLimit(clientKey && `potencial:${clientKey}`)) {
    return json({ ok: false, error: 'rate-limited' }, 429)
  }

  const parsed = potentialSectionQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) return json({ ok: false, error: 'query' }, 400)

  const shard = await loadPotentialUfShard(parsed.data.uf)
  if (!shard) return json({ ok: false, error: 'not-found' }, 404)

  const section = findPotentialSection(shard, {
    municipalityCode: parsed.data.codigo,
    zone: parsed.data.zona,
    section: parsed.data.secao,
  })
  if (!section) return json({ ok: false, error: 'not-found' }, 404)

  return json({ ok: true, section }, 200, true)
}
