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

// C237 degraded variant: the same delta dataset drawn as paired columns — the
// initial in the neutral tone, the recent one in the official red (the positive
// datum is shared by every pair), with the period legend and the value over
// each bar. An initial of zero has no gray column at all.
const pairedRows = [
  { label: 'Cirurgia geral', initial: 592, final: 1433 },
  { label: 'Ortopedia', initial: 182, final: 755 },
  { label: 'Oncologia', initial: 0, final: 134 },
]
const pairedSpec = (overrides = {}) => ({
  chartType: 'delta',
  size: 'feed',
  pairedColumns: true,
  headline: 'Ortopedia cresce 4,1 vezes, neurocirurgia quadruplica e oncologia sai do zero',
  subtitle: 'Leitos por tipo na rede estadual · cirurgia: 966 → 2.750',
  source: 'DATASUS / Ministério da Saúde',
  startLabel: '2006',
  endLabel: '2026',
  rows: pairedRows,
  ...overrides,
})

describe('renderChartHtml — paired columns (C237)', () => {
  it('renders the period legend, the pair labels and the recent red column', () => {
    const html = render(pairedSpec())
    expect(html).toContain('Variação no período')
    expect(html).toContain('paired-swatch initial')
    expect(html).toContain('paired-swatch final')
    expect(html).toContain('>2006</span>')
    expect(html).toContain('>2026</span>')
    expect(html).toContain('paired-bar recent')
    expect(html).toContain('class="paired-label">Cirurgia geral')
  })

  it('proportions both bars of a pair against the biggest final value', () => {
    const html = render(pairedSpec())
    expect(html).toContain('height:41.3%') // 592 / 1433
    expect(html).toContain('height:52.7%') // 755 / 1433
    expect(html).toContain('height:100%') // 1433
    expect(html).toContain('height:9.4%') // 134 / 1433
  })

  it('leaves the zero initial without the gray column and keeps the value', () => {
    const html = render(pairedSpec())
    const labelAt = html.indexOf('paired-label">Oncologia')
    const start = html.lastIndexOf('class="paired-pair"', labelAt)
    const pair = html.slice(start, labelAt)
    expect(pair).toContain('paired-value">0')
    expect(pair).not.toContain('<span class="paired-bar" style')
    expect(pair).toContain('paired-bar recent')
  })

  it('sorts the pairs by the final value', () => {
    const html = render(pairedSpec())
    const body = html.slice(html.indexOf('<div class="paired-grade'))
    expect(body.indexOf('Cirurgia geral')).toBeLessThan(body.indexOf('Ortopedia'))
    expect(body.indexOf('Ortopedia')).toBeLessThan(body.indexOf('Oncologia'))
  })

  it('adapts the rhythm and keeps every pair on the Stories canvas', () => {
    const story = render(pairedSpec({ size: 'story' }))
    expect(story).toContain('padding: 306px 84px 310px')
    expect(story).toMatch(/\.headline \{ font-size: 60px/)
    expect((story.match(/class="paired-pair"/g) ?? []).length).toBe(pairedRows.length)
  })
})

// C238 prototype: under `spec.motion` the same paired piece carries the motion
// stylesheet and the schedule as inline `--md`/`--mud` vars; without it the
// markup stays byte-identical to the approved still.
describe('renderChartHtml — motion (C238)', () => {
  it('injects the motion stylesheet and the animated classes only under spec.motion', () => {
    const still = render(pairedSpec())
    expect(still).not.toContain('motion-')
    expect(still).not.toContain('--md:')

    const html = render(pairedSpec({ motion: true }))
    expect(html).toContain('class="canvas motion"')
    expect(html).toContain('@keyframes motion-grow')
    expect(html).toContain('.motion .motion-sweep')
    expect(html).toContain('animation-fill-mode: backwards')
  })

  it('serializes the pair schedule into inline --md/--mud vars', () => {
    const html = render(pairedSpec({ motion: true }))
    expect(html).toContain('--md:1.1s;--mud:0.75s') // first pair bars
    expect(html).toContain('--md:1.4s') // second pair
    expect(html).toContain('--md:1.7s') // third pair
    expect(html).toContain('--md:1.9s;--mud:0.3s') // first pair values, after the bar
    expect(html).toContain('--md:1.25s;--mud:0.3s') // first pair label, with the growth
  })

  it('keeps the animated markup in the paired body of every size', () => {
    const story = render(pairedSpec({ size: 'story', motion: true }))
    expect((story.match(/class="paired-bar(?!-)/g) ?? []).length).toBe(5) // 3 pairs × 2 bars − the zero gray
    expect((story.match(/ motion-grow"/g) ?? []).length).toBe(5)
    expect(story).toContain('@keyframes motion-rise')
  })

  it('grows the two-period columns left to right and lands their values (C239)', () => {
    const columnSpec = {
      chartType: 'column',
      size: 'feed',
      motion: true,
      headline: 'UTIs na rede estadual crescem quase 9 vezes desde 2005',
      subtitle: 'Leitos de UTI nos hospitais estaduais · Bahia',
      source: 'DATASUS / Ministério da Saúde',
      rows: [
        { label: '2005', value: 179 },
        { label: '2026', value: 1536 },
      ],
    }
    const html = render(columnSpec)
    expect(html).toContain('--md:1.1s;--mud:0.75s') // first column
    expect(html).toContain('--md:1.45s;--mud:0.75s') // recent column, red
    expect(html).toContain('--md:2.25s;--mud:0.3s') // recent value, after the bar
    expect(html).toContain('column highlight motion-grow')
  })

  it('rises the anchor number and fades the copy, never counting (C239)', () => {
    const anchorSpec = {
      chartType: 'anchor',
      size: 'feed',
      motion: true,
      headline: 'Bahia contrata mais de mil leitos privados para o SUS',
      subtitle: 'Rede complementar do SUS · Bahia · 2026',
      source: 'DATASUS / Ministério da Saúde',
      rows: [{ label: 'leitos privados contratados para atendimento pelo SUS', value: 1130 }],
    }
    const html = render(anchorSpec)
    expect(html).toContain('anchor-number motion-rise')
    expect(html).toContain('--md:1.05s;--mud:0.6s')
    expect(html).toContain('anchor-copy motion-fade')
    expect(html).toContain('--md:1.7s;--mud:0.45s')
  })
})

// C205 approved extension: the three-series observed line runs on the feed
// canvas only, with the triad good/neutral/neutral-dark (red circle "↑ amplia",
// gray diamond "↗ cresce", ink triangle "↘ diminui") and no projection.
const tripleAnnual = (values: number[]) =>
  values.map((value, index) => ({ label: `${2015 + index}`, value }))
const tripleSpec = (overrides = {}) => ({
  chartType: 'line',
  size: 'feed',
  headline: 'Hospital estadual puxa a ampliação de leitos de internação',
  subtitle: 'Vitória da Conquista (BA) · leitos existentes · 2015–2026',
  source: 'Ministério da Saúde — CNES · leitos de internação por esfera jurídica',
  note: 'Último ponto: jul/2026. Rede privada = leitos empresariais + sem fins lucrativos.',
  series: [
    {
      name: 'Hospital Estadual',
      tone: 'good',
      rows: tripleAnnual([235, 235, 256, 256, 256, 256, 256, 256, 369, 369, 369, 369]),
    },
    {
      name: 'Rede municipal',
      tone: 'neutral',
      rows: tripleAnnual([93, 93, 105, 93, 93, 93, 93, 93, 113, 113, 113, 113]),
    },
    {
      name: 'Rede privada',
      tone: 'neutral-dark',
      rows: tripleAnnual([832, 724, 707, 644, 521, 496, 459, 489, 508, 536, 500, 510]),
    },
  ],
  ...overrides,
})

describe('renderChartHtml — the three-series time line (C205)', () => {
  it('renders the triple plot with the fixed kicker and the three valence words', () => {
    const html = render(tripleSpec())
    expect(html).toContain('triple-line-plot')
    expect(html).toContain('canvas triple-series')
    expect(html).toContain('Comparação no tempo')
    expect(html).toContain('↑ amplia')
    expect(html).toContain('↗ cresce')
    expect(html).toContain('↘ diminui')
    expect(html).not.toContain('↓ recua')
    const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'))
    expect(svg).not.toContain('#184e92')
    expect(html).toContain('369 · +57%')
    expect(html).toContain('510 · −39%')
  })

  it('uses the compact feed rhythm of the extension', () => {
    const html = render(tripleSpec())
    expect(html).toContain('font-size: 56px')
    expect(html).toContain('.plot { margin-top: 16px; }')
    expect(html).toContain('max-width: 570px')
  })

  it('keeps every projection artifact out of the observed series', () => {
    const html = render(tripleSpec())
    const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'))
    expect(svg).not.toContain('dasharray')
    expect(svg).not.toContain('projeção')
    expect(svg).not.toContain('fill-opacity')
  })

  it('carries the source, the monthly note and the official mark inside the image', () => {
    const html = render(tripleSpec())
    expect(html).toContain('Ministério da Saúde — CNES')
    expect(html).toContain('jul/2026')
    expect(html).toContain('alt="Jorge Solla — Deputado Federal"')
    expect(html).toContain('data:image/png;base64,')
  })
})

// C207 approved extension: the projected final period rides the same triad
// (feed only) with the neutral band, the dashed last segment and the three
// hollow markers, while the gutter variation still closes on the last observed
// period.
describe('renderChartHtml — the projected three-series line (C207)', () => {
  const html = render(tripleSpec({ projectedLabel: '2026' }))
  const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'))

  it('marks the canvas and brings band, label, dash and hollow markers', () => {
    expect(html).toContain('canvas triple-series triple-projected')
    expect(svg).toContain('class="triple-projection-band"')
    expect(svg).toContain('projeção')
    expect(svg.match(/class="triple-series-projection/g)).toHaveLength(3)
    expect(svg).toContain('class="triple-marker-projected triple-marker-projected-good"')
    expect(svg).toContain('class="triple-marker-projected triple-marker-projected-neutral"')
    expect(svg).toContain('class="triple-marker-projected triple-marker-projected-neutral-dark"')
    expect(svg).not.toContain('Todos os pontos de cada série são observados')
  })

  it('ports the C207 classes and the reduced projected metric size', () => {
    expect(html).toContain('.triple-projection-band { fill:')
    expect(html).toContain('.triple-projection-label { fill:')
    expect(html).toContain('.triple-marker-projected { fill:')
    expect(html).toContain('.triple-projected .triple-end-metric { font-size: 30px; }')
    expect(html).toContain('.triple-projected .source { max-width: 620px; }')
  })
})

describe('renderChartHtml — the shared footer (C206 brand mark)', () => {
  it('hugs the official asset ratio on the feed canvas', () => {
    const html = render(spec())
    expect(html).toContain('min-height: 171px')
    expect(html).toContain('.brand-logo-frame { width: 251px; height: 144px; flex: 0 0 251px; }')
    expect(html).toContain('width: 100%; height: 100%; object-fit: contain;')
  })

  it('adapts the footer and the mark to square and to Stories', () => {
    const square = render(spec({ size: 'square' }))
    expect(square).toContain('min-height: 128px')
    expect(square).toContain('width: 192px; height: 110px; flex-basis: 192px')
    expect(square).toContain('.source { font-size: 25px; }')
    const story = render(spec({ size: 'story' }))
    expect(story).toContain('min-height: 190px')
    expect(story).toContain('gap: 28px')
    expect(story).toContain('width: 279px; height: 160px; flex-basis: 279px')
  })
})
