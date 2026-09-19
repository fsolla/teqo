import { describe, expect, it } from 'vitest'

import {
  CHART_TYPES,
  MAX_POINTS,
  MAX_POINTS_LINE,
  MAX_POINTS_STORY,
  MAX_SERIES,
  MIN_SERIES,
  RELATION_LABEL,
  SIZES,
  classifyRelation,
  isTemporalLabel,
  parseInput,
  parseNumber,
  validateSpec,
} from '../../scripts/lib/chartData.mjs'

describe('parseNumber — pt-BR/en amounts, never invents a zero', () => {
  it('reads thousands and decimals', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('1,5')).toBe(1.5)
    expect(parseNumber('1,234.56')).toBe(1234.56)
    expect(parseNumber('R$ 84')).toBe(84)
    expect(parseNumber('12%')).toBe(12)
    expect(parseNumber(-3)).toBe(-3)
  })

  it('returns null for non-numeric input', () => {
    expect(parseNumber('oitenta')).toBeNull()
    expect(parseNumber('')).toBeNull()
    expect(parseNumber(null)).toBeNull()
  })

  it('reads a single separator as the decimal — the documented pt-BR rule', () => {
    expect(parseNumber('1.234')).toBe(1.234)
    expect(parseNumber('1,234')).toBe(1.234)
    expect(parseNumber('1.500')).toBe(1.5)
  })

  it('refuses a repeated separator instead of guessing the thousands', () => {
    expect(parseNumber('1.234.567')).toBeNull()
    expect(parseNumber('1,234,567')).toBeNull()
  })
})

describe('parseInput — the data as it came', () => {
  it('reads a free text of label<space>value pairs', () => {
    const dataset = parseInput({ text: 'Ilhéus 84\nItabuna 68\n', format: 'txt' })
    expect(dataset.rows).toEqual([
      { label: 'Ilhéus', value: 84 },
      { label: 'Itabuna', value: 68 },
    ])
    expect(dataset.issues).toEqual([])
  })

  it('reads colon-separated pairs and labels with spaces', () => {
    const dataset = parseInput({ text: 'Votos em Ilhéus: 84\nVotos em Itabuna: 68', format: 'txt' })
    expect(dataset.rows[0]).toEqual({ label: 'Votos em Ilhéus', value: 84 })
  })

  it('reads a GFM markdown table and drops the header', () => {
    const dataset = parseInput({
      text: '| Cidade | Votos |\n| --- | --- |\n| Ilhéus | 84 |\n| Itabuna | 68 |',
      format: 'md',
    })
    expect(dataset.format).toBe('md')
    expect(dataset.rows).toEqual([
      { label: 'Ilhéus', value: 84 },
      { label: 'Itabuna', value: 68 },
    ])
  })

  it('reads CSV with a header', () => {
    const dataset = parseInput({ text: 'cidade,votos\nIlhéus,84\nItabuna,68\n', format: 'csv' })
    expect(dataset.rows).toEqual([
      { label: 'Ilhéus', value: 84 },
      { label: 'Itabuna', value: 68 },
    ])
  })

  it('flags a non-numeric value instead of dropping it silently', () => {
    const dataset = parseInput({ text: 'Ilhéus 84\nItabuna ???\n', format: 'txt' })
    expect(dataset.rows).toHaveLength(1)
    expect(dataset.issues.join(' ')).toContain('Itabuna')
  })

  it('does not mistake a first data row with a missing value for a header', () => {
    const dataset = parseInput({ text: 'Ilhéus n/d\nItabuna 68\n', format: 'txt' })
    expect(dataset.rows).toEqual([{ label: 'Itabuna', value: 68 }])
    expect(dataset.issues.join(' ')).toContain('Ilhéus')
  })

  it('flags repeated labels', () => {
    const dataset = parseInput({ text: 'A 1\nA 2\n', format: 'txt' })
    expect(dataset.issues.join(' ')).toContain('repetido')
  })

  it('reads a bare number as an unlabeled single measure', () => {
    const dataset = parseInput({ text: '72', format: 'txt' })
    expect(dataset.rows).toEqual([{ label: '', value: 72 }])
    expect(dataset.issues).toEqual([])
  })

  it('does not flag a single separator as ambiguous (the rule is intentional)', () => {
    const dataset = parseInput({ text: 'Ilhéus 1.234\nItabuna 1,500\n', format: 'txt' })
    expect(dataset.rows).toEqual([
      { label: 'Ilhéus', value: 1.234 },
      { label: 'Itabuna', value: 1.5 },
    ])
    expect(dataset.issues).toEqual([])
  })
})

