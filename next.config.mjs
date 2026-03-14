import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_BASE_PATH || ''
const assetPrefix = process.env.NEXT_ASSET_PREFIX || basePath || undefined
const allowedImageHost = process.env.NEXT_PUBLIC_SITE_URL

const nextConfig = {
  basePath,
  assetPrefix,
  images: {
    remotePatterns: [new URL(`${allowedImageHost}/**`)],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
