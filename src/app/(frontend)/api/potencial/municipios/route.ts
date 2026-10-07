import { NextResponse } from 'next/server'

import { potentialMunicipiosQuerySchema } from '@/lib/schemas/sectionPotentialQuery'
import { listPotentialMunicipalities } from '@/lib/sectionPotential'
import {
  checkContentEventRateLimit,
  contentEventClientKey,
} from '@/utilities/content/contentEventRateLimit'
import { loadPotentialUfShard } from '@/utilities/potencialSections'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const dynamic = 'force-dynamic'

/**
 * S46 — the municípios of one UF for the title form's combobox. Public read of
 * committed TSE geography: same-origin, rate-limited like the other anonymous
 * JSON routes, strict query. The answer is lean (`code` + `name`), alphabetical
 * and cacheable for a day — the artifact only changes with a deploy.
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

  const parsed = potentialMunicipiosQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) return json({ ok: false, error: 'query' }, 400)

  const shard = await loadPotentialUfShard(parsed.data.uf)
  if (!shard) return json({ ok: false, error: 'not-found' }, 404)

  return json({ ok: true, municipalities: listPotentialMunicipalities(shard) }, 200, true)
}
