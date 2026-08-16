import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const allowedImageHost = process.env.NEXT_PUBLIC_SITE_URL || 'https://jorgesolla.com.br'

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  ...(process.env.NEXT_OUTPUT_STANDALONE === '1' ? { output: 'standalone' } : {}),
  images: {
    remotePatterns: [new URL(`${allowedImageHost}/**`)],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
