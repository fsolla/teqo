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
