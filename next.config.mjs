import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const allowedImageHost = process.env.NEXT_PUBLIC_SITE_URL || 'https://jorgesolla.com.br'

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // OH6/OH* + CL*: compile-time flags inlined for client islands; absent/`0`
  // keeps CI identical to main.
  env: {
    OPS_HYBRID: process.env.OPS_HYBRID ?? '',
    LIST_UNIFIED: process.env.LIST_UNIFIED ?? '',
  },
  images: {
    remotePatterns: [new URL(`${allowedImageHost}/**`)],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
