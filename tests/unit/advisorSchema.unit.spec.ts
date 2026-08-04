import { describe, expect, it } from 'vitest'

import {
  isPlanilhaPlaceholderEmail,
  planilhaPlaceholderEmailForAdvisor,
  stubCampaignUserEmailFor,
} from '@/lib/schemas/advisor'

describe('isPlanilhaPlaceholderEmail', () => {
  it('detects the E4R seed suffix case-insensitively', () => {
    expect(isPlanilhaPlaceholderEmail('edizio@planilha.invalid')).toBe(true)
    expect(isPlanilhaPlaceholderEmail('Edizio@Planilha.Invalid')).toBe(true)
  })

  it('detects the B154 inline-create suffix case-insensitively', () => {
    expect(isPlanilhaPlaceholderEmail('joao@criado.invalid')).toBe(true)
    expect(isPlanilhaPlaceholderEmail('Maria-Santos-2@Criado.Invalid')).toBe(true)
  })

  it('rejects real emails and empty values', () => {
    expect(isPlanilhaPlaceholderEmail('edizio@example.com')).toBe(false)
    expect(isPlanilhaPlaceholderEmail('joao@criado.com.br')).toBe(false)
    expect(isPlanilhaPlaceholderEmail('')).toBe(false)
    expect(isPlanilhaPlaceholderEmail(null)).toBe(false)
    expect(isPlanilhaPlaceholderEmail(undefined)).toBe(false)
  })
})

describe('planilhaPlaceholderEmailForAdvisor', () => {
  it('builds a stable assessor-{id}@planilha.invalid address', () => {
    expect(planilhaPlaceholderEmailForAdvisor(42)).toBe('assessor-42@planilha.invalid')
  })
})

describe('stubCampaignUserEmailFor', () => {
  it('builds <slug-do-nome>@criado.invalid from the normalized name', () => {
    expect(stubCampaignUserEmailFor('Maria Silva')).toBe('maria-silva@criado.invalid')
    expect(stubCampaignUserEmailFor('João José')).toBe('joao-jose@criado.invalid')
  })

  it('appends -N from the second occurrence', () => {
    expect(stubCampaignUserEmailFor('Maria Silva', 2)).toBe('maria-silva-2@criado.invalid')
    expect(stubCampaignUserEmailFor('Maria Silva', 3)).toBe('maria-silva-3@criado.invalid')
  })

  it('falls back to a non-empty local part when the name has no letters or digits', () => {
    // "!!!" passes min(2) but slugifies to "" — the stub must still be a
    // valid e-mail local part instead of "@criado.invalid" (which would fail
    // Payload's e-mail validation and surface as a dead-end generic error).
    expect(stubCampaignUserEmailFor('!!!')).toBe('assessor@criado.invalid')
  })
})
