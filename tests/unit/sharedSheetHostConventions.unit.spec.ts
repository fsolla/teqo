import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Miss #52 (2026-07-30): the municipalities list hydrated ~125 idle Drawer
// roots (25 rows × 5 sheet controls) and prod tripped React #130 — CSS
// `display:none` does not remove hydration cost. The fix pattern is ONE
// shared Drawer per list surface via `CampaignListSheetProvider`, with cell
// bodies portaled into it. The provider reached the municípios mobile cards
// and this pass (2026-07-31) the three chip-relation lists (lideranças,
// dobradinhas, assessores) — this guard keeps the next chip-cell table from
// mounting sheet overlays providerless.
describe('shared sheet host for chip-relation cells (miss #52)', () => {
  const componentRoots = ['src/components', 'src/app'] as const
  const chipCellUsage = /<MunicipalityPortfolioCell|<LeadershipStateDeputyRelationCell/
  /**
   * Composition wrappers that render a chip cell but are not list surfaces
   * themselves: the guard's contract is "the TABLE that mounts chip cells is
   * wrapped in the provider", and these wrappers are mounted inside such a
   * table (their owning page holds the provider — checked for the C116 people
   * list like the dobradinhas one).
   */
  const cellWrapperFiles = new Set([
    // C128 people list; C116 batch-chip expansion state — the owning page
    // holds the provider.
    'src/components/campaign/people/PeopleMunicipalityCell.tsx',
    // B155+ route-backed column adapters — the owning pages hold the provider.
    'src/components/campaign/leadership/LeadershipMunicipalitiesColumnCell.tsx',
    'src/components/campaign/leadership/LeadershipStateDeputiesColumnCell.tsx',
  ])

  it('wraps every chip-relation table in CampaignListSheetProvider', () => {
    const offenders: string[] = []

    for (const root of componentRoots) {
      const files = readdirSync(resolve(process.cwd(), root), {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
        .map((entry) => resolve(entry.parentPath, entry.name))

      for (const file of files) {
        const source = readFileSync(file, 'utf8')
        if (!chipCellUsage.test(source)) continue
        if (source.includes('CampaignListSheetProvider')) continue
        if (cellWrapperFiles.has(relative(process.cwd(), file))) continue
        offenders.push(relative(process.cwd(), file))
      }
    }

    expect(
      offenders,
      'chip-relation cells open sheet overlays on coarse pointers — wrap the table in CampaignListSheetProvider (one shared Drawer per list)',
    ).toEqual([])
  })
})
