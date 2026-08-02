import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { opsListDomains, opsListRegistry } from '@/lib/opsListRegistry/opsListRegistry'

const routePagePath = (routePath: string): string => {
  const segment = routePath.replace(/^\/campanha\//, '')
  return join(process.cwd(), 'src/app/(campaign)/campanha/(app)', segment, 'page.tsx')
}

const expectOpsListFactoryWiring = (source: string) => {
  expect(source).toContain('resolveListUnifiedEnabled')
  expect(source).toContain('OpsListPage')
  expect(source).toContain("from '@/components/campaign/shared/OpsListPage'")
  expect(source).toContain("from '@/lib/opsListRegistry/opsListFlag'")
}

describe('opsListRegistry v1 routes (CL8)', () => {
  it.each(opsListDomains)('%s has a route page that delegates to the list factory', (slug) => {
    const { routePath } = opsListRegistry[slug]
    const pagePath = routePagePath(routePath)

    expect(existsSync(pagePath), `missing route file for ${slug}: ${pagePath}`).toBe(true)
    expectOpsListFactoryWiring(readFileSync(pagePath, 'utf8'))
  })

  it('maps every registry routePath under /campanha/', () => {
    for (const slug of opsListDomains) {
      expect(opsListRegistry[slug].routePath).toMatch(/^\/campanha\/[a-z]+$/)
      expect(routePagePath(opsListRegistry[slug].routePath)).toContain(
        `/campanha/(app)/${slug}/page.tsx`,
      )
    }
  })
})
