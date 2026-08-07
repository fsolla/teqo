import { describe, expect, it } from 'vitest'

import { CAMPAIGN_ACTIONS_HOME } from '@/lib/campaignActionRoutes'
import {
  resolveWizardVotesSkip,
  WIZARD_CHAIN_SKIP_LABEL,
  WIZARD_DISMISS_ARIA_LABEL,
  wizardFlowChromeAriaLabel,
  wizardFlowTitleForSlug,
  wizardMunicipalityChromeAriaLabel,
} from '@/lib/campaignWizardCopy'

describe('campaignWizardCopy', () => {
  it('maps wizard slugs to home action flow titles', () => {
    expect(wizardFlowTitleForSlug('atualizar-votos')).toBe('Ajustar votos')
    expect(wizardFlowTitleForSlug('registrar-atualizacao')).toBe('Registrar atualização')
    expect(wizardFlowTitleForSlug('inventado')).toBe('Continuar')
  })

  it('builds wizard chrome aria labels from shared copy', () => {
    expect(wizardFlowChromeAriaLabel('Ajustar votos')).toBe('Ação: Ajustar votos')
    expect(wizardMunicipalityChromeAriaLabel('Cairu')).toBe('Município em atualização: Cairu')
    expect(WIZARD_DISMISS_ARIA_LABEL).toBe('Sair da ação')
  })

  it('uses the shared chain skip label for embedded vote adjustments', () => {
    expect(WIZARD_CHAIN_SKIP_LABEL).toBe('Pular')
    expect(resolveWizardVotesSkip(undefined, 'cairu')).toBeUndefined()
    expect(resolveWizardVotesSkip('update-votes', 'cairu')).toBeUndefined()
    expect(resolveWizardVotesSkip('change-trend', 'cairu')).toEqual({
      label: WIZARD_CHAIN_SKIP_LABEL,
      href: `${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca?municipio=cairu&entry=change-trend`,
    })
  })
})
