import { NextResponse } from 'next/server'

import { getCardModel } from '@/lib/cardModels'
import { contentEventRequestSchema } from '@/lib/schemas/contentEvent'
import { getStateDeputyCard } from '@/lib/stateDeputyCatalog'
import {
  checkContentEventRateLimit,
  contentEventClientKey,
} from '@/utilities/content/contentEventRateLimit'
import { recordContentEvent } from '@/utilities/content/contentEventWrite'
import { getPublishedContentPieceBySlug } from '@/utilities/content/contentPieceReads'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const dynamic = 'force-dynamic'

/**
 * C213/S32 — the public anonymous beacon of the Central de Conteúdos and of the
 * personalized cards. The visitor's browser fires one event (abertura, download,
 * compartilhar WhatsApp/link; the card download) and forgets it: every response
 * is silent and the client never reads it.
 *
 * There is no cookie and no session here, so there is nothing to authorize —
 * the same-origin check and the in-memory limiter are bar-raisers against a
 * third-party page or a trivial loop, never a security boundary. Each variant
 * has its own public gate: the piece writes nothing when the slug does not
 * resolve to a PUBLISHED piece, and the card writes nothing when the model id
 * or the state-deputy slug is not in the committed catalogs. Fail soft end to
 * end: a malformed body, a throttled client, a read failure or a write failure
 * never produce an error the page has to handle.
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const

/** The largest body a beacon can carry — anything bigger is not ours. */
const MAX_BODY_BYTES = 4 * 1024

const silentResponse = (status: number): NextResponse =>
  new NextResponse(null, { status, headers: NO_STORE })

/**
 * Reads the body with a hard byte ceiling, streaming and aborting as soon as
 * the ceiling is crossed — a chunked body without `content-length` cannot make
 * the route buffer unbounded input. `null` means "refused".
 */
const readBoundedBody = async (request: Request): Promise<string | null> => {
  const body = request.body
  if (!body) return ''

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      bytes += value.byteLength
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } catch {
    await reader.cancel().catch(() => undefined)
    return null
  }
}

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isSameOriginRequest(request)) return silentResponse(403)

  const rawBody = await readBoundedBody(request)
  if (rawBody === null) return silentResponse(400)

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return silentResponse(400)
  }

  const parsed = contentEventRequestSchema.safeParse(body)
  if (!parsed.success) return silentResponse(400)

  if (!checkContentEventRateLimit(contentEventClientKey(request.headers))) {
    return silentResponse(204)
  }

  // S32 — the card download: the model and the state deputy are validated
  // against the committed catalogs; the route never trusts an arbitrary id.
  if ('cardModelId' in parsed.data) {
    const model = getCardModel(parsed.data.cardModelId)
    if (!model) return silentResponse(400)

    // S38 — the card opening: the catalogue item routed the visitor to the
    // studio; there is no state deputy yet (the picker lives in the studio).
    if (parsed.data.type === 'abertura') {
      await recordContentEvent({
        type: parsed.data.type,
        subjectType: 'card',
        subjectId: model.id,
      })
      return silentResponse(204)
    }

    const requestedDeputySlug = parsed.data.stateDeputySlug
    let variant: string | null = null
    if (model.stateDeputyPicker === true) {
      const deputy = requestedDeputySlug ? getStateDeputyCard(requestedDeputySlug) : undefined
      if (!deputy) return silentResponse(400)
      variant = deputy.slug
    } else if (requestedDeputySlug) {
      return silentResponse(400)
    }

    await recordContentEvent({
      type: parsed.data.type,
      subjectType: 'card',
      subjectId: model.id,
      variant,
    })
    return silentResponse(204)
  }

  const piece = await getPublishedContentPieceBySlug(parsed.data.pieceSlug).catch(() => null)
  if (!piece) return silentResponse(204)

  await recordContentEvent({
    type: parsed.data.type,
    subjectType: 'peca',
    subjectId: String(piece.id),
  })

  return silentResponse(204)
}
