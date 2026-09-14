// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { CampaignRole } from '@/lib/campaignRoles'
import { buildAISystemPrompt } from '@/utilities/ai/systemPrompt'

describe('buildAISystemPrompt (C159)', () => {
  it('scopes the communication assessor to the speech acervo', () => {
    const prompt = buildAISystemPrompt('communicator')
    expect(prompt).toContain('## Escopo do seu acesso')
    expect(prompt).toContain('NÃO tem acesso a dados eleitorais')
    expect(prompt).toContain('acervo interno de falas do deputado')
    // Follow-ups are limited to what her toolset answers.
    expect(prompt).toContain(
      'Para a assessoria de comunicação (role communicator), só sugestões sobre o acervo de falas.',
    )
  })

  it('leaves no staff knowledge, campaign tool instruction or election figure in the scoped prompt', () => {
    const prompt = buildAISystemPrompt('communicator')
    for (const forbidden of [
      'dados eleitorais da Bahia',
      '417 municípios',
      'conhece profundamente os dados da campanha',
      'searchEntities',
      'getLeadingMunicipalities',
      'getPendingLeaderships',
      'getMunicipalityPriorities',
      '## Contexto eleitoral',
      'quociente eleitoral',
    ]) {
      expect(prompt).not.toContain(forbidden)
    }
  })

  it('falls back to the scoped prompt for an unknown role (fail-closed)', () => {
    const prompt = buildAISystemPrompt('desconhecido' as CampaignRole)
    expect(prompt).toContain('## Escopo do seu acesso')
    expect(prompt).not.toContain('dados eleitorais da Bahia')
    expect(prompt).not.toContain('searchEntities')
  })

  it('keeps the full composition for staff and the leader', () => {
    for (const role of ['coordinator', 'advisor', 'candidate', 'leader'] as const) {
      const prompt = buildAISystemPrompt(role)
      expect(prompt).toContain('dados eleitorais da Bahia')
      expect(prompt).toContain('417 municípios')
      expect(prompt).toContain('## Navegação no app')
      expect(prompt).toContain('## Contexto eleitoral')
      expect(prompt).toContain('searchEntities')
      expect(prompt).not.toContain('## Escopo do seu acesso')
      expect(prompt).not.toContain('só sugestões sobre o acervo de falas')
      expect(prompt).toContain(
        'para liderança (role leader), nada de sugestões sobre dados eleitorais',
      )
    }
  })

  it('keeps the shared acervo guidance for every role', () => {
    for (const role of ['coordinator', 'leader', 'communicator'] as const) {
      expect(buildAISystemPrompt(role)).toContain('## Trechos de fala do acervo para vídeos')
    }
  })
})