describe('classifyRelation — the relation of the data picks the type', () => {
  it('single measure is an anchor', () => {
    expect(classifyRelation([{ label: '', value: 72 }])).toBe('anchor')
  })

  it('few temporal periods are columns, many are a line', () => {
    expect(
      classifyRelation([
        { label: '2020', value: 1 },
        { label: '2021', value: 2 },
      ]),
    ).toBe('column')
    expect(
      classifyRelation(
        ['2018', '2019', '2020', '2021', '2022', '2023', '2024'].map((label) => ({
          label,
          value: 1,
        })),
      ),
    ).toBe('line')
  })

  it('non-temporal categories are a ranking (bar)', () => {
    expect(
      classifyRelation([
        { label: 'Ilhéus', value: 1 },
        { label: 'Itabuna', value: 2 },
      ]),
    ).toBe('bar')
  })

  it('honors a forced type and refuses an unknown one', () => {
    expect(classifyRelation([{ label: 'A', value: 1 }], 'bar')).toBe('bar')
    expect(classifyRelation([{ label: 'A', value: 1 }], 'pie')).toBe('pie')
    expect(() => classifyRelation([{ label: 'A', value: 1 }], 'donut')).toThrow(/desconhecido/)
  })
})

describe('isTemporalLabel', () => {
  it('detects years, months, quarters and P-periods', () => {
    for (const label of ['2024', '2024-06', '06/2024', 'jan/24', 'Q1', 'T3', 'P2']) {
      expect(isTemporalLabel(label), label).toBe(true)
    }
    expect(isTemporalLabel('Ilhéus')).toBe(false)
  })
})

describe('validateSpec — fail-closed guardrails', () => {
  const base = { chartType: 'bar', rows: [{ label: 'A', value: 1 }], headline: 'Takeaway' }

  it('accepts a valid spec', () => {
    expect(validateSpec(base)).toBe(base)
  })

  it('refuses pizza with an actionable message', () => {
    expect(() => validateSpec({ ...base, chartType: 'pie' })).toThrow(/barras horizontais/)
  })

  it(`refuses more than ${MAX_POINTS} points`, () => {
    const rows = Array.from({ length: MAX_POINTS + 1 }, (_v, index) => ({
      label: `A${index}`,
      value: 1,
    }))
    expect(() => validateSpec({ ...base, rows })).toThrow(/resuma/)
  })

  it('caps a story ranking at five points (approved vertical rhythm)', () => {
    const rows = Array.from({ length: MAX_POINTS_STORY + 1 }, (_v, index) => ({
      label: `A${index}`,
      value: index + 1,
    }))
    expect(() => validateSpec({ ...base, size: 'feed', rows })).not.toThrow()
    expect(() => validateSpec({ ...base, size: 'story', rows })).toThrow(/cinco|5/)
  })

  it('refuses negative values (bars come from zero)', () => {
    expect(() => validateSpec({ ...base, rows: [{ label: 'A', value: -1 }] })).toThrow(/zero/)
  })

  it('refuses a missing headline', () => {
    expect(() => validateSpec({ ...base, headline: '' })).toThrow(/manchete/)
  })

  it('refuses an unknown size', () => {
    expect(() => validateSpec({ ...base, size: 'huge' })).toThrow(/tamanho inválido/)
  })

  it('refuses a highlight that is not in the data', () => {
    expect(() => validateSpec({ ...base, highlight: 'Sumiu' })).toThrow(/destaque/)
  })

  it('refuses an anchor with more than one value', () => {
    expect(() =>
      validateSpec({
        ...base,
        chartType: 'anchor',
        rows: [
          { label: 'A', value: 1 },
          { label: 'B', value: 2 },
        ],
      }),
    ).toThrow(/âncora/)
  })

  it('refuses an unlabeled bar row', () => {
    expect(() => validateSpec({ ...base, rows: [{ label: '', value: 1 }] })).toThrow(/rótulo/)
  })

  it('accepts an optional unit suffix and a relation kicker', () => {
    expect(validateSpec({ ...base, unit: '%', kicker: 'Comparação' })).toMatchObject({
      unit: '%',
      kicker: 'Comparação',
    })
  })

  it('refuses a non-string unit and an empty kicker', () => {
    expect(() => validateSpec({ ...base, unit: 10 })).toThrow(/unidade/)
    expect(() => validateSpec({ ...base, kicker: '  ' })).toThrow(/kicker/)
  })

  it('accepts the neutral piece flag and refuses the highlight conflict', () => {
    expect(validateSpec({ ...base, noHighlight: true })).toMatchObject({ noHighlight: true })
    expect(() => validateSpec({ ...base, noHighlight: 'sim' })).toThrow(/noHighlight/)
    expect(() => validateSpec({ ...base, noHighlight: true, highlight: 'A' })).toThrow(/exclusivos/)
  })

  it('certifies the two-positive column pair and fails closed outside it', () => {
    const pair = {
      ...base,
      chartType: 'column',
      rows: [
        { label: 'Municipal', value: 60.57 },
        { label: 'Estadual', value: 54.67 },
      ],
    }
    expect(validateSpec({ ...pair, dualPositive: true })).toMatchObject({ dualPositive: true })
    expect(() => validateSpec({ ...pair, dualPositive: 'sim' })).toThrow(/dualPositive/)
    expect(() => validateSpec({ ...base, dualPositive: true })).toThrow(/coluna/)
    expect(() =>
      validateSpec({ ...pair, dualPositive: true, rows: [{ label: 'A', value: 1 }] }),
    ).toThrow(/2 categorias/)
    expect(() => validateSpec({ ...pair, dualPositive: true, highlight: 'Municipal' })).toThrow(
      /destaque/,
    )
    expect(() => validateSpec({ ...pair, dualPositive: true, noHighlight: true })).toThrow(
      /no-highlight/,
    )
    expect(() => validateSpec({ ...pair, dualPositive: true, size: 'square' })).toThrow(/feed/)
  })
})

