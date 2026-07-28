import { describe, expect, it } from 'vitest'

import { orderFilterOptionsSelectedFirst } from '@/lib/listFilterOptions'

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
  { value: 'd', label: 'D' },
] as const

describe('orderFilterOptionsSelectedFirst', () => {
  it('returns the same reference when nothing is selected', () => {
    const result = orderFilterOptionsSelectedFirst(options, [])
    expect(result.ordered).toBe(options)
    expect(result.selectedCount).toBe(0)
  })

  it('returns the same reference when every option is selected', () => {
    const result = orderFilterOptionsSelectedFirst(options, ['a', 'b', 'c', 'd'])
    expect(result.ordered).toBe(options)
    expect(result.selectedCount).toBe(4)
  })

  it('returns the same reference when selected values are all outside the set', () => {
    const result = orderFilterOptionsSelectedFirst(options, ['z', 'y'])
    expect(result.ordered).toBe(options)
    expect(result.selectedCount).toBe(0)
  })

  it('lifts selected options to the top in their original relative order', () => {
    const result = orderFilterOptionsSelectedFirst(options, ['c', 'a'])
    expect(result.ordered.map((option) => option.value)).toEqual(['a', 'c', 'b', 'd'])
    expect(result.selectedCount).toBe(2)
  })

  it('keeps unselected options in their original relative order', () => {
    const result = orderFilterOptionsSelectedFirst(options, ['d'])
    expect(result.ordered.map((option) => option.value)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('ignores selected values that are not among the options (stale facet)', () => {
    const result = orderFilterOptionsSelectedFirst(options, ['c', 'ghost'])
    expect(result.ordered.map((option) => option.value)).toEqual(['c', 'a', 'b', 'd'])
    expect(result.selectedCount).toBe(1)
  })

  it('does not duplicate when selected contains the same value twice', () => {
    const result = orderFilterOptionsSelectedFirst(options, ['b', 'b'])
    expect(result.ordered.map((option) => option.value)).toEqual(['b', 'a', 'c', 'd'])
    expect(result.selectedCount).toBe(1)
  })
})
