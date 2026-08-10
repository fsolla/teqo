// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  SOLLINHA_FOLLOW_UP_MARKER,
  splitSollinhaFollowUpBlock,
} from '@/lib/sollinhaFollowUpSuggestions'

const marker = SOLLINHA_FOLLOW_UP_MARKER

describe('splitSollinhaFollowUpBlock', () => {
  it('passes text without the marker through unchanged and yields no chips', () => {
    const text = 'Em 2022, tivemos 12.345 votos em Ilhéus.\n\nQualquer coisa é só chamar!'
    expect(splitSollinhaFollowUpBlock(text)).toEqual({ body: text, suggestions: [] })
  })

  it('strips the block and returns 2–3 suggestions as chips', () => {
    const text = `Em 2022, tivemos 12.345 votos em Ilhéus.\n\n${marker}\n- Quantos votos tivemos em Salvador?\n- Quem foi o deputado mais votado em Feira de Santana?\n- Como está o município de Vitória da Conquista?`
    const { body, suggestions } = splitSollinhaFollowUpBlock(text)
    expect(body).toBe('Em 2022, tivemos 12.345 votos em Ilhéus.')
    expect(suggestions).toEqual([
      'Quantos votos tivemos em Salvador?',
      'Quem foi o deputado mais votado em Feira de Santana?',
      'Como está o município de Vitória da Conquista?',
    ])
  })

  it('accepts a 2-item block (the contract minimum)', () => {
    const text = `Resposta.\n\n${marker}\n- Primeira?\n- Segunda?`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual(['Primeira?', 'Segunda?'])
  })

  it('caps suggestions at 3 items', () => {
    const text = `Resposta.\n\n${marker}\n- Um?\n- Dois?\n- Três?\n- Quatro?`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toHaveLength(3)
  })

  it('fails closed on a single-item block (contract is 2–3)', () => {
    const text = `Resposta.\n\n${marker}\n- Só uma pergunta?`
    const { body, suggestions } = splitSollinhaFollowUpBlock(text)
    expect(suggestions).toEqual([])
    expect(body).toBe('Resposta.')
  })

  it('fails closed on a marker without any list', () => {
    const text = `Resposta.\n\n${marker}\n\nQualquer coisa, é só chamar!`
    const { body, suggestions } = splitSollinhaFollowUpBlock(text)
    expect(suggestions).toEqual([])
    expect(body).toBe('Resposta.')
  })

  it('accepts numbered list items', () => {
    const text = `Resposta.\n\n${marker}\n1. Primeira?\n2. Segunda?\n3. Terceira?`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual([
      'Primeira?',
      'Segunda?',
      'Terceira?',
    ])
  })

  it('accepts pt-BR `1)`-style numbered items', () => {
    const text = `Resposta.\n\n${marker}\n1) Primeira?\n2) Segunda?`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual(['Primeira?', 'Segunda?'])
  })

  it('strips markdown bold from item text (chips send plain questions)', () => {
    const text = `Resposta.\n\n${marker}\n- **Quantos votos tivemos em Salvador?**\n- Quem foi o mais votado em Barreiras?`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual([
      'Quantos votos tivemos em Salvador?',
      'Quem foi o mais votado em Barreiras?',
    ])
  })

  it('deduplicates repeated items', () => {
    const text = `Resposta.\n\n${marker}\n- Mesma pergunta?\n- Mesma pergunta?\n- Outra?`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual([
      'Mesma pergunta?',
      'Outra?',
    ])
  })

  it('handles CRLF line endings', () => {
    const text = `Resposta.\r\n\r\n${marker}\r\n- Primeira?\r\n- Segunda?`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual(['Primeira?', 'Segunda?'])
  })

  it('fails closed on prose after a full 3-item list (cap does not mask it)', () => {
    const text = `Resposta.\n\n${marker}\n- Uma?\n- Duas?\n- Três?\n\nEspero ter ajudado!`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual([])
  })

  it('uses the LAST occurrence of the marker when the model repeats it', () => {
    const text = `Resposta.\n\n${marker}\n- Antigas?\n- Também antigas?\n\nMais corpo.\n\n${marker}\n- Novas?\n- Atuais?`
    const { body, suggestions } = splitSollinhaFollowUpBlock(text)
    expect(body).toBe('Resposta.\n\n**Sugestões de continuação:**\n- Antigas?\n- Também antigas?\n\nMais corpo.')
    expect(suggestions).toEqual(['Novas?', 'Atuais?'])
  })

  it('fails closed when prose follows the list (the block is not the last thing)', () => {
    const text = `Resposta.\n\n${marker}\n- Uma?\n- Duas?\n\nEspero ter ajudado!`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual([])
  })

  it('drops empty lines and trims item text', () => {
    const text = `Resposta.\n\n${marker}\n-   Uma pergunta com espaços?  \n\n- Outra?`
    expect(splitSollinhaFollowUpBlock(text).suggestions).toEqual([
      'Uma pergunta com espaços?',
      'Outra?',
    ])
  })

  it('is idempotent — an already-stripped body passes through unchanged', () => {
    const text = 'Em 2022, tivemos 12.345 votos em Ilhéus.'
    expect(splitSollinhaFollowUpBlock(splitSollinhaFollowUpBlock(text).body)).toEqual({
      body: text,
      suggestions: [],
    })
  })

  it('trims trailing whitespace of the body', () => {
    const text = `Resposta com fim de linha.\n\n${marker}\n- Uma?\n- Duas?`
    expect(splitSollinhaFollowUpBlock(text).body).toBe('Resposta com fim de linha.')
  })
})
