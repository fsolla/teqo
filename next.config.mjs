import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [new URL('https://jorgesolla.com.br/**')],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
