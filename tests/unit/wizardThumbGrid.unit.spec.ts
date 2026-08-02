import { describe, expect, it } from 'vitest'

import { municipalitySignalTypeMetaByType } from '@/lib/municipalitySignalTypeMeta'
import {
  politicalTrendWizardMeta,
  politicalTrendWizardMetaByStatus,
} from '@/lib/politicalTrendWizardMeta'
import { politicalTrendStatuses } from '@/lib/schemas/municipality'
import { municipalitySignalTypes } from '@/lib/schemas/municipalityUpdate'
import { WIZARD_THUMB_TILE_GRID_CLASS, wizardSignalTypesThumbOrder } from '@/lib/wizardThumbGrid'

describe('wizardThumbGrid', () => {
  it('pins thumb-zone grid classes for mobile RTL fill and desktop LTR grid', () => {
    expect(WIZARD_THUMB_TILE_GRID_CLASS).toContain('list-none')
    expect(WIZARD_THUMB_TILE_GRID_CLASS).toContain('[direction:rtl]')
    expect(WIZARD_THUMB_TILE_GRID_CLASS).toContain('place-content-end')
    expect(WIZARD_THUMB_TILE_GRID_CLASS).toContain('md:[direction:ltr]')
  })

  it('orders signal types with urgency types first in DOM for thumb reach', () => {
    expect(wizardSignalTypesThumbOrder[0]).toBe('invasao')
    expect(wizardSignalTypesThumbOrder[1]).toBe('esfriamento')
    expect(wizardSignalTypesThumbOrder).toHaveLength(municipalitySignalTypes.length)
    expect(new Set(wizardSignalTypesThumbOrder)).toEqual(new Set(municipalitySignalTypes))
  })
})

describe('municipalitySignalTypeMeta icon colors', () => {
  it('covers every signal type with a semantic icon class', () => {
    for (const type of municipalitySignalTypes) {
      const entry = municipalitySignalTypeMetaByType[type]
      expect(entry?.iconClassName.length).toBeGreaterThan(0)
    }

    expect(municipalitySignalTypeMetaByType.invasao.iconClassName).toContain('destructive')
    expect(municipalitySignalTypeMetaByType.esfriamento.iconClassName).toContain('sky')
    expect(municipalitySignalTypeMetaByType.visita_adversario.iconClassName).toContain('amber')
    expect(municipalitySignalTypeMetaByType.proposta_broker.iconClassName).toContain('teal')
    expect(municipalitySignalTypeMetaByType.outro.iconClassName).toContain('muted-foreground')
  })
})

describe('politicalTrendWizardMeta icon colors', () => {
  it('covers every trend with icon-only semantic classes', () => {
    expect(politicalTrendWizardMeta).toHaveLength(politicalTrendStatuses.length)

    for (const status of politicalTrendStatuses) {
      const entry = politicalTrendWizardMetaByStatus[status]
      expect(entry.iconClassName.length).toBeGreaterThan(0)
      expect(entry.icon).toBeTruthy()
    }

    expect(politicalTrendWizardMetaByStatus.favoravel.iconClassName).toContain('estimate-confirmed')
    expect(politicalTrendWizardMetaByStatus.desfavoravel.iconClassName).toContain('destructive')
    expect(politicalTrendWizardMetaByStatus.neutra.iconClassName).toContain('muted-foreground')
  })
})
