import { describe, expect, it } from 'vitest'

import { externalLinkTarget } from '@/lib/ai/markdownLinks'

/**
 * B187: only absolute web URLs get the new-tab treatment in the Sollinha chat;
 * every internal `/campanha/...` path and non-web protocol stays a plain
 * same-tab anchor (internal navigation behavior belongs to B188).
 */

describe('externalLinkTarget', () => {
  it('opens absolute http and https URLs in a new tab with noopener', () => {
    expect(externalLinkTarget('https://saude.ba.gov.br')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(externalLinkTarget('http://example.com')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(externalLinkTarget('HTTPS://EXAMPLE.COM')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  })

  it('opens protocol-relative URLs in a new tab', () => {
    expect(externalLinkTarget('//saude.ba.gov.br')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  })

  it('leaves internal campaign paths as same-tab anchors', () => {
    expect(externalLinkTarget('/campanha/municipios/ilheus')).toBeNull()
    expect(externalLinkTarget('/campanha')).toBeNull()
  })

  it('leaves non-web protocols and anchors untouched', () => {
    expect(externalLinkTarget('mailto:contato@jorgesolla.com.br')).toBeNull()
    expect(externalLinkTarget('tel:+557132323232')).toBeNull()
    expect(externalLinkTarget('#topo')).toBeNull()
  })

  it('leaves empty hrefs untouched', () => {
    expect(externalLinkTarget('')).toBeNull()
  })
})
