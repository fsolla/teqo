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
      // the platform's CDN — see `src/utilities/youtubeFeed.ts`.
      new URL('https://i.ytimg.com/**'),
      // e2e-only: the YouTube stub (tests/e2e/youtube-stub.mjs) serves the
      // fixture thumbnails locally so specs never touch the real network.
      { protocol: 'http', hostname: 'localhost', pathname: '/thumbs/**' },
    ],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
