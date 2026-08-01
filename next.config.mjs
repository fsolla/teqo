import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const allowedImageHost = process.env.NEXT_PUBLIC_SITE_URL || 'https://jorgesolla.com.br'

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // OH6/OH*: compile-time ops hybrid flag (mother spec). Inlined for client
  // islands; absent/`0` keeps CI identical to main.
  env: {
    OPS_HYBRID: process.env.OPS_HYBRID ?? '',
  },
  images: {
    remotePatterns: [new URL(`${allowedImageHost}/**`)],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
