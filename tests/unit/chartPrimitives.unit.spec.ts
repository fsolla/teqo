import { describe, expect, it } from 'vitest'

import {
  CHART_COLORS,
  barChart,
  columnChart,
  dualLineChart,
  lineChart,
  proportionalPercent,
  stackedColumnChart,
  tripleLineChart,
  valueList,
} from '../../scripts/lib/chartPrimitives.mjs'

// C191: the chart primitives were extracted from dossieRender.mjs so the
// Instagram generator (second consumer) never grows a twin. These snapshots
// freeze the dossier emission byte-for-byte — a change here is a change to the
// published dossiê, not a cosmetic tweak.

describe('chartPrimitives — dossier emitters (byte-identical)', () => {
  it('barChart', () => {
    expect(
      barChart({
        rows: [
          { label: 'A', count: 3 },
          { label: 'B', count: 1 },
        ],
      }),
    ).toMatchInlineSnapshot(`
        "<svg class="chart" viewBox="0 0 330 42" role="img">
            <text x="0" y="14" class="chart-label">A</text>
                <rect x="118" y="5" width="186" height="12" rx="1" fill="#315c75" />
                <text x="308" y="14" class="chart-value">3</text><text x="0" y="33" class="chart-label">B</text>
                <rect x="118" y="24" width="62" height="12" rx="1" fill="#315c75" />
                <text x="184" y="33" class="chart-value">1</text>
          </svg>"
      `)
  })

  it('columnChart', () => {
    expect(
      columnChart({
        rows: [
          { key: '2020', value: 2 },
          { key: '2021', value: 4 },
        ],
        format: (row: { value: number }) => String(row.value),
      }),
    ).toMatchInlineSnapshot(`
      "<svg class="chart" viewBox="0 0 330 152" role="img">
          <rect x="6" y="65" width="156" height="49" fill="#315c75" />
              <text x="84.5" y="62" class="chart-value" text-anchor="middle">2</text>
              <text x="84.5" y="144" class="chart-label" text-anchor="middle">20</text><rect x="167" y="16" width="156" height="98" fill="#315c75" />
              <text x="245.5" y="13" class="chart-value" text-anchor="middle">4</text>
              <text x="245.5" y="144" class="chart-label" text-anchor="middle">21</text>
        </svg>"
    `)
  })

  it('stackedColumnChart', () => {
    expect(
      stackedColumnChart({
        rows: [
          {
            key: '2020',
            value: 3,
            segments: [
              { key: 'pago', amount: 2 },
              { key: 'empenhado', amount: 1 },
            ],
          },
        ],
        format: (row: { value: number }) => String(row.value),
      }),
    ).toMatchInlineSnapshot(`
      "<svg class="chart" viewBox="0 0 330 152" role="img">
          <rect x="6" y="49" width="317" height="65" fill="#285338" /><rect x="6" y="16" width="317" height="33" fill="#6b4918" />
              <text x="165" y="13" class="chart-value" text-anchor="middle">3</text>
              <text x="165" y="144" class="chart-label" text-anchor="middle">20</text>
        </svg>"
    `)
  })

  it('valueList', () => {
    expect(
      valueList({
        rows: [
          { label: 'A', value: 2 },
          { label: 'B', value: 1 },
        ],
        format: (row: { value: number }) => String(row.value),
      }),
    ).toMatchInlineSnapshot(`
      "<ul class="value-list">
          <li>
            <span>A</span>
            <span class="value-list-bar"><span style="width:100%"></span></span>
            <span class="value-list-value">2</span>
          </li><li>
            <span>B</span>
            <span class="value-list-bar"><span style="width:50%"></span></span>
            <span class="value-list-value">1</span>
          </li>
        </ul>"
    `)
  })

  it('escapes untrusted labels', () => {
    expect(barChart({ rows: [{ label: '<b>x</b>', count: 1 }] })).toContain('&lt;b&gt;')
  })

  it('keeps the dossier domain palette as the default', () => {
    expect(CHART_COLORS.default).toBe('#315c75')
    expect(CHART_COLORS.pago).toBe('#285338')
  })
})

describe('proportionalPercent — honest scale, zero stays zero', () => {
  it('maps value/max to 0..100 and floors a present value at 2%', () => {
    expect(proportionalPercent(84, 84)).toBe(100)
    expect(proportionalPercent(42, 84)).toBe(50)
    expect(proportionalPercent(1, 84)).toBe(2)
    expect(proportionalPercent(0, 84)).toBe(0)
    expect(proportionalPercent(5, 0)).toBe(100)
  })
})

