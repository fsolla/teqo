import { statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  bahiaSecondRoundTotals,
  getBahiaSecondRoundUnit,
  secondRoundAdversaryCapturePct,
  secondRoundLulaShares,
  secondRoundPotentialOf,
  secondRoundSollaShareOfLula,
} from '@/lib/bahiaSecondRound'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import { classifySecondRoundRole } from '@/lib/secondRoundRole'

const ARTIFACT_PATH = join(process.cwd(), 'src/lib/electionAggregates/bahia-second-round-2026.json')

/**
 * Pins the committed 2º-turno artifact to the municipality catalog and to the
 * audited TSE totals. Drift here means the city report would print the wrong
 * swing silently — regenerate with `pnpm build:second-round`.
 */
describe('bahia 2º-turno artifact', () => {
  it('covers exactly the municipality catalog slugs', () => {
    const missing = municipalityCatalog.filter((entry) => !getBahiaSecondRoundUnit(entry.slug))
    expect(missing.map((entry) => entry.slug)).toEqual([])
    expect(municipalityCatalog).toHaveLength(435)
  })

  it('matches the audited Bahia totals (TSE, 1º turno 2026 + 2022)', () => {
    expect(bahiaSecondRoundTotals.lula26).toBe(5_664_771)
    expect(bahiaSecondRoundTotals.adversary26).toBe(2_442_585)
    expect(bahiaSecondRoundTotals.solla26).toBe(152_049)
    expect(bahiaSecondRoundTotals.lula22).toBe(5_873_081)
    expect(bahiaSecondRoundTotals.adversary22).toBe(2_047_599)
    expect(bahiaSecondRoundTotals.solla22).toBe(128_968)
  })

  it('stores the role the shared rule reclassifies', () => {
    for (const entry of municipalityCatalog) {
      const unit = getBahiaSecondRoundUnit(entry.slug)!
      expect(unit.role).toBe(
        classifySecondRoundRole({
          dLula: unit.dLula,
          dSolla: unit.dSolla,
          solla26: unit.solla26,
        }),
      )
    }
  })

  it('points Salvador to mobilization in the 4 ZE the analysis called out, and defends 16/4', () => {
    for (const zone of [19, 15, 9, 12]) {
      expect(getBahiaSecondRoundUnit(`salvador-ze-${zone}`)!.role).toBe('prioridade')
    }
    for (const zone of [16, 4]) {
      expect(getBahiaSecondRoundUnit(`salvador-ze-${zone}`)!.role).toBe('defesa')
    }
  })

  it('computes X₁/X₂ with the same formula as the public /potencial scenario', () => {
    const unit = getBahiaSecondRoundUnit('salvador-ze-1')!
    const potential = secondRoundPotentialOf(unit)!
    expect(potential.x1).toBe(unit.comparecimento26 - unit.lula26 - unit.adversary26)
    expect(potential.x2).toBe(unit.aptos26 - unit.lula26 - unit.adversary26)
    expect(potential.x1).toBe(6_557)
    expect(potential.x2).toBe(22_231)
  })

  it('exposes the swing lenses (shares, Solla ratio, adversary capture)', () => {
    const feira = getBahiaSecondRoundUnit('feira-de-santana')!
    const shares = secondRoundLulaShares(feira)
    expect(shares.deltaPp).toBeCloseTo(-4.57, 1)
    expect(secondRoundSollaShareOfLula(feira)).toBeCloseTo(1.31, 1)
    expect(secondRoundAdversaryCapturePct(feira)).toBeCloseTo(82.4, 1)
    // Capture is undefined where Lula did not lose votes.
    const expansion = municipalityCatalog
      .map((entry) => getBahiaSecondRoundUnit(entry.slug)!)
      .find((unit) => unit.dLula >= 0)!
    expect(secondRoundAdversaryCapturePct(expansion)).toBeNull()
  })

  it('returns null for an unknown slug', () => {
    expect(getBahiaSecondRoundUnit('nao-existe')).toBeNull()
  })

  it('stays under the committed artifact byte budget', () => {
    const { size } = statSync(ARTIFACT_PATH)
    // Measured at ~287 KB with 435 units; budget with headroom, not a precise pin.
    expect(size).toBeLessThan(400 * 1024)
  })
})
