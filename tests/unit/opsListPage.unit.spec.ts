import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const MUNICIPIOS_PAGE = join(process.cwd(), 'src/app/(campaign)/campanha/(app)/municipios/page.tsx')

describe('OpsListPage municipios tracer (CL3)', () => {
  it('wires LIST_UNIFIED behind OpsListPage on the municipios route', () => {
    const source = readFileSync(MUNICIPIOS_PAGE, 'utf8')
    expect(source).toContain('resolveListUnifiedEnabled')
    expect(source).toContain('OpsListPage')
    expect(source).toContain("from '@/components/campaign/shared/OpsListPage'")
    expect(source).toContain("from '@/lib/opsListRegistry/opsListFlag'")
  })
})
