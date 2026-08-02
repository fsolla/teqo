import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const allowedImageHost = process.env.NEXT_PUBLIC_SITE_URL || 'https://jorgesolla.com.br'

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // CL*: compile-time flag inlined for client islands; absent/`0` keeps legacy list shells.
  env: {
    LIST_UNIFIED: process.env.LIST_UNIFIED ?? '',
  },
  images: {
    remotePatterns: [new URL(`${allowedImageHost}/**`)],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