describe('parseInput — two aligned measures become series, not a ranking', () => {
  it('reads a time table with two measures as two series', () => {
    const dataset = parseInput({
      text: 'Ano,Estadual,Municipal\n2017,9807,24002\n2018,10636,24438\n',
      format: 'csv',
    })
    expect(dataset.rows).toEqual([])
    expect(dataset.series).toEqual([
      {
        name: 'Estadual',
        rows: [
          { label: '2017', value: 9807 },
          { label: '2018', value: 10636 },
        ],
      },
      {
        name: 'Municipal',
        rows: [
          { label: '2017', value: 24002 },
          { label: '2018', value: 24438 },
        ],
      },
    ])
    expect(dataset.issues).toEqual([])
  })

  it('reads a time table with three measures as three series (C204)', () => {
    const dataset = parseInput({
      text: 'Ano,Estadual,Municipal,Privada\n2015,235,93,832\n2016,235,93,724\n',
      format: 'csv',
    })
    expect(dataset.series).toHaveLength(3)
    expect(dataset.series?.[2]).toMatchObject({ name: 'Privada' })
    expect(dataset.issues).toEqual([])
  })

  it('keeps a two-column table on the single-series path', () => {
    const dataset = parseInput({ text: 'cidade,votos\nIlhéus,84\nItabuna,68\n', format: 'csv' })
    expect(dataset.series).toBeUndefined()
    expect(dataset.rows).toHaveLength(2)
  })

  it('flags a non-numeric cell of a series table instead of dropping the column', () => {
    const dataset = parseInput({
      text: 'Ano,Estadual,Municipal\n2017,9807,???\n2018,10636,24438\n',
      format: 'csv',
    })
    expect(dataset.issues.join(' ')).toContain('Municipal · 2017')
  })
})

