import { describe, expect, it } from 'vitest'

import {
  CAMPAIGN_ACTIONS_HOME,
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  campaignActionEntryHref,
  campaignWizardActionIdForSlug,
  hasWizardScenarioParam,
  isCampaignWizardActionId,
  isCampaignWizardActionSlug,
  parseWizardLeadershipIdParam,
  parseWizardMunicipioParam,
  resolveWizardTrendStatusParam,
  wizardActionHref,
  wizardPreviousHref,
  wizardReturnHref,
  wizardTrendHref,
} from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'

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

  it('builds trend wizard hrefs with optional trendStatus and return path', () => {
    expect(wizardTrendHref('mudar-tendencia', 'cairu')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu`,
    )
    expect(wizardTrendHref('mudar-tendencia', 'cairu', 'favoravel')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu&trendStatus=favoravel`,
    )
    const origin = '/campanha/municipios/cairu'
    expect(wizardTrendHref('mudar-tendencia', 'cairu', 'neutra', origin)).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu&trendStatus=neutra&from=${encodeURIComponent(origin)}`,
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

describe('wizardReturnHref (B110)', () => {
  it('falls back to Início without a return path', () => {
    expect(wizardReturnHref(undefined)).toBe(CAMPAIGN_HOME)
  })

  it('honors an allowlisted return path', () => {
    expect(wizardReturnHref('/campanha/municipios/cairu')).toBe('/campanha/municipios/cairu')
  })

  it.each(['/campanha/acoes/atualizar-votos', '/campanha/login', 'https://evil.example'])(
    'rejects %s and falls back to Início',
    (path) => {
      expect(wizardReturnHref(path)).toBe(CAMPAIGN_HOME)
    },
  )
})

describe('wizardPreviousHref', () => {
  it('returns the return target for municipality search', () => {
    expect(
      wizardPreviousHref({
        actionSlug: 'atualizar-votos',
        stepKind: 'municipality-search',
      }),
    ).toBe(CAMPAIGN_HOME)
  })

  it('returns municipality search for principal post-municipio steps', () => {
    expect(
      wizardPreviousHref({
        actionSlug: 'atualizar-votos',
        stepKind: 'votes',
        municipalitySlug: 'cairu',
      }),
    ).toBe(`${CAMPAIGN_ACTIONS_HOME}/atualizar-votos`)
    expect(
      wizardPreviousHref({
        actionSlug: 'mudar-tendencia',
        stepKind: 'trend-choice',
        municipalitySlug: 'cairu',
      }),
    ).toBe(`${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia`)
    expect(
      wizardPreviousHref({
        actionSlug: 'registrar-atualizacao',
        stepKind: 'update-body',
        municipalitySlug: 'cairu',
      }),
    ).toBe(`${CAMPAIGN_ACTIONS_HOME}/registrar-atualizacao`)
    expect(
      wizardPreviousHref({
        actionSlug: 'atualizar-lideranca',
        stepKind: 'leadership-grid',
        municipalitySlug: 'cairu',
      }),
    ).toBe(`${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca`)
  })

  it('returns the trend choice step from the trend note step', () => {
    expect(
      wizardPreviousHref({
        actionSlug: 'mudar-tendencia',
        stepKind: 'trend-note',
        municipalitySlug: 'cairu',
      }),
    ).toBe(`${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu`)
  })

  it('returns the leadership grid from the leadership form step', () => {
    expect(
      wizardPreviousHref({
        actionSlug: 'atualizar-lideranca',
        stepKind: 'leadership-form',
        municipalitySlug: 'cairu',
      }),
    ).toBe(`${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca?municipio=cairu`)
  })

  it('honors return path on municipality search back target', () => {
    const origin = '/campanha/municipios/cairu'
    expect(
      wizardPreviousHref({
        actionSlug: 'atualizar-votos',
        stepKind: 'municipality-search',
        returnPath: origin,
      }),
    ).toBe(origin)
  })
})
