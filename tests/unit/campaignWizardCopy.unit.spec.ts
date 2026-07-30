import { describe, expect, it } from 'vitest'

import {
  WIZARD_DISMISS_ARIA_LABEL,
  wizardFlowChromeAriaLabel,
  wizardFlowTitleForSlug,
  wizardMunicipalityChromeAriaLabel,
} from '@/lib/campaignWizardCopy'

describe('campaignWizardCopy', () => {
  it('maps wizard slugs to home action flow titles', () => {
    expect(wizardFlowTitleForSlug('atualizar-votos')).toBe('Ajustar votos')
    expect(wizardFlowTitleForSlug('registrar-sinal')).toBe('Registrar sinal')
    expect(wizardFlowTitleForSlug('inventado')).toBe('Continuar')
  })

  it('builds wizard chrome aria labels from shared copy', () => {
    expect(wizardFlowChromeAriaLabel('Ajustar votos')).toBe('Ação: Ajustar votos')
    expect(wizardMunicipalityChromeAriaLabel('Cairu')).toBe('Município em atualização: Cairu')
    expect(WIZARD_DISMISS_ARIA_LABEL).toBe('Sair da ação')
  })
})