describe('parseInput — the variation bar (delta)', () => {
  it('reads a table whose header names the two periods', () => {
    const dataset = parseInput({
      text: 'Tipo\t2020\tjul/2026\nESF · Saúde da Família\t58\t63\nENASF-AB · Ampliado\t5\t5\n',
      format: 'tsv',
      delta: true,
    })
    expect(dataset.startLabel).toBe('2020')
    expect(dataset.endLabel).toBe('jul/2026')
    expect(dataset.rows).toEqual([
      { label: 'ESF · Saúde da Família', initial: 58, final: 63 },
      { label: 'ENASF-AB · Ampliado', initial: 5, final: 5 },
    ])
    expect(dataset.issues).toEqual([])
  })

  it('flags a missing measure instead of completing it', () => {
    const dataset = parseInput({
      text: 'Tipo\t2020\t2026\nECR · Consultórios na Rua\t-\t1\n',
      format: 'tsv',
      delta: true,
    })
    expect(dataset.rows).toEqual([])
    expect(dataset.issues.join(' ')).toContain('inicial')
  })

  it('reads the delta table from the free-text path too', () => {
    const dataset = parseInput({
      text: 'Tipo\t2020\t2026\nESB · Saúde Bucal\t40\t53\n',
      format: 'txt',
      delta: true,
    })
    expect(dataset.rows).toEqual([{ label: 'ESB · Saúde Bucal', initial: 40, final: 53 }])
  })
})

describe('validateSpec — the two-series time line', () => {
  const seriesSpec = (overrides = {}) => ({
    chartType: 'line',
    headline: 'Internações crescem no hospital estadual e recuam no municipal',
    series: [
      {
        name: 'Estadual',
        tone: 'good',
        rows: [
          { label: '2017', value: 9807 },
          { label: '2026', value: 23294 },
        ],
      },
      {
        name: 'Municipal',
        tone: 'bad',
        rows: [
          { label: '2017', value: 24002 },
          { label: '2026', value: 15948 },
        ],
      },
    ],
    ...overrides,
  })

  it('accepts aligned temporal series with paired tones', () => {
    expect(validateSpec(seriesSpec())).toBeTruthy()
  })

  it('refuses a multi-series spec that is not a line', () => {
    expect(() => validateSpec(seriesSpec({ chartType: 'bar' }))).toThrow(/linha/)
  })

  it(`refuses fewer than ${MIN_SERIES} and more than ${MAX_SERIES} series`, () => {
    const [first, second] = seriesSpec().series
    const third = { ...first, name: 'Terceira' }
    expect(() => validateSpec(seriesSpec({ series: [first] }))).toThrow(/séries/)
    expect(() =>
      validateSpec(seriesSpec({ series: [first, second, third, { ...third, name: 'Quarta' }] })),
    ).toThrow(/séries/)
  })

  it('refuses misaligned periods between the series', () => {
    const [first, second] = seriesSpec().series
    const drifted = {
      ...second,
      rows: [
        { label: '2018', value: 1 },
        { label: '2026', value: 2 },
      ],
    }
    expect(() => validateSpec(seriesSpec({ series: [first, drifted] }))).toThrow(/mesmos períodos/)
  })

  it('refuses categorical labels on the time axis', () => {
    const categorical = (name: string, tone: string) => ({
      name,
      tone,
      rows: [
        { label: 'Ilhéus', value: 1 },
        { label: 'Itabuna', value: 2 },
      ],
    })
    expect(() =>
      validateSpec(
        seriesSpec({ series: [categorical('Estadual', 'good'), categorical('Municipal', 'bad')] }),
      ),
    ).toThrow(/períodos/)
  })

  it('refuses a one-sided, repeated or unknown tone', () => {
    const [first, second] = seriesSpec().series
    expect(() =>
      validateSpec(seriesSpec({ series: [{ ...first, tone: undefined }, second] })),
    ).toThrow(/tom/)
    expect(() => validateSpec(seriesSpec({ series: [{ ...first, tone: 'bad' }, second] }))).toThrow(
      /mesmo tom/,
    )
    expect(() =>
      validateSpec(seriesSpec({ series: [{ ...first, tone: 'ótimo' }, second] })),
    ).toThrow(/tom inválido/)
  })

  it(`caps each series at ${MAX_POINTS_LINE} points`, () => {
    const [first, second] = seriesSpec().series
    const rows = Array.from({ length: MAX_POINTS_LINE + 1 }, (_v, index) => ({
      label: `${2000 + index}`,
      value: index + 1,
    }))
    expect(() => validateSpec(seriesSpec({ series: [{ ...first, rows }, second] }))).toThrow(
      /resuma/,
    )
    expect(MAX_POINTS_LINE).toBeGreaterThan(MAX_POINTS)
  })

  it('marks the projection only on the last period', () => {
    expect(validateSpec(seriesSpec({ projectedLabel: '2026' }))).toBeTruthy()
    expect(() => validateSpec(seriesSpec({ projectedLabel: '2017' }))).toThrow(/último período/)
  })

  it('refuses --highlight on a two-series line (the tones carry the meaning)', () => {
    expect(() => validateSpec(seriesSpec({ highlight: 'Estadual' }))).toThrow(/highlight/)
  })

  it('accepts a confirmed crossing and refuses an unconfirmed one', () => {
    expect(validateSpec(seriesSpec({ crossingLabel: '2026' }))).toBeTruthy()
    expect(() => validateSpec(seriesSpec({ crossingLabel: '2017' }))).toThrow(/primeiro/)
    const [first, second] = seriesSpec().series
    const alreadyAhead = {
      ...second,
      rows: [
        { label: '2017', value: 1 },
        { label: '2026', value: 2 },
      ],
    }
    expect(() =>
      validateSpec(seriesSpec({ crossingLabel: '2026', series: [first, alreadyAhead] })),
    ).toThrow(/ultrapassagem/)
  })

  it('refuses a crossing annotation without the tone pair', () => {
    const { series } = seriesSpec()
    const neutral = series.map(({ name, rows }) => ({ name, rows }))
    expect(() => validateSpec(seriesSpec({ crossingLabel: '2026', series: neutral }))).toThrow(
      /tons/,
    )
  })
})

