// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  CONFLICT_MARKER_RE,
  findConflictMarkerLines,
  markdownPathsOf,
} from '../../scripts/lib/conflictMarkers.mjs'

describe('conflictMarkers (shared with the OPS41 unit scan)', () => {
  it('matches plain and indented open markers', () => {
    expect(CONFLICT_MARKER_RE.test('<<<<<<< HEAD')).toBe(true)
    expect(CONFLICT_MARKER_RE.test('  <<<<<<< HEAD')).toBe(true)
    expect(CONFLICT_MARKER_RE.test('\t<<<<<<< branch')).toBe(true)
  })

  it('matches plain and indented close markers', () => {
    expect(CONFLICT_MARKER_RE.test('>>>>>>> branch')).toBe(true)
    expect(CONFLICT_MARKER_RE.test('    >>>>>>> branch')).toBe(true)
  })

  it('matches the corrupted closer form that shipped in OPS33', () => {
    expect(CONFLICT_MARKER_RE.test('> > > > > > > 9e18bec8')).toBe(true)
    expect(CONFLICT_MARKER_RE.test('  > > > > > > > 9e18bec8')).toBe(true)
  })

  it('does not match ordinary markdown lines', () => {
    expect(CONFLICT_MARKER_RE.test('- item de lista')).toBe(false)
    expect(CONFLICT_MARKER_RE.test('> citação simples')).toBe(false)
    expect(CONFLICT_MARKER_RE.test('=======')).toBe(false)
  })

  it('reports 1-based offending lines', () => {
    const offenders = findConflictMarkerLines('linha boa\n<<<<<<< HEAD\nlinha boa')
    expect(offenders).toEqual([{ line: 2, text: '<<<<<<< HEAD' }])
  })

  it('reports every offender in a file', () => {
    const offenders = findConflictMarkerLines('<<<<<<< A\n>>>>>>> B\n')
    expect(offenders.map((offender) => offender.line)).toEqual([1, 2])
  })

  it('returns [] for clean content', () => {
    expect(findConflictMarkerLines('markdown limpo\n')).toEqual([])
  })
})

describe('markdownPathsOf', () => {
  it('filters to markdown/mdc paths anywhere (incl. repo root — OPS41 file)', () => {
    expect(
      markdownPathsOf([
        'docs/CHANGELOG-AGENTS.md',
        'src/lib/foo.ts',
        'docs/changelog/2026-08-13-ops44.md',
        'AGENTS.md',
        '.agents/rules/agent-pr-workflow.mdc',
        'package.json',
      ]),
    ).toEqual([
      'docs/CHANGELOG-AGENTS.md',
      'docs/changelog/2026-08-13-ops44.md',
      'AGENTS.md',
      '.agents/rules/agent-pr-workflow.mdc',
    ])
  })
})
