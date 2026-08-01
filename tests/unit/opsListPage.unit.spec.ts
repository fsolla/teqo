import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

<<<<<<< HEAD
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
=======
const MUNICIPIOS_PAGE = join(process.cwd(), 'src/app/(campaign)/campanha/(app)/municipios/page.tsx')
const ASSESSORES_PAGE = join(process.cwd(), 'src/app/(campaign)/campanha/(app)/assessores/page.tsx')
>>>>>>> 7ebf891 (CL5: Assessores CampaignTable + URL canónico + OpsListPage)

describe('OpsListPage municipios tracer (CL3)', () => {
  it('wires LIST_UNIFIED behind OpsListPage on the municipios route', () => {
    expectOpsListPageWiring(readFileSync(ROUTE_PAGES.municipios, 'utf8'))
  })
})

<<<<<<< HEAD
describe('OpsListPage CL4 routes', () => {
  it.each(['liderancas', 'dobradinhas', 'demandas'] as const)(
    'wires LIST_UNIFIED behind OpsListPage on the %s route',
    (route) => {
      expectOpsListPageWiring(readFileSync(ROUTE_PAGES[route], 'utf8'))
    },
  )
=======
describe('OpsListPage assessores (CL5)', () => {
  it('wires LIST_UNIFIED behind OpsListPage on the assessores route', () => {
    const source = readFileSync(ASSESSORES_PAGE, 'utf8')
    expect(source).toContain('resolveListUnifiedEnabled')
    expect(source).toContain('OpsListPage')
    expect(source).toContain('resolveAdvisorListUrl')
    expect(source).toContain("from '@/components/campaign/shared/OpsListPage'")
  })
>>>>>>> 7ebf891 (CL5: Assessores CampaignTable + URL canónico + OpsListPage)
})
