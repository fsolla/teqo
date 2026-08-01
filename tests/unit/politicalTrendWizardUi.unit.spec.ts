import { describe, expect, it } from 'vitest'

import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  politicalTrendWizardMeta,
  politicalTrendWizardMetaByStatus,
} from '@/lib/politicalTrendWizardMeta'
import {
  buildPoliticalTrendNotePrefill,
  resolvePoliticalTrendNotePrefillSource,
  resolveWizardTrendNoteDestination,
  resolveWizardTrendSkip,
  selectablePoliticalTrendStatuses,
  shouldShowWizardTrendSkip,
  WIZARD_TREND_SKIP_LABEL,
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

  it('hides skip for standalone change-trend entry', () => {
    expect(shouldShowWizardTrendSkip(undefined)).toBe(false)
    expect(shouldShowWizardTrendSkip('change-trend')).toBe(false)
    expect(resolveWizardTrendSkip(undefined)).toBeUndefined()
    expect(resolveWizardTrendSkip('change-trend')).toBeUndefined()
  })

  it('shows skip when embedded from another wizard action', () => {
    expect(shouldShowWizardTrendSkip('update-votes')).toBe(true)
    expect(shouldShowWizardTrendSkip('register-signal')).toBe(true)
    expect(resolveWizardTrendSkip('update-votes')).toEqual({
      label: WIZARD_TREND_SKIP_LABEL,
      href: CAMPAIGN_HOME,
    })
  })

  it('builds note prefills from embedded wizard sources', () => {
    expect(buildPoliticalTrendNotePrefill({ kind: 'none' })).toBe('')
    expect(
      buildPoliticalTrendNotePrefill({
        kind: 'signal',
        signalType: 'invasao',
        description: 'Reunião do adversário no território',
      }),
    ).toBe('Sinal de invasão: Reunião do adversário no território')
    expect(
      buildPoliticalTrendNotePrefill({
        kind: 'voteAdjustment',
        previousValue: 120,
        newValue: 180,
      }),
    ).toBe('Ajuste de votos: 120 → 180')
    expect(buildPoliticalTrendNotePrefill({ kind: 'custom', text: 'Contexto do fluxo' })).toBe(
      'Contexto do fluxo',
    )
  })

  it('resolves prefill sources from entry action and query params', () => {
    expect(
      resolvePoliticalTrendNotePrefillSource({
        entryAction: 'update-votes',
        voteFrom: '100',
        voteTo: '150',
      }),
    ).toEqual({ kind: 'voteAdjustment', previousValue: 100, newValue: 150 })

    expect(
      resolvePoliticalTrendNotePrefillSource({
        entryAction: 'register-signal',
        signalType: 'esfriamento',
        signalBody: 'Lideranças sumiram',
      }),
    ).toEqual({
      kind: 'signal',
      signalType: 'esfriamento',
      description: 'Lideranças sumiram',
    })

    expect(
      resolvePoliticalTrendNotePrefillSource({
        notePrefill: 'Texto direto',
      }),
    ).toEqual({ kind: 'custom', text: 'Texto direto' })
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
