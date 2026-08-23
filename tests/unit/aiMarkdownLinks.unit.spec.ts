import { describe, expect, it } from 'vitest'

import {
  externalLinkTarget,
  isCampaignInternalLink,
  shouldCloseDrawerOnLinkClick,
  type LinkClickMeta,
} from '@/lib/ai/markdownLinks'

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

describe('isCampaignInternalLink', () => {
  it('accepts campaign paths and the campaign root', () => {
    expect(isCampaignInternalLink('/campanha')).toBe(true)
    expect(isCampaignInternalLink('/campanha/')).toBe(true)
    expect(isCampaignInternalLink('/campanha/municipios')).toBe(true)
    expect(isCampaignInternalLink('/campanha/municipios/ilheus')).toBe(true)
  })

  it('rejects look-alike paths, web URLs and non-web protocols', () => {
    expect(isCampaignInternalLink('/campanha-mobile')).toBe(false)
    expect(isCampaignInternalLink('/campanhaX')).toBe(false)
    expect(isCampaignInternalLink('https://jorgesolla1313.com.br/campanha')).toBe(false)
    expect(isCampaignInternalLink('mailto:contato@jorgesolla.com.br')).toBe(false)
    expect(isCampaignInternalLink('')).toBe(false)
  })
})

describe('shouldCloseDrawerOnLinkClick', () => {
  const plainClick: LinkClickMeta = {
    button: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
  }

  it('closes the drawer on a plain internal link click on mobile', () => {
    expect(shouldCloseDrawerOnLinkClick('/campanha/municipios/ilheus', true, plainClick)).toBe(true)
    expect(shouldCloseDrawerOnLinkClick('/campanha', true, plainClick)).toBe(true)
  })

  it('never closes on desktop', () => {
    expect(shouldCloseDrawerOnLinkClick('/campanha/municipios/ilheus', false, plainClick)).toBe(
      false,
    )
  })

  it('never closes for external links (they open in a new tab)', () => {
    expect(shouldCloseDrawerOnLinkClick('https://saude.ba.gov.br', true, plainClick)).toBe(false)
    expect(shouldCloseDrawerOnLinkClick('mailto:contato@jorgesolla.com.br', true, plainClick)).toBe(
      false,
    )
  })

  it('keeps the drawer for modified clicks and middle clicks (new-tab navigation)', () => {
    for (const key of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const) {
      expect(
        shouldCloseDrawerOnLinkClick('/campanha/municipios/ilheus', true, {
          ...plainClick,
          [key]: true,
        }),
      ).toBe(false)
    }
    expect(
      shouldCloseDrawerOnLinkClick('/campanha/municipios/ilheus', true, {
        ...plainClick,
        button: 1,
      }),
    ).toBe(false)
  })

  it('respects a prevented default', () => {
    expect(
      shouldCloseDrawerOnLinkClick('/campanha/municipios/ilheus', true, {
        ...plainClick,
        defaultPrevented: true,
      }),
    ).toBe(false)
  })
})
