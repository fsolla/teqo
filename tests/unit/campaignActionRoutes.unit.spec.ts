import { describe, expect, it } from 'vitest'

import {
  CAMPAIGN_ACTIONS_HOME,
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  campaignActionEntryHref,
  campaignWizardActionIdForSlug,
  hasWizardScenarioParam,
  isCampaignWizardActionId,
  isCampaignWizardActionSlug,
  parseWizardEntryActionParam,
  parseWizardLeadershipIdParam,
  parseWizardMunicipioParam,
  resolveWizardSignalTypeParam,
  resolveWizardTrendStatusParam,
  wizardActionHref,
  wizardSignalHref,
  wizardTrendHref,
} from '@/lib/campaignActionRoutes'

describe('campaignActionRoutes', () => {
  it.each(
    Object.entries(CAMPAIGN_WIZARD_ACTION_SLUGS) as Array<
      [keyof typeof CAMPAIGN_WIZARD_ACTION_SLUGS, string]
    >,
  )('maps %s to /campanha/acoes/%s', (id, slug) => {
    expect(campaignActionEntryHref(id)).toBe(`${CAMPAIGN_ACTIONS_HOME}/${slug}`)
    expect(isCampaignWizardActionSlug(slug)).toBe(true)
  })

  it('recognizes wizard ids and rejects list shortcuts', () => {
    expect(isCampaignWizardActionId('update-votes')).toBe(true)
    expect(isCampaignWizardActionId('uncovered-municipalities')).toBe(false)
  })

  it('rejects unknown wizard slugs', () => {
    expect(isCampaignWizardActionSlug('inventado')).toBe(false)
  })

  it('builds wizard hrefs with optional municipio query', () => {
    expect(wizardActionHref('atualizar-votos')).toBe(`${CAMPAIGN_ACTIONS_HOME}/atualizar-votos`)
    expect(wizardActionHref('atualizar-votos', 'cairu')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/atualizar-votos?municipio=cairu`,
    )
    expect(wizardActionHref('atualizar-lideranca', 'cairu', { entryAction: 'update-votes' })).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca?municipio=cairu&entry=update-votes`,
    )
    expect(wizardActionHref('atualizar-lideranca', 'cairu', { leadershipId: 42 })).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca?municipio=cairu&leadershipId=42`,
    )
  })

  it('parses leadershipId search param', () => {
    expect(parseWizardLeadershipIdParam('42')).toBe(42)
    expect(parseWizardLeadershipIdParam(['99'])).toBe(99)
    expect(parseWizardLeadershipIdParam(undefined)).toBeUndefined()
    expect(parseWizardLeadershipIdParam('0')).toBeUndefined()
    expect(parseWizardLeadershipIdParam('abc')).toBeUndefined()
  })

  it('detects legacy scenario search param', () => {
    expect(hasWizardScenarioParam(undefined)).toBe(false)
    expect(hasWizardScenarioParam('central')).toBe(true)
    expect(hasWizardScenarioParam('  ')).toBe(false)
  })

  it('parses municipio search param', () => {
    expect(parseWizardMunicipioParam('cairu')).toBe('cairu')
    expect(parseWizardMunicipioParam(['cairu', 'ignored'])).toBe('cairu')
    expect(parseWizardMunicipioParam(undefined)).toBeUndefined()
    expect(parseWizardMunicipioParam('  ')).toBeUndefined()
  })

  it('resolves wizard action id from slug', () => {
    expect(campaignWizardActionIdForSlug('atualizar-votos')).toBe('update-votes')
    expect(campaignWizardActionIdForSlug('inventado')).toBeUndefined()
  })

  it('parses entry action search param', () => {
    expect(parseWizardEntryActionParam('update-leadership')).toBe('update-leadership')
    expect(parseWizardEntryActionParam('update-votes')).toBe('update-votes')
    expect(parseWizardEntryActionParam('invalid')).toBeUndefined()
    expect(parseWizardEntryActionParam(undefined)).toBeUndefined()
  })

  it('builds signal wizard hrefs with optional signalType and entry', () => {
    expect(wizardSignalHref('registrar-sinal', 'cairu')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/registrar-sinal?municipio=cairu`,
    )
    expect(wizardSignalHref('registrar-sinal', 'cairu', 'invasao')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/registrar-sinal?municipio=cairu&signalType=invasao`,
    )
    expect(wizardSignalHref('registrar-sinal', 'cairu', 'esfriamento', 'update-votes')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/registrar-sinal?municipio=cairu&signalType=esfriamento&entry=update-votes`,
    )
  })

  it('resolves signalType search param with invalid flag', () => {
    expect(resolveWizardSignalTypeParam(undefined)).toEqual({
      signalType: undefined,
      invalid: false,
    })
    expect(resolveWizardSignalTypeParam('invasao')).toEqual({
      signalType: 'invasao',
      invalid: false,
    })
    expect(resolveWizardSignalTypeParam('invalid')).toEqual({
      signalType: undefined,
      invalid: true,
    })
  })

  it('builds trend wizard hrefs with optional trendStatus and entry', () => {
    expect(wizardTrendHref('mudar-tendencia', 'cairu')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu`,
    )
    expect(wizardTrendHref('mudar-tendencia', 'cairu', 'favoravel')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu&trendStatus=favoravel`,
    )
    expect(wizardTrendHref('mudar-tendencia', 'cairu', 'neutra', 'update-votes')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu&trendStatus=neutra&entry=update-votes`,
    )
  })

  it('resolves trendStatus search param with invalid flag', () => {
    expect(resolveWizardTrendStatusParam(undefined)).toEqual({
      trendStatus: undefined,
      invalid: false,
    })
    expect(resolveWizardTrendStatusParam('desfavoravel')).toEqual({
      trendStatus: 'desfavoravel',
      invalid: false,
    })
    expect(resolveWizardTrendStatusParam('invalid')).toEqual({
      trendStatus: undefined,
      invalid: true,
    })
  })
})
