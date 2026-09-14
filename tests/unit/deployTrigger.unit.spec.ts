import { describe, expect, it } from 'vitest'

import {
  ACTIVE_RUN_STATUSES,
  decidePreflight,
  decideRequeue,
} from '../../scripts/lib/deploy-trigger.mjs'

const run = (id: number, status: string) => ({ id, status })

describe('deploy-trigger (OPS104)', () => {
  it('keeps only queued/in_progress as active statuses', () => {
    expect([...ACTIVE_RUN_STATUSES].sort()).toEqual(['in_progress', 'queued'])
  })

  it('never blocks a manual dispatch', () => {
    const verdict = decidePreflight({
      eventName: 'workflow_dispatch',
      currentRunId: 1,
      runs: [run(2, 'in_progress')],
    })
    expect(verdict).toEqual({ shouldDeploy: true, reason: 'dispatch-manual', activeRunIds: [] })
  })

  it('allows a push when no other run is active', () => {
    const verdict = decidePreflight({
      eventName: 'push',
      currentRunId: 10,
      runs: [run(10, 'in_progress'), run(9, 'completed')],
    })
    expect(verdict.shouldDeploy).toBe(true)
    expect(verdict.reason).toBe('sem-deploy-ativo')
  })

  it('skips the push when another run is queued or in_progress', () => {
    const verdict = decidePreflight({
      eventName: 'push',
      currentRunId: 10,
      runs: [run(11, 'queued'), run(12, 'in_progress')],
    })
    expect(verdict).toEqual({
      shouldDeploy: false,
      reason: 'deploy-ativo',
      activeRunIds: [11, 12],
    })
  })

  it('excludes the current run from the active count', () => {
    const verdict = decidePreflight({
      eventName: 'push',
      currentRunId: '10',
      runs: [run(10, 'in_progress')],
    })
    expect(verdict.shouldDeploy).toBe(true)
  })

  it('does not count waiting (production approval) or completed runs as active', () => {
    const verdict = decidePreflight({
      eventName: 'push',
      currentRunId: 10,
      runs: [run(7, 'waiting'), run(8, 'completed'), run(9, 'requested')],
    })
    expect(verdict.shouldDeploy).toBe(true)
  })

  it('decideRequeue: same head is a no-op', () => {
    expect(decideRequeue({ runSha: 'abc', headSha: 'abc' })).toEqual({
      dispatch: false,
      reason: 'head-atual',
    })
  })

  it('decideRequeue: a newer head dispatches', () => {
    expect(decideRequeue({ runSha: 'abc', headSha: 'def' })).toEqual({
      dispatch: true,
      reason: 'head-avancou',
    })
  })

  it('decideRequeue: a missing SHA is a no-op the CLI treats as an error', () => {
    expect(decideRequeue({ runSha: undefined, headSha: 'def' })).toEqual({
      dispatch: false,
      reason: 'sha-ausente',
    })
    expect(decideRequeue({})).toEqual({ dispatch: false, reason: 'sha-ausente' })
  })
})