describe('validateSpec — the three-series time line (C205 extension)', () => {
  const annual = (values: number[]) =>
    values.map((value, index) => ({ label: `${2015 + index}`, value }))
  const tripleSpec = (overrides = {}) => ({
    chartType: 'line',
    size: 'feed',
    headline: 'Hospital estadual puxa a ampliação de leitos de internação',
    series: [
      {
        name: 'Hospital Estadual',
        tone: 'good',
        rows: annual([235, 235, 256, 256, 256, 256, 256, 256, 369, 369, 369, 369]),
      },
      {
        name: 'Rede municipal',
        tone: 'neutral',
        rows: annual([93, 93, 105, 93, 93, 93, 93, 93, 113, 113, 113, 113]),
      },
      {
        name: 'Rede privada',
        tone: 'neutral-dark',
        rows: annual([832, 724, 707, 644, 521, 496, 459, 489, 508, 536, 500, 510]),
      },
    ],
    ...overrides,
  })

  it('accepts three aligned temporal series with the informed triad', () => {
    expect(validateSpec(tripleSpec())).toBeTruthy()
  })

  it('accepts the twelve points per series of the certified extension', () => {
    expect(tripleSpec().series[0].rows).toHaveLength(MAX_POINTS_LINE)
  })

  it('refuses a partial or repeated triad', () => {
    const [first, second, third] = tripleSpec().series
    expect(() =>
      validateSpec(tripleSpec({ series: [{ ...first, tone: undefined }, second, third] })),
    ).toThrow(/três tons/)
    expect(() =>
      validateSpec(tripleSpec({ series: [{ ...first, tone: 'neutral' }, second, third] })),
    ).toThrow(/distintos/)
    expect(() =>
      validateSpec(tripleSpec({ series: [first, second, { ...third, tone: 'bad' }] })),
    ).toThrow(/tom inválido/)
    expect(() =>
      validateSpec(tripleSpec({ series: [first, second, { ...third, tone: 'medium' }] })),
    ).toThrow(/tom inválido/)
  })

  it('refuses projection and crossing on the three-series extension', () => {
    expect(() => validateSpec(tripleSpec({ projectedLabel: '2026' }))).toThrow(/projeção/)
    expect(() => validateSpec(tripleSpec({ crossingLabel: '2026' }))).toThrow(/cruzamento/)
  })

  it('certifies the three-series line on the feed canvas only', () => {
    expect(validateSpec(tripleSpec({ size: 'feed' }))).toBeTruthy()
    expect(() => validateSpec(tripleSpec({ size: 'square' }))).toThrow(/feed/)
    expect(() => validateSpec(tripleSpec({ size: 'story' }))).toThrow(/feed/)
  })

  it('keeps the alignment, temporal and ceiling guardrails of the pair', () => {
    const [first, second, third] = tripleSpec().series
    const drifted = {
      ...third,
      rows: third.rows.map((row, index) => (index === 0 ? { ...row, label: '2014' } : row)),
    }
    expect(() => validateSpec(tripleSpec({ series: [first, second, drifted] }))).toThrow(
      /mesmos períodos/,
    )
    const rows = Array.from({ length: MAX_POINTS_LINE + 1 }, (_v, index) => ({
      label: `${2000 + index}`,
      value: index + 1,
    }))
    expect(() => validateSpec(tripleSpec({ series: [{ ...first, rows }, second, third] }))).toThrow(
      /resuma/,
    )
  })
})

