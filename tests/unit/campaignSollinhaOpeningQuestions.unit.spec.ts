// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { CampaignRole } from '@/lib/campaignRoles'
import { getSollinhaOpeningQuestions } from '@/lib/sollinhaOpeningQuestions'

const STAFF_TEXT = [
  'Quem foi o deputado mais votado em Feira de Santana?',
  'Quantos votos tivemos em Ilhéus em 2022?',
  'Quais dobradinhas temos em Salvador?',
  'Como está o município de Vitória da Conquista?',
]

const LEADER_TEXT = [
  'O que você sabe fazer?',
  'Me manda o link dos meus contatos',
  'Me manda o link do meu perfil',
]

// C159 — the assessoria de comunicação gets acervo questions, all answerable
// by her toolset (`findSpeechExcerpts`).
const COMMUNICATOR_TEXT = [
  'O que o Solla já falou sobre Farmácia Popular?',
  'Me dá uma fala do deputado para um reels sobre saúde.',
  'Qual um trecho bom sobre o hospital do subúrbio?',
]

describe('getSollinhaOpeningQuestions', () => {
  it('offers the full curated catalog to staff on desktop', () => {
    for (const role of ['coordinator', 'advisor', 'candidate'] as const) {
      const questions = getSollinhaOpeningQuestions(role, false)
      expect(questions.map((q) => q.text)).toEqual(STAFF_TEXT)
    }
  })

  it('caps staff catalog to 3 chips on mobile', () => {
    for (const role of ['coordinator', 'advisor', 'candidate'] as const) {
      const questions = getSollinhaOpeningQuestions(role, true)
      expect(questions.map((q) => q.text)).toEqual(STAFF_TEXT.slice(0, 3))
    }
  })

  it('gives leaders the safe set — never an election question', () => {
    const questions = getSollinhaOpeningQuestions('leader', false)
    expect(questions.map((q) => q.text)).toEqual(LEADER_TEXT)
    for (const question of questions) {
      expect(question.text).not.toMatch(
        /deputado mais votado|votos tivemos|dobradinhas temos|como está o município/i,
      )
    }
  })

  it('keeps the leader safe set on mobile (3 chips)', () => {
    expect(getSollinhaOpeningQuestions('leader', true).map((q) => q.text)).toEqual(LEADER_TEXT)
  })

  it('gives the communication assessor the acervo set — never a campaign question', () => {
    for (const isMobile of [false, true]) {
      const questions = getSollinhaOpeningQuestions('communicator', isMobile)
      expect(questions.map((q) => q.text)).toEqual(COMMUNICATOR_TEXT)
      for (const question of questions) {
        expect(question.text).not.toMatch(
          /deputado mais votado|votos tivemos|dobradinhas temos|como está o município|meus contatos/i,
        )
      }
    }
  })

  it('falls back to the leader safe set for an unknown role (fail-closed)', () => {
    const unknown = 'desconhecido' as CampaignRole
    expect(getSollinhaOpeningQuestions(unknown, false).map((q) => q.text)).toEqual(LEADER_TEXT)
  })

  it('every text is non-empty and trimmed', () => {
    for (const role of ['coordinator', 'leader', 'communicator'] as const) {
      for (const question of getSollinhaOpeningQuestions(role, false)) {
        expect(question.text.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
