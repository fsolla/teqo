import { describe, expect, it } from 'vitest'

import {
  inventoryE2ESource,
  renderE2EInventoryTable,
  renderSlowestFilesTable,
  summarizeVitestReport,
} from '../../scripts/lib/testing-audit-metrics-core.mjs'

const reportFixture = () => ({
  numTotalTests: 3,
  numFailedTests: 0,
  testResults: [
    {
      name: '/abs/repo/tests/unit/b.unit.spec.ts',
      endTime: 1600,
      startTime: 500,
      assertionResults: [
        { title: 'slow one', status: 'passed', duration: 400 },
        { title: 'fast one', status: 'passed', duration: 10 },
      ],
    },
    {
      name: '/abs/repo/tests/unit/a.unit.spec.ts',
      endTime: 2000,
      startTime: 1000,
      assertionResults: [{ title: 'only one', status: 'passed', duration: 50 }],
    },
  ],
})

describe('summarizeVitestReport', () => {
  it('totals files and tests and sorts rows by duration desc', () => {
    const summary = summarizeVitestReport(reportFixture())

    expect(summary.totals).toEqual({ files: 2, tests: 3, failedTests: 0, durationMs: 2100 })
    expect(summary.rows.map((row) => row.file)).toEqual([
      'tests/unit/b.unit.spec.ts',
      'tests/unit/a.unit.spec.ts',
    ])
  })

  it('keeps the slowest assertion per file', () => {
    const summary = summarizeVitestReport(reportFixture())

    expect(summary.rows[0].slowestTest).toBe('slow one')
    expect(summary.rows[0].slowestMs).toBe(400)
  })

  it('falls back to summed durations when the payload lacks timestamps', () => {
    const payload = {
      testResults: [
        { name: '/x/y.unit.spec.ts', assertionResults: [{ title: 't', duration: 120 }] },
      ],
    }

    expect(summarizeVitestReport(payload).rows[0].durationMs).toBe(120)
  })

  it('rejects payloads without testResults', () => {
    expect(() => summarizeVitestReport({})).toThrow('missing testResults')
  })
})

describe('renderSlowestFilesTable', () => {
  it('renders a markdown table limited to top N rows', () => {
    const table = renderSlowestFilesTable(summarizeVitestReport(reportFixture()), { top: 1 })

    expect(table.split('\n')).toHaveLength(3)
    expect(table).toContain('| tests/unit/b.unit.spec.ts | 2 | 1.1s | slow one (0.4s) |')
  })
})

describe('inventoryE2ESource', () => {
  it('counts describe and test blocks statically', () => {
    const row = inventoryE2ESource({
      file: 'tests/e2e/x.e2e.spec.ts',
      content: "test('a', () => {})\n describe('d', () => { test('b', () => {}) })",
    })

    expect(row).toEqual({ file: 'tests/e2e/x.e2e.spec.ts', describes: 1, tests: 2 })
  })

  it('does not count words merely containing the keywords', () => {
    const row = inventoryE2ESource({
      file: 'tests/e2e/x.e2e.spec.ts',
      content: '// contest( and described( are not blocks',
    })

    expect(row.tests).toBe(0)
    expect(row.describes).toBe(0)
  })
})

describe('renderE2EInventoryTable', () => {
  it('marks durations as not measured overnight', () => {
    const table = renderE2EInventoryTable([
      { file: 'tests/e2e/x.e2e.spec.ts', describes: 1, tests: 4 },
    ])

    expect(table).toContain(
      '| tests/e2e/x.e2e.spec.ts | 1 | 4 | não medido — execução noturna proibida |',
    )
  })
})
