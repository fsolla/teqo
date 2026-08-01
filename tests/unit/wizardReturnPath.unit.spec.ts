import { describe, expect, it } from 'vitest'

import {
  appendWizardReturnPath,
  isWizardReturnPath,
  parseWizardReturnPath,
  WIZARD_RETURN_PATH_QUERY_KEY,
} from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'

describe('wizard return path (B110)', () => {
  it('allowlists internal /campanha paths outside acoes and auth', () => {
    expect(isWizardReturnPath('/campanha')).toBe(true)
    expect(isWizardReturnPath('/campanha/municipios/cairu')).toBe(true)
    expect(isWizardReturnPath('/campanha/liderancas/42')).toBe(true)
    expect(isWizardReturnPath('/campanha/acoes/mudar-tendencia')).toBe(false)
    expect(isWizardReturnPath('/campanha/login')).toBe(false)
    expect(isWizardReturnPath('/campanha/convite/token')).toBe(false)
    expect(isWizardReturnPath('https://evil.test/phish')).toBe(false)
    expect(isWizardReturnPath('/public')).toBe(false)
  })

  it('parseWizardReturnPath fails closed on invalid values', () => {
    expect(parseWizardReturnPath(undefined)).toBeUndefined()
    expect(parseWizardReturnPath('/campanha/municipios/foo')).toBe('/campanha/municipios/foo')
    expect(parseWizardReturnPath('/campanha/acoes/foo')).toBeUndefined()
    expect(parseWizardReturnPath('//evil.test')).toBeUndefined()
    expect(parseWizardReturnPath('/campanha/foo?x=1')).toBeUndefined()
  })

  it('appendWizardReturnPath adds the from query key', () => {
    const href = appendWizardReturnPath(
      '/campanha/acoes/mudar-tendencia?municipio=cairu',
      '/campanha/municipios/cairu',
    )
    expect(href).toContain(`${WIZARD_RETURN_PATH_QUERY_KEY}=`)
    expect(href).toContain(
      `${WIZARD_RETURN_PATH_QUERY_KEY}=${encodeURIComponent('/campanha/municipios/cairu')}`,
    )
  })

  it('appendWizardReturnPath ignores invalid return paths', () => {
    expect(appendWizardReturnPath('/campanha/acoes/foo', '/campanha/acoes/bar')).toBe(
      '/campanha/acoes/foo',
    )
  })

  it('CAMPAIGN_HOME is a valid return path', () => {
    expect(parseWizardReturnPath(CAMPAIGN_HOME)).toBe(CAMPAIGN_HOME)
  })
})
