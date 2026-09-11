// @vitest-environment node

import { matchRemotePattern } from 'next/dist/shared/lib/match-remote-pattern'
import { describe, expect, it } from 'vitest'

import { parseInstagramMediaResponse } from '@/utilities/socialFeed/instagramFeed'

import nextConfig from '../../next.config.mjs'

/**
 * Regression guard for the production incident of 2026-09-11: Instagram Graph
 * API media URLs come from Meta's CDN on `*.fbcdn.net`
 * (`instagram.<pop>.fna.fbcdn.net`, `scontent.<pop>.fna.fbcdn.net`), not only
 * from `*.cdninstagram.com` as the S3 implementation assumed. A media URL
 * outside `images.remotePatterns` makes the Next image optimizer answer
 * `400 "url" parameter is not allowed` and every Instagram card renders with a
 * broken cover. The e2e Instagram stub serves thumbnails from localhost (the
 * sandbox never reaches the real CDN), so it can never catch a missing real
 * host — this guard pins the allowlist against the hosts production serves.
 *
 * The fixtures carry the signed query string (`?stp=...&_nc_ohc=...&oe=...`)
 * the Graph API actually returns: a pattern declared with `new URL()` pins
 * `search: ''` and the matcher then rejects every signed URL even on an
 * allowed host.
 */
const remotePatterns = nextConfig.images?.remotePatterns ?? []

const isAllowed = (url: string): boolean =>
  remotePatterns.some((pattern) => matchRemotePattern(pattern, new URL(url)))

describe('next.config images.remotePatterns', () => {
  it.each([
    'https://instagram.fssa2-1.fna.fbcdn.net/v/t51.82787-15/798590021_n.jpg?stp=dst-jpg_e35_tt6&_nc_ohc=GhQvEtCG8Bk&oe=6AAA3F4E',
    'https://scontent.fsdu2-1.fna.fbcdn.net/v/t51.82787-15/798590021_n.jpg?stp=dst-jpg_e35_tt6&_nc_ohc=GhQvEtCG8Bk&oe=6AAA3F4E',
    'https://scontent.cdninstagram.com/v/t51.82787-15/798590021_n.jpg?stp=dst-jpg_e35_tt6&_nc_ohc=GhQvEtCG8Bk&oe=6AAA3F4E',
    'https://i.ytimg.com/vi/e2evideo001/hqdefault.jpg',
  ])('allows the real media CDN URL %s', (url) => {
    expect(isAllowed(url)).toBe(true)
  })

  it('keeps unrelated hosts out of the optimizer allowlist', () => {
    expect(isAllowed('https://evil.example.com/tracker.jpg')).toBe(false)
  })

  it('allows the thumbnail the Instagram parser emits from a real signed response', () => {
    const signed =
      'https://instagram.fssa2-1.fna.fbcdn.net/v/t51.82787-15/798590021_n.jpg?stp=dst-jpg_e35_tt6&_nc_ohc=GhQvEtCG8Bk&oe=6AAA3F4E'
    const posts = parseInstagramMediaResponse({
      data: [
        {
          id: 'seam-1',
          caption: null,
          media_type: 'IMAGE',
          media_url: signed,
          permalink: 'https://www.instagram.com/p/seam-1/',
          timestamp: '2026-09-11T10:00:00+00:00',
        },
      ],
    })
    const thumbnailUrl = posts[0]?.thumbnailUrl
    expect(thumbnailUrl).toBe(signed)
    expect(isAllowed(thumbnailUrl as string)).toBe(true)
  })
})
