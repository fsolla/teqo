import { describe, expect, it } from 'vitest'

import { renderChartHtml, SOLLA_PALETTE } from '../../scripts/lib/graficosInstagramRender.mjs'

// C191: the renderer ports the approved hi-fi template
// (docs/plans/graficos-dados-instagram-ui-design.html) class-by-class. These
// pins freeze the export canvas size, the palette, the minimum typography and
// the safe-band adaptation for Stories.

const rows = [
  { label: 'Território A', value: 84 },
  { label: 'Território B', value: 68 },
  { label: 'Território C', value: 53 },
]

const spec = (overrides = {}) => ({
  chartType: 'bar',
  size: 'feed',
  headline: 'Um território concentra o maior resultado',
  subtitle: 'Valores de 2026',
  source: 'TSE 2026',
  highlight: 'Território B',
  rows,
  ...overrides,
})

// C203: the official kit mark travels as a data URI injected by the entry.
const brandLogo = 'data:image/png;base64,QzIwMw=='
const render = (chartSpec: Record<string, unknown>) => renderChartHtml(chartSpec, { brandLogo })

describe('renderChartHtml — canvas and template', () => {
  it('authors the feed canvas at exactly 1080×1350', () => {
    const html = render(spec())
    expect(html).toContain('width: 1080px; height: 1350px')
  })

  it('adapts to square and to Stories safe bands', () => {
    expect(render(spec({ size: 'square' }))).toContain('width: 1080px; height: 1080px')
    const story = render(spec({ size: 'story' }))
    expect(story).toContain('width: 1080px; height: 1920px')
    expect(story).toContain('padding: 306px 84px 310px')
  })

  it('keeps the headline at/above the minimum size', () => {
    expect(render(spec())).toMatch(/\.headline \{ font-size: 67px/)
    expect(render(spec({ size: 'story' }))).toMatch(/\.headline \{ font-size: 78px/)
  })

  it('carries the source and the official kit mark inside the image', () => {
    const html = render(spec())
    expect(html).toContain('TSE 2026')
    expect(html).toContain('brand-logo-frame')
    expect(html).toContain('data:image/png;base64,')
    expect(html).toContain('alt="Jorge Solla — Deputado Federal"')
    expect(html).not.toContain('MANDATO DEPUTADO FEDERAL')
  })

  it('fails closed without the official kit mark', () => {
    expect(() => renderChartHtml(spec())).toThrow(/marca oficial/)
    expect(() => renderChartHtml(spec(), { brandLogo: 'https://example.com/logo.png' })).toThrow(
      /marca oficial/,
    )
  })

  it('marks exactly one row with the Solla highlight', () => {
    const html = render(spec())
    expect((html.match(/bar highlight/g) ?? []).length).toBe(1)
    expect(html).toContain('Território B')
    expect(html).toContain('#e4102f')
    expect(html).not.toContain('#c51414')
  })

  it('sorts the ranking by value, descending', () => {
    const html = render(spec())
    expect(html.indexOf('Território A')).toBeLessThan(html.indexOf('Território B'))
    expect(html.indexOf('Território B')).toBeLessThan(html.indexOf('Território C'))
  })

  it('renders a column chart with a zero base line', () => {
    const html = render(spec({ chartType: 'column' }))
    expect(html).toContain('columns')
    expect(html).toContain('column highlight')
    // Few columns are capped and centered; four or more keep the 1fr rhythm.
    expect(html).toContain('grid-template-columns:repeat(3, minmax(0, 320px))')
    expect(html).toContain('justify-content: center')
  })

  it('appends the optional unit to value labels and honors a relation kicker', () => {
    const html = render(
      spec({
        chartType: 'column',
        unit: '%',
        kicker: 'Comparação',
        rows: [
          { label: 'Municipal (Esaú Matos)', value: 60.57 },
          { label: 'Estadual (CHVC)', value: 54.67 },
        ],
      }),
    )
    expect(html).toContain('60,6%')
    expect(html).toContain('54,7%')
    expect(html).toContain('>Comparação<')
    expect(html).not.toContain('Poucos períodos')
  })

  it('carries the unit into the bar and the anchor value labels too', () => {
    expect(render(spec({ unit: '%' }))).toContain('84%')
    expect(
      render(spec({ chartType: 'anchor', unit: '%', rows: [{ label: '', value: 72 }] })),
    ).toContain('72%')
  })

  it(`renders the two-positive pair in the official red, by input order`, () => {
    const html = render(
      spec({
        chartType: 'column',
        unit: '%',
        dualPositive: true,
        rows: [
          { label: 'Municipal', value: 60.57 },
          { label: 'Estadual', value: 54.67 },
        ],
      }),
    )
    expect(html).toContain('dual-positive-plot')
    expect(html).toContain('column positive-a')
    expect(html).toContain('column positive-b')
    expect(html).not.toContain('column highlight')
    expect(html).toContain('grid-template-columns:repeat(2, minmax(0, 280px))')
    expect(html).toContain('60,6%')
    expect(html).toContain('54,7%')
    expect(html).toContain('font-size: 60px')
    // C203 + designer re-decision: one shared official red — never a second tone.
    expect(html).toContain('#e4102f')
    expect(html).not.toContain('#a21c1c')
  })

  it('keeps the red out of the plot when the piece is explicitly neutral', () => {
    const html = render(spec({ unit: '%', noHighlight: true }))
    expect(html).not.toContain('bar highlight')
    expect(html).toContain('84%')
    const column = render(spec({ chartType: 'column', noHighlight: true }))
    const plot = column.slice(column.indexOf('<div class="columns'), column.indexOf('<footer'))
    expect(plot).not.toContain('highlight')
    expect(plot).not.toContain('#e4102f')
  })

  it('renders the line chart with the last point highlighted', () => {
    const html = render(spec({ chartType: 'line' }))
    expect(html).toContain('<polyline')
    expect(html).toContain('#e4102f')
  })

  it('renders the anchor with the value and the copy', () => {
    const html = render(
      spec({
        chartType: 'anchor',
        rows: [{ label: '', value: 72 }],
        subtitle: 'unidades no período',
      }),
    )
    expect(html).toContain('72')
    expect(html).toContain('unidades no período')
    expect(html).toContain('anchor-number')
  })

  it('escapes untrusted headline and source', () => {
    const html = render(spec({ headline: '<script>x</script>', source: 'a & b' }))
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a &amp; b')
  })
})

describe('SOLLA_PALETTE — the official kit 1313 colors', () => {
  it('matches the gate literals and retires the provisional palette', () => {
    expect(SOLLA_PALETTE).toMatchObject({
      highlight: '#e4102f',
      brandBlue: '#184e92',
      paper: '#faf9f7',
    })
    expect(SOLLA_PALETTE).not.toHaveProperty('brandDark')
    expect(SOLLA_PALETTE).not.toHaveProperty('ptRed')
    expect(SOLLA_PALETTE).not.toHaveProperty('ptYellow')
  })
})

// C191 approved variant: the two-series time line carries valence by word +
// arrow + marker shape + color, on a shared zero-based scale.
const annual = (values: number[]) =>
  values.map((value, index) => ({ label: `${2017 + index}`, value }))
const seriesSpec = (overrides = {}) => ({
  chartType: 'line',
  size: 'feed',
  headline: 'Internações crescem no hospital estadual e recuam no municipal',
  subtitle: 'AIH aprovadas por ano · Vitória da Conquista (BA) · 2017–2026',
  source: 'Ministério da Saúde — SIH/SUS',
  note: '2026 é projeção pela média de janeiro a junho × 2.',
  projectedLabel: '2026',
  crossingLabel: '2024',
  series: [
    {
      name: 'Estadual',
      tone: 'good',
      rows: annual([9807, 10636, 11807, 10929, 13119, 14767, 14501, 20495, 21637, 23294]),
    },
    {
      name: 'Municipal',
      tone: 'bad',
      rows: annual([24002, 24438, 22269, 20305, 21562, 20608, 19983, 19726, 18588, 15948]),
    },
  ],
  ...overrides,
})

describe('renderChartHtml — the two-series time line', () => {
  it('renders the dual plot with the fixed kicker, changes and valence words', () => {
    const html = render(seriesSpec())
    expect(html).toContain('dual-line-plot')
    expect(html).toContain('Comparação no tempo')
    expect(html).toContain('↑ amplia')
    expect(html).toContain('↓ recua')
    expect(html).toContain('+121%')
    expect(html).toContain('−23%')
    expect(html).toContain('23.294')
  })

  it('annotates the confirmed crossing without inferring it by itself', () => {
    expect(render(seriesSpec())).toContain('ultrapassa')
    expect(render(seriesSpec({ crossingLabel: null }))).not.toContain('ultrapassa')
  })

  it('uses the compact feed rhythm of the variant', () => {
    const html = render(seriesSpec())
    expect(html).toContain('font-size: 60px')
    expect(html).toContain('margin-top: 28px')
  })

  it('adapts the plot and the rhythm to square and to Stories', () => {
    const square = render(seriesSpec({ size: 'square' }))
    expect(square).toContain('viewBox="0 0 880 440"')
    expect(square).toContain('font-size: 54px')
    const story = render(seriesSpec({ size: 'story' }))
    expect(story).toContain('viewBox="0 0 880 700"')
    expect(story).toContain('font-size: 64px')
  })

  it('keeps red out of the plot when the comparison is neutral', () => {
    const { series } = seriesSpec()
    const html = render(
      seriesSpec({
        crossingLabel: null,
        series: series.map((serie: { name: string; rows: unknown[] }) => ({
          name: serie.name,
          rows: serie.rows,
        })),
      }),
    )
    const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'))
    expect(svg).not.toContain('#e4102f')
    expect(svg).not.toContain('amplia')
  })

  it('carries the projection note and the source inside the image', () => {
    const html = render(seriesSpec())
    expect(html).toContain('2026 é projeção pela média de janeiro a junho × 2.')
    expect(html).toContain('Ministério da Saúde — SIH/SUS')
    expect(html).toContain('alt="Jorge Solla — Deputado Federal"')
  })
})

// C191 approved variant: the variation bar (delta) draws 0→initial in the base
// tone and initial→final in the lighter tone, the two values in a tabular
// gutter; a flat category has no extension segment and the red stays out of the
// plot (the piece has no valence).
const deltaRows = [
  { label: 'ESF · Saúde da Família', initial: 58, final: 63 },
  { label: 'ESB · Saúde Bucal', initial: 40, final: 53 },
  { label: 'ENASF-AB · Ampliado', initial: 5, final: 5 },
  { label: 'EABP · Atenção Primária Prisional', initial: 1, final: 4 },
  { label: 'EMAD · Atenção Domiciliar', initial: 1, final: 1 },
]
const deltaSpec = (overrides = {}) => ({
  chartType: 'delta',
  size: 'feed',
  headline: 'Quatro dos sete tipos de equipe de saúde seguem sem ampliação desde 2020',
  subtitle: 'Vitória da Conquista — número de equipes por tipo (2020 → jul/2026)',
  source: 'Ministério da Saúde — CNES',
  note: 'Sem variação: EMAD, EMAP, ENASF-AB e ECR.',
  startLabel: '2020',
  endLabel: 'jul/2026',
  rows: deltaRows,
  ...overrides,
})

describe('renderChartHtml — the variation bar (delta)', () => {
  it('renders the fixed kicker, the periods and the two-value gutter', () => {
    const html = render(deltaSpec())
    expect(html).toContain('Variação no período')
    expect(html).toContain('delta-period">2020')
    expect(html).toContain('delta-period">jul/2026')
    expect(html).toContain('delta-value initial">58')
    expect(html).toContain('delta-value final">63')
  })

  it('sorts by the final value and keeps the red out of the plot', () => {
    const html = render(deltaSpec())
    const body = html.slice(html.indexOf('<div class="delta-grade'))
    expect(body.indexOf('ESF · Saúde da Família')).toBeLessThan(body.indexOf('ESB · Saúde Bucal'))
    expect(body.indexOf('ESB · Saúde Bucal')).toBeLessThan(body.indexOf('ENASF-AB'))
    const plot = body.slice(0, body.indexOf('<footer'))
    expect(plot).not.toContain('#e4102f')
  })

  it('leaves a flat category without the extension segment', () => {
    const html = render(deltaSpec())
    const start = html.indexOf('class="delta-row is-flat"')
    const flat = html.slice(start, html.indexOf('class="delta-row"', start))
    expect(flat).not.toContain('delta-ext')
    expect(flat).toContain('delta-value initial">5')
    expect(flat).toContain('delta-value final">5')
  })

  it('proportions base and extension against the biggest final value', () => {
    const html = render(deltaSpec())
    expect(html).toContain('width:92.1%')
    expect(html).toContain('width:7.9%')
  })

  it('bolds the sigla before the middle dot', () => {
    expect(render(deltaSpec())).toContain('<b>ESF</b> · Saúde da Família')
  })

  it('adapts the rhythm and keeps every category on the Stories canvas', () => {
    const story = render(deltaSpec({ size: 'story' }))
    expect(story).toContain('padding: 306px 84px 310px')
    expect(story).toMatch(/\.headline \{ font-size: 64px/)
    expect((story.match(/class="delta-row/g) ?? []).length).toBe(deltaRows.length)
  })
})
