import { describe, expect, it } from 'vitest'

import {
  buildSpeechExcerpt,
  speechExcerptTerms,
  type SpeechExcerptSegment,
} from '@/lib/speechExcerpt'

const seg = (startSeconds: number, endSeconds: number, text: string): SpeechExcerptSegment => ({
  startSeconds,
  endSeconds,
  text,
})

describe('speechExcerptTerms', () => {
  it('normaliza acento/caixa e quebra em caracteres não alfanuméricos (sem curinga no LIKE)', () => {
    expect(speechExcerptTerms('100% saúde_pública')).toEqual(['100', 'saude', 'publica'])
  })

  it('descarta termos com menos de 3 caracteres', () => {
    expect(speechExcerptTerms('a de oxi')).toEqual(['oxi'])
    expect(speechExcerptTerms('de a o')).toEqual([])
  })

  it('deduplica preservando a ordem', () => {
    expect(speechExcerptTerms('SUS sus SUS saúde')).toEqual(['sus', 'saude'])
  })

  it('limita a 6 termos', () => {
    expect(speechExcerptTerms('alfa beta gama delta epsilon zeta eta theta')).toEqual([
      'alfa',
      'beta',
      'gama',
      'delta',
      'epsilon',
      'zeta',
    ])
  })
})

describe('buildSpeechExcerpt', () => {
  it('escolhe a âncora de maior cobertura e expande até o fim do trecho disponível', () => {
    const excerpt = buildSpeechExcerpt(
      [
        seg(0, 3, 'O hospital do subúrbio'),
        seg(3, 8, 'precisa de atenção'),
        seg(8, 14, 'e de investimento'),
      ],
      ['hospital', 'suburbio'],
    )

    expect(excerpt).toEqual({
      startSeconds: 0,
      endSeconds: 14,
      text: 'O hospital do subúrbio precisa de atenção e de investimento',
      matchedTerms: ['hospital', 'suburbio'],
    })
  })

  it('cobre termos espalhados em segmentos consecutivos', () => {
    const excerpt = buildSpeechExcerpt(
      [seg(0, 6, 'Vamos falar do hospital'), seg(6, 12, 'do subúrbio e da saúde')],
      ['hospital', 'suburbio'],
    )

    expect(excerpt).toMatchObject({ startSeconds: 0, endSeconds: 12 })
  })

  it('expande além do alvo até cobrir termos distantes dentro do teto de 60s', () => {
    const segments = [
      seg(0, 5, 'hospital'),
      seg(5, 25, 'contexto do mandato'),
      seg(25, 45, 'mais contexto'),
      seg(45, 55, 'ainda contexto'),
      seg(55, 60, 'suburbio'),
    ]

    for (const targetSeconds of [20, 45]) {
      expect(
        buildSpeechExcerpt(segments, ['hospital', 'suburbio'], { targetSeconds }),
      ).toMatchObject({ startSeconds: 0, endSeconds: 60 })
    }
  })

  it('não concatena por cima de um gap maior que 5s', () => {
    expect(
      buildSpeechExcerpt(
        [seg(0, 5, 'hospital'), seg(25, 30, 'suburbio')],
        ['hospital', 'suburbio'],
      ),
    ).toBeNull()
  })

  it('devolve null quando nenhum segmento cobre o tema', () => {
    expect(buildSpeechExcerpt([seg(0, 5, 'economia e emprego')], ['hospital'])).toBeNull()
  })

  it('devolve null sem segmentos ou sem termos', () => {
    expect(buildSpeechExcerpt([], ['hospital'])).toBeNull()
    expect(buildSpeechExcerpt([seg(0, 5, 'hospital')], [])).toBeNull()
  })

  it('as variantes curta e longa produzem janelas diferentes', () => {
    const segments = [
      seg(0, 10, 'hospital'),
      seg(10, 20, 'primeira parte'),
      seg(20, 30, 'segunda parte'),
      seg(30, 40, 'terceira parte'),
      seg(40, 50, 'quarta parte'),
    ]

    expect(buildSpeechExcerpt(segments, ['hospital'], { targetSeconds: 20 })).toMatchObject({
      startSeconds: 0,
      endSeconds: 20,
    })
    expect(buildSpeechExcerpt(segments, ['hospital'], { targetSeconds: 45 })).toMatchObject({
      startSeconds: 0,
      endSeconds: 50,
    })
  })

  it('respeita o teto de 60s na expansão', () => {
    const excerpt = buildSpeechExcerpt(
      [seg(0, 30, 'hospital'), seg(30, 60, 'meio'), seg(60, 90, 'fim')],
      ['hospital'],
      { targetSeconds: 45 },
    )

    expect(excerpt).toMatchObject({ startSeconds: 0, endSeconds: 60 })
  })

  it('expande para trás quando a âncora sozinha não atinge o piso de contexto', () => {
    const excerpt = buildSpeechExcerpt(
      [seg(0, 20, 'história da Bahia'), seg(20, 22, 'hospital')],
      ['hospital'],
    )

    expect(excerpt).toMatchObject({ startSeconds: 0, endSeconds: 22 })
  })

  it('devolve um segmento único maior que o teto inteiro (nunca corta no meio)', () => {
    const excerpt = buildSpeechExcerpt(
      [seg(0, 90, 'hospital e subúrbio')],
      ['hospital', 'suburbio'],
    )

    expect(excerpt).toMatchObject({ startSeconds: 0, endSeconds: 90 })
  })
})
