import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROUTE_PAGES = {
  municipios: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/municipios/page.tsx'),
  liderancas: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/liderancas/page.tsx'),
  dobradinhas: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/dobradinhas/page.tsx'),
  demandas: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/demandas/page.tsx'),
} as const

const expectOpsListPageWiring = (source: string) => {
  expect(source).toContain('resolveListUnifiedEnabled')
  expect(source).toContain('OpsListPage')
  expect(source).toContain("from '@/components/campaign/shared/OpsListPage'")
  expect(source).toContain("from '@/lib/opsListRegistry/opsListFlag'")
}

describe('OpsListPage municipios tracer (CL3)', () => {
  it('wires LIST_UNIFIED behind OpsListPage on the municipios route', () => {
    expectOpsListPageWiring(readFileSync(ROUTE_PAGES.municipios, 'utf8'))
  })
})

describe('OpsListPage CL4 routes', () => {
  it.each(['liderancas', 'dobradinhas', 'demandas'] as const)(
    'wires LIST_UNIFIED behind OpsListPage on the %s route',
    (route) => {
      expectOpsListPageWiring(readFileSync(ROUTE_PAGES[route], 'utf8'))
    },
  )
})
