import type { MetadataRoute } from 'next'

import { isStagingSite } from '@/lib/siteEnvironment'

/**
 * Staging is a throwaway validation target — it must never be indexed
 * (OPS103). Production keeps the allow-all behavior it had implicitly (there
 * was no robots.txt before OPS103).
 */
export default function robots(): MetadataRoute.Robots {
  if (isStagingSite()) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    }
  }

  return {
    rules: { userAgent: '*', allow: '/' },
  }
}
