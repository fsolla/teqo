import { describe, expect, it } from 'vitest'

import {
  findLastGreenPromoteSha,
  greenCiStageHeadShas,
} from '../../scripts/lib/agent-promote-target.mjs'

describe('greenCiStageHeadShas', () => {
  it('collects only completed successes', () => {
    const green = greenCiStageHeadShas([
      { headSha: 'aaa', status: 'completed', conclusion: 'success' },
      { headSha: 'bbb', status: 'completed', conclusion: 'failure' },
      { headSha: 'ccc', status: 'in_progress', conclusion: null },
    ])
    expect([...green]).toEqual(['aaa'])
  })
})

describe('findLastGreenPromoteSha', () => {
  it('returns the newest green commit ahead of main', () => {
    const green = new Set(['bbb', 'ddd'])
    expect(findLastGreenPromoteSha(['ccc', 'bbb', 'aaa'], green)).toBe('bbb')
  })

  it('returns stage head when it is green', () => {
    const green = new Set(['ccc'])
    expect(findLastGreenPromoteSha(['ccc', 'bbb'], green)).toBe('ccc')
  })

  it('returns null when nothing ahead is green', () => {
    const green = new Set(['zzz'])
    expect(findLastGreenPromoteSha(['ccc', 'bbb'], green)).toBeNull()
  })

  it('returns null when there is nothing ahead of main', () => {
    expect(findLastGreenPromoteSha([], new Set(['aaa']))).toBeNull()
  })
})
