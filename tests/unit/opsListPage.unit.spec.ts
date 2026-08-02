import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROUTE_PAGES = {
  municipios: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/municipios/page.tsx'),
  liderancas: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/liderancas/page.tsx'),
  dobradinhas: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/dobradinhas/page.tsx'),
  demandas: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/demandas/page.tsx'),
  assessores: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/assessores/page.tsx'),
  territorios: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/territorios/page.tsx'),
  apoiadores: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/apoiadores/page.tsx'),
  organizacoes: join(process.cwd(), 'src/app/(campaign)/campanha/(app)/organizacoes/page.tsx'),
} as const

const expectOpsListPageWiring = (source: string) => {
  expect(source).toContain('OpsListPage')
  expect(source).toContain("from '@/components/campaign/shared/OpsListPage'")
  expect(source).not.toContain('resolveListUnifiedEnabled')
  expect(source).not.toContain('opsListFlag')
}

describe('OpsListPage route wiring', () => {
  it.each(Object.keys(ROUTE_PAGES) as Array<keyof typeof ROUTE_PAGES>)(
    'always renders OpsListPage on the %s route',
    (route) => {
      const source = readFileSync(ROUTE_PAGES[route], 'utf8')
      expectOpsListPageWiring(source)
      if (route === 'assessores') {
        expect(source).toContain('resolveAdvisorListUrl')
      }
    },
  )
})
