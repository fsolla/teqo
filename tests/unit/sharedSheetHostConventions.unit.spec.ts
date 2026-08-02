import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Miss #48 (public reopen of archive #52, 2026-07-30): the municipalities list
// hydrated ~125 idle Drawer roots and prod tripped React #130. Fix = ONE shared
// Drawer per list via `CampaignListSheetProvider`. Pass 5 hardens the guard:
// any file that mounts `variant="sheet"` must either wrap a provider or be an
// allowlisted leaf that is composed under a provider by its parent.

describe('shared sheet host for chip-relation cells (miss #48)', () => {
  const componentRoots = ['src/components', 'src/app'] as const
  const sheetVariant = /variant\s*=\s*["']sheet["']/
  /** Leaves that open sheets but are always composed under a provider parent. */
  const sheetLeafAllowlist = new Set([
    'src/components/campaign/municipality/MunicipalityListMobileCards.tsx',
    'src/components/campaign/shared/RelationChipCell.tsx',
    'src/components/campaign/shared/CampaignCellEditOverlay.tsx',
    'src/components/campaign/shared/MunicipalityPortfolioCell.tsx',
  ])

  it('wraps every sheet-variant surface in CampaignListSheetProvider (or allowlists the leaf)', () => {
    const offenders: string[] = []

    for (const root of componentRoots) {
      const files = readdirSync(resolve(process.cwd(), root), {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
        .map((entry) => resolve(entry.parentPath, entry.name))

      for (const file of files) {
        const rel = relative(process.cwd(), file)
        const source = readFileSync(file, 'utf8')
        if (!sheetVariant.test(source)) continue
        if (source.includes('CampaignListSheetProvider')) continue
        if (sheetLeafAllowlist.has(rel)) continue
        offenders.push(rel)
      }
    }

    expect(
      offenders,
      'sheet overlays need CampaignListSheetProvider (one shared Drawer) — add the provider or extend the leaf allowlist with a parent that already wraps',
    ).toEqual([])
  })
})
