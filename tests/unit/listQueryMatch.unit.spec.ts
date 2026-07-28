import { describe, expect, it } from 'vitest'

import { isSameListHref } from '@/lib/listQueryMatch'

describe('isSameListHref', () => {
  it('ignores param order', () => {
    expect(
      isSameListHref(
        '/campanha/municipios?priority=alta&region=Sert%C3%A3o%20Produtivo',
        '/campanha/municipios?region=Sert%C3%A3o%20Produtivo&priority=alta',
      ),
    ).toBe(true)
  })

  it('compares repeated params as the set they encode', () => {
    expect(
      isSameListHref(
        '/campanha/municipios?level=n3&level=n4',
        '/campanha/municipios?level=n4&level=n3',
      ),
    ).toBe(true)
    expect(
      isSameListHref('/campanha/municipios?level=n3&level=n4', '/campanha/municipios?level=n3'),
    ).toBe(false)
  })

  it('normalizes percent-encoding on both sides', () => {
    expect(
      isSameListHref('/campanha/municipios?q=ita%C3%BAna', '/campanha/municipios?q=itaúna'),
    ).toBe(true)
  })

  it('ignores the params it is told to ignore, so page 3 of a saved filter still matches', () => {
    expect(
      isSameListHref(
        '/campanha/municipios?priority=alta&page=3',
        '/campanha/municipios?priority=alta',
        ['page'],
      ),
    ).toBe(true)
    expect(
      isSameListHref(
        '/campanha/municipios?priority=alta&page=3',
        '/campanha/municipios?priority=alta',
      ),
    ).toBe(false)
  })

  it('does not match a different recorte or a different path', () => {
    expect(
      isSameListHref(
        '/campanha/municipios?priority=alta',
        '/campanha/municipios?priority=alta&kind=zona',
      ),
    ).toBe(false)
    expect(isSameListHref('/campanha/municipios', '/campanha/territorios')).toBe(false)
  })

  it('matches the bare list against itself', () => {
    expect(isSameListHref('/campanha/municipios', '/campanha/municipios')).toBe(true)
    expect(isSameListHref('/campanha/municipios', '/campanha/municipios?page=2', ['page'])).toBe(
      true,
    )
  })
})
