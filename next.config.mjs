import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const allowedImageHost = process.env.NEXT_PUBLIC_SITE_URL || 'https://jorgesolla.com.br'

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  ...(process.env.NEXT_OUTPUT_STANDALONE === '1' ? { output: 'standalone' } : {}),
  images: {
    remotePatterns: [
      new URL(`${allowedImageHost}/**`),
      // YouTube video thumbnails (campaign home content board, S2) come from
      // the platform's CDN — see `src/utilities/socialFeed/youtubeFeed.ts`.
      new URL('https://i.ytimg.com/**'),
      // Instagram media thumbnails (campaign home content board, S3) come from
      // the Graph API's CDN (hosts vary per region) —
      // see `src/utilities/socialFeed/instagramFeed.ts`. Plain objects (not
      // `new URL`) on purpose: the URL form pins `search: ''`, and Graph API
      // media URLs carry a signed query string — the optimizer would reject
      // them with 400 even on an allowed host.
      { protocol: 'https', hostname: '*.cdninstagram.com', pathname: '/**' },
      // Meta moved Instagram Graph API media to `*.fbcdn.net`
      // (`instagram.<pop>.fna.fbcdn.net`, `scontent.<pop>.fna.fbcdn.net`) —
      // without this the optimizer answers 400 and every IG cover breaks.
      { protocol: 'https', hostname: '**.fbcdn.net', pathname: '/**' },
      // e2e-only: the YouTube/Instagram stubs (tests/e2e/*-stub.mjs) serve the
      // fixture thumbnails locally so specs never touch the real network.
      { protocol: 'http', hostname: 'localhost', pathname: '/thumbs/**' },
    ],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