describe('validateSpec — the variation bar (delta)', () => {
  const deltaSpec = (overrides = {}) => ({
    chartType: 'delta',
    headline: 'Quatro dos sete tipos seguem sem ampliação desde 2020',
    startLabel: '2020',
    endLabel: 'jul/2026',
    rows: [
      { label: 'ESF · Saúde da Família', initial: 58, final: 63 },
      { label: 'ESB · Saúde Bucal', initial: 40, final: 53 },
      { label: 'ENASF-AB · Ampliado', initial: 5, final: 5 },
    ],
    ...overrides,
  })

  it('accepts a zero-based variation with the two periods named', () => {
    expect(validateSpec(deltaSpec())).toBeTruthy()
  })

  it('refuses a retraction and points to the two-series line', () => {
    expect(() =>
      validateSpec(deltaSpec({ rows: [{ label: 'ESF', initial: 63, final: 58 }] })),
    ).toThrow(/linha de duas séries/)
  })

  it('refuses --highlight (the two-tone pair is fixed and there is no valence)', () => {
    expect(() => validateSpec(deltaSpec({ highlight: 'ESB · Saúde Bucal' }))).toThrow(/destaque/)
  })

  it('requires the two period labels of the gutter', () => {
    expect(() => validateSpec(deltaSpec({ startLabel: '' }))).toThrow(/startLabel/)
    expect(() => validateSpec(deltaSpec({ endLabel: undefined }))).toThrow(/endLabel/)
  })

  it(`caps the categories at ${MAX_POINTS}`, () => {
    const rows = Array.from({ length: MAX_POINTS + 1 }, (_v, index) => ({
      label: `Tipo ${index}`,
      initial: 1,
      final: 2,
    }))
    expect(() => validateSpec(deltaSpec({ rows }))).toThrow(/resuma/)
  })

  it('allows the seven categories on the Stories canvas (no ranking cut)', () => {
    const rows = Array.from({ length: MAX_POINTS }, (_v, index) => ({
      label: `Tipo ${index}`,
      initial: 1,
      final: 2,
    }))
    expect(validateSpec(deltaSpec({ size: 'story', rows }))).toBeTruthy()
  })

  it('refuses a missing or negative measure and a non-positive final', () => {
    expect(() => validateSpec(deltaSpec({ rows: [{ label: 'ESF', initial: 1 }] }))).toThrow(
      /final ausente/,
    )
    expect(() =>
      validateSpec(deltaSpec({ rows: [{ label: 'ESF', initial: -1, final: 2 }] })),
    ).toThrow(/negativo/)
    expect(() =>
      validateSpec(deltaSpec({ rows: [{ label: 'ESF', initial: 0, final: 0 }] })),
    ).toThrow(/não positivo/)
  })

  it('is the relation of a two-measure table and still honours an explicit type', () => {
    const rows = [{ label: 'ESF', initial: 1, final: 2 }]
    expect(classifyRelation(rows)).toBe('delta')
    expect(classifyRelation(rows, 'bar')).toBe('bar')
  })
})

describe('contracts', () => {
  it('declares the v1 types plus the delta variant, labels and sizes', () => {
    expect(CHART_TYPES).toEqual(['bar', 'column', 'line', 'anchor', 'delta'])
    expect(RELATION_LABEL.line).toBe('Série de tempo')
    expect(RELATION_LABEL.delta).toBe('Variação no período')
    expect(SIZES.story).toMatchObject({ width: 1080, height: 1920, safeTop: 250, safeBottom: 250 })
    expect(SIZES.feed).toMatchObject({ width: 1080, height: 1350 })
    expect(SIZES.square).toMatchObject({ width: 1080, height: 1080 })
  })
})
