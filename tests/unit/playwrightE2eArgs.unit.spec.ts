import { describe, expect, it } from 'vitest'

import {
  buildPlaywrightE2eArgs,
  parsePassthroughArgs,
} from '../../scripts/lib/playwright-e2e-args.mjs'

// S6-FOLLOWUP (2026-08-18): the e2e CLI filters WERE ignored locally because
// the dev-mode project dependency chain drags every dependency project's files
// into a selected run (buildProjectsClosure). The helpers pin the generated
// argv: `--no-deps` on filtered runs only (full runs keep the OPS34 dev
// chain), generated scope paths after the `--` separator, and a verbatim
// passthrough (pnpm consumes the first `--`, so the script never sees it; flag
// values like `-g grade` must not be re-classified).
describe('parsePassthroughArgs', () => {
  it('returns nothing for a plain invocation', () => {
    expect(parsePassthroughArgs(['node', 'scripts/run-e2e-affected.mjs'])).toEqual([])
  })

  it('keeps bare args when pnpm consumed the `--` separator', () => {
    expect(
      parsePassthroughArgs(['node', 'scripts/run-e2e-affected.mjs', 'tests/x.e2e.spec.ts']),
    ).toEqual(['tests/x.e2e.spec.ts'])
  })

  it('strips exactly one leading `--` (direct invocation with separator)', () => {
    expect(
      parsePassthroughArgs(['node', 'scripts/run-e2e-affected.mjs', '--', '-g', 'grade']),
    ).toEqual(['-g', 'grade'])
  })

  it('keeps flags and flag values verbatim', () => {
    expect(
      parsePassthroughArgs([
        'node',
        'scripts/run-e2e-affected.mjs',
        '--grep=home',
        '-g',
        'grade',
        '--',
        'tests/x.e2e.spec.ts',
      ]),
    ).toEqual(['--grep=home', '-g', 'grade', '--', 'tests/x.e2e.spec.ts'])
  })
})

describe('buildPlaywrightE2eArgs', () => {
  it('keeps the full-suite form when nothing is filtered (dev chain intact)', () => {
    expect(buildPlaywrightE2eArgs({ scopeSpecPaths: [], passthroughArgs: [] })).toEqual([
      'test:e2e',
    ])
  })

  it('keeps non-filter flags on the full-suite form (shards, reporters, workers)', () => {
    expect(buildPlaywrightE2eArgs({ passthroughArgs: ['--shard=1/2', '--reporter=line'] })).toEqual(
      ['test:e2e', '--shard=1/2', '--reporter=line'],
    )
  })

  it('disables the dependency closure and separates generated paths with -- on filtered runs', () => {
    expect(
      buildPlaywrightE2eArgs({ scopeSpecPaths: ['tests/e2e/campaignHomeActions.e2e.spec.ts'] }),
    ).toEqual(['test:e2e', '--no-deps', '--', 'tests/e2e/campaignHomeActions.e2e.spec.ts'])
  })

  it('treats a bare passthrough path as a filtered run and adds --no-deps', () => {
    expect(buildPlaywrightE2eArgs({ passthroughArgs: ['tests/e2e/frontend.e2e.spec.ts'] })).toEqual(
      ['test:e2e', 'tests/e2e/frontend.e2e.spec.ts', '--no-deps'],
    )
  })

  it('treats filter flags (--project, -g/--grep) as filtered runs', () => {
    expect(buildPlaywrightE2eArgs({ passthroughArgs: ['--project=campaign'] })).toEqual([
      'test:e2e',
      '--project=campaign',
      '--no-deps',
    ])
    expect(buildPlaywrightE2eArgs({ passthroughArgs: ['-g', 'grade'] })).toEqual([
      'test:e2e',
      '-g',
      'grade',
      '--no-deps',
    ])
  })

  it('does not duplicate an explicit --no-deps passthrough', () => {
    expect(buildPlaywrightE2eArgs({ passthroughArgs: ['--no-deps'] })).toEqual([
      'test:e2e',
      '--no-deps',
    ])
  })

  it('merges scope paths and passthrough positionals in a single filtered run', () => {
    expect(
      buildPlaywrightE2eArgs({
        scopeSpecPaths: ['tests/e2e/a.e2e.spec.ts'],
        passthroughArgs: ['tests/e2e/b.e2e.spec.ts'],
      }),
    ).toEqual(['test:e2e', 'tests/e2e/b.e2e.spec.ts', '--no-deps', '--', 'tests/e2e/a.e2e.spec.ts'])
  })
})
