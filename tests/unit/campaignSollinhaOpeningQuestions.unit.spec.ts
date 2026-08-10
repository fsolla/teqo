// @vitest-environment node

import { describe, expect, it } from 'vitest'

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

  it('every text is non-empty and trimmed', () => {
    for (const role of ['coordinator', 'leader'] as const) {
      for (const question of getSollinhaOpeningQuestions(role, false)) {
        expect(question.text.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