describe('lineChart — series with one highlighted end', () => {
  const rows = [
    { label: '2020', value: 2 },
    { label: '2021', value: 4 },
  ]
  const svg = lineChart({ rows, format: (row: { value: number }) => String(row.value) })

  it('draws every label and the last value', () => {
    expect(svg).toContain('>2020<')
    expect(svg).toContain('>2021<')
    expect(svg).toContain('>4<')
  })

  it('marks the last point with the Solla red', () => {
    expect(svg).toContain('fill="#e4102f"')
  })
})

describe('dualLineChart — the approved two-series time line', () => {
  const annual = (values: number[]) =>
    values.map((value, index) => ({ label: `${2017 + index}`, value }))
  const series = [
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
  ]
  const colors = {
    good: '#e4102f',
    bad: '#78716c',
    neutralA: '#1c1917',
    neutralB: '#78716c',
    grid: '#a8a29e',
    paper: '#faf9f7',
    ink: '#1c1917',
    change: '#57534e',
  }
  const valence = { good: '↑ amplia', bad: '↓ recua' }
  const format = (row: { value: number }) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(row.value)
  const svg = dualLineChart({
    series,
    size: 'feed',
    projected: true,
    crossingLabel: '2024',
    colors,
    valence,
    format,
  })

  it('draws the good path in the mandate red and the bad one neutral', () => {
    expect(svg).toContain('class="dual-series dual-series-good"')
    expect(svg).toContain('stroke="#e4102f"')
    expect(svg).toContain('class="dual-series dual-series-bad"')
    expect(svg).toContain('stroke="#78716c"')
    expect(svg).toContain('<g class="dual-markers-good" fill="#e4102f"><circle')
    expect(svg).toContain('<g class="dual-markers-bad" fill="#78716c"><rect')
  })

  it('labels each line with name, value, valence word and observed change', () => {
    expect(svg).toContain('>Estadual<')
    expect(svg).toContain('>23.294<')
    expect(svg).toContain('>↑ amplia<')
    expect(svg).toContain('>+121% até 2025<')
    expect(svg).toContain('>Municipal<')
    expect(svg).toContain('>15.948<')
    expect(svg).toContain('>↓ recua<')
    expect(svg).toContain('>−23% até 2025<')
  })

  it('marks only the last segment as a projection', () => {
    expect(svg.match(/stroke-dasharray="18 12"/g)).toHaveLength(2)
    expect(svg).toContain('class="dual-projection-band"')
    expect(svg).toContain('>projeção<')
    expect(svg).toContain('class="dual-marker-projected dual-marker-projected-good"')
    expect(svg).toContain('class="dual-marker-projected dual-marker-projected-bad"')
  })

  it('annotates the confirmed crossing with ring, guide and box', () => {
    expect(svg).toContain('class="dual-crossing-guide"')
    expect(svg).toContain('class="dual-crossing-ring"')
    expect(svg).toContain('class="dual-crossing-box"')
    expect(svg).toContain('class="dual-crossing-year"')
    expect(svg).toContain('>2024<')
    expect(svg).toContain('class="dual-crossing-copy"')
    expect(svg).toContain('>ultrapassa<')
  })

  it('keeps the crossing out when it was not confirmed', () => {
    const withoutCrossing = dualLineChart({
      series,
      size: 'feed',
      projected: true,
      colors,
      valence,
      format,
    })
    expect(withoutCrossing).not.toContain('dual-crossing')
    expect(withoutCrossing).not.toContain('ultrapassa')
  })

  it('keeps the honest zero base and the shared legible ceiling', () => {
    expect(svg).toContain('viewBox="0 0 880 620"')
    expect(svg).toContain('y1="544"')
    expect(svg).toContain('>0<')
    expect(svg.match(/class="dual-grid-line"/g)).toHaveLength(2)
  })

  it('alternates the ten annual axis labels, always keeping first and last', () => {
    for (const label of ['2017', '2019', '2021', '2023', '2026']) {
      expect(svg).toContain(`>${label}<`)
    }
    for (const label of ['2018', '2020', '2022', '2025']) {
      expect(svg).not.toContain(`>${label}<`)
    }
  })

  it('adapts the geometry to square and to Stories', () => {
    const square = dualLineChart({
      series,
      size: 'square',
      projected: true,
      colors,
      valence,
      format,
    })
    expect(square).toContain('viewBox="0 0 880 440"')
    expect(square).toContain('stroke-dasharray="15 11"')
    expect(square).toContain('font-size="32"')
    const story = dualLineChart({ series, size: 'story', projected: true, colors, valence, format })
    expect(story).toContain('viewBox="0 0 880 700"')
    expect(story).toContain('stroke-dasharray="18 12"')
    expect(story).toContain('font-size="36"')
  })

  it('compares neutrally without valence or red when no tone is informed', () => {
    const neutral = dualLineChart({
      series: series.map(({ name, rows }) => ({ name, rows })),
      size: 'feed',
      projected: false,
      colors,
      valence,
      format,
    })
    expect(neutral).toContain('class="dual-series dual-series-a"')
    expect(neutral).toContain('class="dual-series dual-series-b"')
    expect(neutral).not.toContain('#e4102f')
    expect(neutral).not.toContain('amplia')
    expect(neutral).not.toContain('recua')
    expect(neutral).not.toContain('dual-projection-band')
  })

  it('escapes untrusted series names', () => {
    const evil = dualLineChart({
      series: [{ ...series[0], name: '<b>x</b>' }, series[1]],
      size: 'feed',
      projected: false,
      colors,
      valence,
      format,
    })
    expect(evil).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})

describe('tripleLineChart — the approved three-series extension (C205, feed)', () => {
  const annual = (values: number[]) =>
    values.map((value, index) => ({ label: `${2015 + index}`, value }))
  const series = [
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
  ]
  const colors = {
    good: '#e4102f',
    neutral: '#78716c',
    'neutral-dark': '#1c1917',
    grid: '#a8a29e',
    ink: '#1c1917',
  }
  const valence = { good: '↑ amplia', neutral: '↗ cresce', 'neutral-dark': '↘ diminui' }
  const format = (row: { value: number }) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(row.value)
  const svg = tripleLineChart({ series, colors, valence, format })

  it('draws the triad with color, word and one marker shape per tone', () => {
    expect(svg).toContain('class="triple-series triple-series-good"')
    expect(svg).toContain('stroke="#e4102f"')
    expect(svg).toContain('class="triple-series triple-series-neutral"')
    expect(svg).toContain('stroke="#78716c"')
    expect(svg).toContain('class="triple-series triple-series-neutral-dark"')
    expect(svg).toContain('stroke="#1c1917"')
    expect(svg).toContain('<g class="triple-markers-good" fill="#e4102f"><circle')
    expect(svg).toContain('<g class="triple-markers-neutral" fill="#78716c"><rect')
    expect(svg).toContain('transform="rotate(45 52 499)"')
    expect(svg).toContain('<g class="triple-markers-neutral-dark" fill="#1c1917"><path')
    expect(svg).toContain('>↑ amplia<')
    expect(svg).toContain('>↗ cresce<')
    expect(svg).toContain('>↘ diminui<')
    expect(svg).not.toContain('#184e92')
  })

  it('stacks the three-line end blocks by final point, metric and valence', () => {
    expect(svg).toContain('>Rede privada<')
    expect(svg).toContain('>510 · −39%<')
    expect(svg).toContain('>Hospital Estadual<')
    expect(svg).toContain('>369 · +57%<')
    expect(svg).toContain('>Rede municipal<')
    expect(svg).toContain('>113 · +22%<')
    expect(svg.indexOf('>Rede privada<')).toBeLessThan(svg.indexOf('>Hospital Estadual<'))
    expect(svg.indexOf('>Hospital Estadual<')).toBeLessThan(svg.indexOf('>Rede municipal<'))
  })

  it('keeps the wider data box, the shared zero base and the leader band', () => {
    expect(svg).toContain('viewBox="0 0 880 650"')
    expect(svg).toContain('x2="560"')
    expect(svg).toContain('y1="544"')
    expect(svg).toContain('>0<')
    expect(svg.match(/class="triple-grid-line"/g)).toHaveLength(2)
    expect(svg).toContain('points="570,295 580,295 590,108 594,108"')
    expect(svg).toContain('class="triple-end-leader"')
    expect(svg).toContain('x="600"')
  })

  it('draws every point observed — no projection artifact', () => {
    expect(svg).not.toContain('dasharray')
    expect(svg).not.toContain('projeção')
    expect(svg).not.toContain('fill-opacity')
    expect((svg.match(/class="triple-series/g) ?? []).length).toBe(3)
  })

  it('alternates the twelve annual labels, always keeping the first and the last', () => {
    for (const label of ['2015', '2017', '2019', '2021', '2023', '2026']) {
      expect(svg).toContain(`>${label}<`)
    }
    for (const label of ['2016', '2018', '2020', '2022', '2025']) {
      expect(svg).not.toContain(`>${label}<`)
    }
  })

  it('carries the observed series in the aria label', () => {
    expect(svg).toContain(
      'Hospital Estadual: de 235 em 2015 para 369 em 2026, aumento de 57 por cento',
    )
    expect(svg).toContain(
      'Rede privada: de 832 em 2015 para 510 em 2026, diminuição de 39 por cento',
    )
    expect(svg).toContain('Todos os pontos de cada série são observados')
  })

  it('escapes untrusted series names', () => {
    const evil = tripleLineChart({
      series: [{ ...series[0], name: '<b>x</b>' }, series[1], series[2]],
      colors,
      valence,
      format,
    })
    expect(evil).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
