import { resolveRevalidateTag } from '@/utilities/revalidateRequest'
import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

/**
 * On-demand revalidation endpoint for content written straight to the database
 * (e.g. `pnpm db:seed:posts`, Onda 0 migrations), which bypasses the Payload
 * `afterChange` hooks that normally call `revalidateTag`. Public reads use
 * `unstable_cache` tags — bust them here after direct-DB writes.
 *
 * Secured by `REVALIDATE_SECRET` (set in Vercel for prod). Examples:
 *   curl -X POST "https://<prod-domain>/api/revalidate" \
 *     -H "x-revalidate-secret: $REVALIDATE_SECRET"
 *   curl -X POST "https://<prod-domain>/api/revalidate?tag=global_privacy-policy" \
 *     -H "x-revalidate-secret: $REVALIDATE_SECRET"
 */

const SECRET_HEADER = 'x-revalidate-secret'

const isValidSecret = (provided: string | null, expected: string): boolean => {
  if (!provided) return false

  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)

  // `timingSafeEqual` requires equal-length buffers; unequal lengths never match.
  if (providedBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

type ParseBodyTagResult = { tag?: string } | { invalid: true }

const parseBodyTag = async (request: Request): Promise<ParseBodyTagResult> => {
  const contentType = request.headers.get('content-type')
  if (!contentType?.includes('application/json')) return {}

  try {
    const body: unknown = await request.json()
    if (body && typeof body === 'object' && 'tag' in body) {
      if (typeof body.tag !== 'string') return { invalid: true }
      return { tag: body.tag }
    }
    return {}
  } catch {
    return { invalid: true }
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.REVALIDATE_SECRET

  if (!expected) {
    return NextResponse.json(
      { revalidated: false, error: 'REVALIDATE_SECRET is not configured' },
      { status: 500 },
    )
  }

  const provided =
    request.headers.get(SECRET_HEADER) ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null

  if (!isValidSecret(provided, expected)) {
    return NextResponse.json({ revalidated: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const queryTag = url.searchParams.get('tag')
  const bodyResult =
    queryTag != null && queryTag !== '' ? {} : await parseBodyTag(request)

  if ('invalid' in bodyResult) {
    return NextResponse.json({ revalidated: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const resolved = resolveRevalidateTag(queryTag, bodyResult.tag)

  if (!resolved.ok) {
    return NextResponse.json({ revalidated: false, error: resolved.error }, { status: 400 })
  }

  revalidateTag(resolved.tag)

  return NextResponse.json({ revalidated: true, tag: resolved.tag, now: Date.now() })
}
