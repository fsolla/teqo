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

describe('renderChartHtml — canvas and template', () => {
  it('authors the feed canvas at exactly 1080×1350', () => {
    const html = renderChartHtml(spec())
    expect(html).toContain('width: 1080px; height: 1350px')
  })

  it('adapts to square and to Stories safe bands', () => {
    expect(renderChartHtml(spec({ size: 'square' }))).toContain('width: 1080px; height: 1080px')
    const story = renderChartHtml(spec({ size: 'story' }))
    expect(story).toContain('width: 1080px; height: 1920px')
    expect(story).toContain('padding: 306px 84px 310px')
  })

  it('keeps the headline at/above the minimum size', () => {
    expect(renderChartHtml(spec())).toMatch(/\.headline \{ font-size: 67px/)
    expect(renderChartHtml(spec({ size: 'story' }))).toMatch(/\.headline \{ font-size: 78px/)
  })

  it('carries the source and the provisional brand lockup inside the image', () => {
    const html = renderChartHtml(spec())
    expect(html).toContain('TSE 2026')
    expect(html).toContain('JORGE SOLLA')
    expect(html).toContain('MANDATO DEPUTADO FEDERAL')
  })

  it('marks exactly one row with the Solla highlight', () => {
    const html = renderChartHtml(spec())
    expect((html.match(/bar highlight/g) ?? []).length).toBe(1)
    expect(html).toContain('Território B')
    expect(html).toContain('#c51414')
  })

  it('sorts the ranking by value, descending', () => {
    const html = renderChartHtml(spec())
    expect(html.indexOf('Território A')).toBeLessThan(html.indexOf('Território B'))
    expect(html.indexOf('Território B')).toBeLessThan(html.indexOf('Território C'))
  })

  it('renders a column chart with a zero base line', () => {
    const html = renderChartHtml(spec({ chartType: 'column' }))
    expect(html).toContain('columns')
    expect(html).toContain('column highlight')
  })

  it('renders the line chart with the last point highlighted', () => {
    const html = renderChartHtml(spec({ chartType: 'line' }))
    expect(html).toContain('<polyline')
    expect(html).toContain('#c51414')
  })

  it('renders the anchor with the value and the copy', () => {
    const html = renderChartHtml(
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
    const html = renderChartHtml(spec({ headline: '<script>x</script>', source: 'a & b' }))
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a &amp; b')
  })
})

describe('SOLLA_PALETTE — the verbatim brand colors', () => {
  it('matches the intention literals', () => {
    expect(SOLLA_PALETTE).toMatchObject({
      highlight: '#c51414',
      brandDark: '#ae1603',
      ptRed: '#a21c1c',
      ptYellow: '#ffe607',
      paper: '#faf9f7',
    })
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
    const html = renderChartHtml(seriesSpec())
    expect(html).toContain('dual-line-plot')
    expect(html).toContain('Comparação no tempo')
    expect(html).toContain('↑ amplia')
    expect(html).toContain('↓ recua')
    expect(html).toContain('+121%')
    expect(html).toContain('−23%')
    expect(html).toContain('23.294')
  })

  it('annotates the confirmed crossing without inferring it by itself', () => {
    expect(renderChartHtml(seriesSpec())).toContain('ultrapassa')
    expect(renderChartHtml(seriesSpec({ crossingLabel: null }))).not.toContain('ultrapassa')
  })

  it('uses the compact feed rhythm of the variant', () => {
    const html = renderChartHtml(seriesSpec())
    expect(html).toContain('font-size: 60px')
    expect(html).toContain('margin-top: 28px')
  })

  it('adapts the plot and the rhythm to square and to Stories', () => {
    const square = renderChartHtml(seriesSpec({ size: 'square' }))
    expect(square).toContain('viewBox="0 0 880 440"')
    expect(square).toContain('font-size: 54px')
    const story = renderChartHtml(seriesSpec({ size: 'story' }))
    expect(story).toContain('viewBox="0 0 880 700"')
    expect(story).toContain('font-size: 64px')
  })

  it('keeps red out of the plot when the comparison is neutral', () => {
    const { series } = seriesSpec()
    const html = renderChartHtml(
      seriesSpec({
        crossingLabel: null,
        series: series.map((serie: { name: string; rows: unknown[] }) => ({
          name: serie.name,
          rows: serie.rows,
        })),
      }),
    )
    const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'))
    expect(svg).not.toContain('#c51414')
    expect(svg).not.toContain('amplia')
  })

  it('carries the projection note and the source inside the image', () => {
    const html = renderChartHtml(seriesSpec())
    expect(html).toContain('2026 é projeção pela média de janeiro a junho × 2.')
    expect(html).toContain('Ministério da Saúde — SIH/SUS')
    expect(html).toContain('JORGE SOLLA')
  })
})
