import { describe, expect, it } from 'vitest'

import { CAMPAIGN_WIZARD_ACTION_SLUGS } from '@/lib/campaignActionRoutes'
import {
  isWizardBackHistoryState,
  isWizardLayerHistoryState,
  resolveWizardBack,
  shouldHandleWizardBackPopstate,
  WIZARD_BACK_HISTORY_KEY,
  WIZARD_LAYER_HISTORY_KEY,
  WIZARD_LEADERSHIP_FORM_LAYER,
  wizardStepPreviousHref,
} from '@/lib/wizardBack'

const signalSlug = CAMPAIGN_WIZARD_ACTION_SLUGS['register-signal']
const votesSlug = CAMPAIGN_WIZARD_ACTION_SLUGS['update-votes']
const trendSlug = CAMPAIGN_WIZARD_ACTION_SLUGS['change-trend']
const leadershipSlug = CAMPAIGN_WIZARD_ACTION_SLUGS['update-leadership']

describe('wizardBack', () => {
  it('entry back navigates to dismiss / returnPath', () => {
    expect(
      resolveWizardBack({
        stepKind: 'entry',
        dismissHref: '/campanha/municipios/cairu',
      }),
    ).toEqual({ kind: 'navigate', href: '/campanha/municipios/cairu' })
  })

  it('continue back navigates to previousHref', () => {
    expect(
      resolveWizardBack({
        stepKind: 'continue',
        previousHref: `/campanha/acoes/${signalSlug}`,
        dismissHref: '/campanha',
      }),
    ).toEqual({ kind: 'navigate', href: `/campanha/acoes/${signalSlug}` })
  })

  it('client layer pops the layer instead of navigating', () => {
    expect(
      resolveWizardBack({
        stepKind: 'continue',
        previousHref: `/campanha/acoes/${leadershipSlug}`,
        dismissHref: '/campanha',
        clientLayer: WIZARD_LEADERSHIP_FORM_LAYER,
      }),
    ).toEqual({ kind: 'pop-layer', layer: WIZARD_LEADERSHIP_FORM_LAYER })
  })

  it('canonical previousHrefs keep signal body → type → search coherent', () => {
    const search = wizardStepPreviousHref({
      step: 'signal-type',
      actionSlug: signalSlug,
      returnPath: '/campanha',
    })
    expect(search).toBe(`/campanha/acoes/${signalSlug}?from=%2Fcampanha`)

    const type = wizardStepPreviousHref({
      step: 'signal-body',
      actionSlug: signalSlug,
      municipalitySlug: 'cairu',
      returnPath: '/campanha',
    })
    expect(type).toBe(`/campanha/acoes/${signalSlug}?municipio=cairu&from=%2Fcampanha`)

    expect(
      wizardStepPreviousHref({
        step: 'expected-votes',
        actionSlug: votesSlug,
      }),
    ).toBe(`/campanha/acoes/${votesSlug}`)
  })

  it('trend choice previous is municipality search (not the same URL)', () => {
    const previous = wizardStepPreviousHref({
      step: 'trend-choice',
      actionSlug: trendSlug,
      municipalitySlug: 'cairu',
      entryAction: 'update-votes',
      returnPath: '/campanha/municipios/cairu',
    })
    expect(previous).toBe(`/campanha/acoes/${trendSlug}?from=%2Fcampanha%2Fmunicipios%2Fcairu`)
    expect(previous).not.toContain('municipio=')
  })

  it('recognizes history marks', () => {
    expect(isWizardBackHistoryState({ [WIZARD_BACK_HISTORY_KEY]: true })).toBe(true)
    expect(isWizardBackHistoryState({})).toBe(false)
    expect(
      isWizardLayerHistoryState({ [WIZARD_LAYER_HISTORY_KEY]: WIZARD_LEADERSHIP_FORM_LAYER }),
    ).toBe(true)
    expect(isWizardLayerHistoryState({ [WIZARD_BACK_HISTORY_KEY]: true })).toBe(false)
  })

  it('handles popstate only when we pushed and are not closing ourselves', () => {
    expect(
      shouldHandleWizardBackPopstate({
        wasHistoryPushed: true,
        closingProgrammatically: false,
      }),
    ).toBe(true)
    expect(
      shouldHandleWizardBackPopstate({
        wasHistoryPushed: true,
        closingProgrammatically: true,
      }),
    ).toBe(false)
    expect(
      shouldHandleWizardBackPopstate({
        wasHistoryPushed: false,
        closingProgrammatically: false,
      }),
    ).toBe(false)
  })
})
