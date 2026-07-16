import { revalidatePostsListing } from '@/utilities/documents'
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

/**
 * On-demand revalidation endpoint for content written straight to the database
 * (e.g. `pnpm db:seed:posts`), which bypasses the Payload `afterChange` hooks
 * that normally call `revalidateTag('posts')`. Because every public post read
 * goes through the `posts`-tagged `unstable_cache` wrappers in
 * `src/utilities/posts.ts`, a single `revalidateTag('posts')` here busts the
 * home page, every listing route, and every article route at once.
 *
 * Secured by the `REVALIDATE_SECRET` env var (set it in Vercel for prod). Call:
 *   curl -X POST "https://<prod-domain>/api/revalidate" \
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

  revalidatePostsListing()

  return NextResponse.json({ revalidated: true, tag: 'posts', now: Date.now() })
}
