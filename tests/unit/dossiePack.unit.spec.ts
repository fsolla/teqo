import { describe, expect, it } from 'vitest'

import { adjustPackPlan, packProbeSections } from '../../scripts/lib/dossiePack.mjs'

// C187 flowing sheets: the probe measures real heights and the packer decides
// how many units fit per sheet — sections multiply sheets, nothing is capped,
// and a row never splits across sheets. The builder then re-renders and
// measures, and `adjustPackPlan` moves rows until no page is half empty and
// none overflows.

const probe = [
  {
    key: 'era:C',
    overhead: 200,
    overheadContinuation: 100,
    rows: [
      { units: [0], cost: 100 },
      { units: [1], cost: 100 },
      { units: [2, 3], cost: 150 },
      { units: [4, 5], cost: 150 },
    ],
  },
  {
    key: 'news',
    overhead: 100,
    overheadContinuation: 100,
    rows: [
      { units: [0], cost: 60 },
      { units: [1], cost: 60 },
    ],
  },
]

describe('packProbeSections', () => {
  it('packs rows in order up to the budget, never splitting a row', () => {
    const plan = packProbeSections(probe, 550)
    expect(plan['era:C']).toEqual([2, 4])
    expect(plan.news).toEqual([2])
  })

  it('keeps the sheet reserve free for the block margins', () => {
    const rows = [
      { units: [0], cost: 400 },
      { units: [1], cost: 150 },
    ]
    expect(packProbeSections([{ key: 'x', overhead: 0, rows }], 560, 0).x).toEqual([2])
    expect(packProbeSections([{ key: 'x', overhead: 0, rows }], 560, 60).x).toEqual([1, 1])
  })

  it('uses the smaller continuation overhead after the first sheet', () => {
    const plan = packProbeSections(
      [
        {
          key: 'era:B',
          overhead: 300,
          overheadContinuation: 60,
          rows: [
            { units: [0], cost: 180 },
            { units: [1], cost: 180 },
            { units: [2], cost: 180 },
          ],
        },
      ],
      500,
    )
    expect(plan['era:B']).toEqual([1, 2])
  })
})

describe('adjustPackPlan', () => {
  const anchors = { 'era:C': 'era-c' }

  it('gives the last row of an overflowing sheet to the next chunk', () => {
    const adjusted = adjustPackPlan({
      plan: { 'era:C': [4, 2] },
      probe,
      sheets: [
        { page: 'era-c', height: 1200, used: 1200 },
        { page: 'era-c-2', height: 1123, used: 300 },
      ],
      anchors,
      budgetPx: 1133,
    })
    expect(adjusted).toEqual({ 'era:C': [2, 4] })
  })

  it('grows a sheet with room by taking the first row of the next chunk', () => {
    const adjusted = adjustPackPlan({
      plan: { 'era:C': [4, 2] },
      probe,
      sheets: [
        { page: 'era-c', height: 1123, used: 500 },
        { page: 'era-c-2', height: 1123, used: 300 },
      ],
      anchors,
      budgetPx: 1133,
    })
    expect(adjusted).toEqual({ 'era:C': [6] })
  })

  it('returns null when nothing can move (settled plan)', () => {
    const adjusted = adjustPackPlan({
      plan: { 'era:C': [4, 2] },
      probe,
      sheets: [
        { page: 'era-c', height: 1123, used: 1100 },
        { page: 'era-c-2', height: 1123, used: 300 },
      ],
      anchors,
      budgetPx: 1133,
    })
    expect(adjusted).toBeNull()
  })
})
