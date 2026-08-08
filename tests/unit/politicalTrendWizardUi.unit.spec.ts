import { describe, expect, it } from 'vitest'

import {
  politicalTrendWizardMeta,
  politicalTrendWizardMetaByStatus,
} from '@/lib/politicalTrendWizardMeta'
import {
  resolveWizardTrendNoteDestination,
  selectablePoliticalTrendStatuses,
  WIZARD_TREND_UNREGISTERED_TITLE,
  wizardTrendChoiceStepTitle,
} from '@/lib/politicalTrendWizardUi'
import { politicalTrendStatuses } from '@/lib/schemas/municipality'

describe('politicalTrendWizardUi', () => {
  it('titles the choice step from the current status', () => {
    expect(wizardTrendChoiceStepTitle(null)).toBe(WIZARD_TREND_UNREGISTERED_TITLE)
    expect(wizardTrendChoiceStepTitle('favoravel')).toBe('Tendência Favorável')
  })

  it('filters out the current trend from selectable options', () => {
    expect(selectablePoliticalTrendStatuses(null)).toEqual(politicalTrendStatuses)
    expect(selectablePoliticalTrendStatuses('neutra')).toEqual(['favoravel', 'desfavoravel'])
    expect(selectablePoliticalTrendStatuses('desfavoravel')).toEqual(['favoravel', 'neutra'])
  })

  it('resolves the note-step destination without looping to choice after save', () => {
    expect(resolveWizardTrendNoteDestination('favoravel', 'neutra')).toBe('note')
    expect(resolveWizardTrendNoteDestination('favoravel', 'favoravel')).toBe('home')
    expect(resolveWizardTrendNoteDestination('favoravel', null)).toBe('note')
  })
})

describe('politicalTrendWizardMeta', () => {
  it('covers every trend with icon, copy and info content', () => {
    expect(politicalTrendWizardMeta).toHaveLength(politicalTrendStatuses.length)

    for (const status of politicalTrendStatuses) {
      const entry = politicalTrendWizardMetaByStatus[status]
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.changeDescription).toContain(entry.label)
      expect(entry.infoContent.length).toBeGreaterThan(20)
      expect(entry.icon).toBeTruthy()
      expect(entry.tileClassName.length).toBeGreaterThan(0)
    }
  })
})
