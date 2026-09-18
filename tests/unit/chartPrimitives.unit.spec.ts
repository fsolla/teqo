import { describe, expect, it } from 'vitest'

import {
  CHART_COLORS,
  barChart,
  columnChart,
  lineChart,
  proportionalPercent,
  stackedColumnChart,
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
    expect(svg).toContain('fill="#c51414"')
  })
})
