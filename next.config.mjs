import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
