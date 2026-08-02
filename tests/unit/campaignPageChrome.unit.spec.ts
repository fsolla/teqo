import { describe, expect, it } from 'vitest'

import {
  campaignPageMetadata,
  campaignPageMetadataFromCatalog,
  resolveCampaignPageChrome,
} from '@/lib/campaignPageChrome'

describe('campaignPageChrome', () => {
  it('returns null for home', () => {
    expect(resolveCampaignPageChrome('/campanha', 'coordinator')).toBeNull()
    expect(resolveCampaignPageChrome('/campanha/', 'advisor')).toBeNull()
  })

  it('resolves section list chrome', () => {
    expect(resolveCampaignPageChrome('/campanha/municipios', 'coordinator')).toEqual({
      title: 'Municípios',
      subtitle:
        'Os 435 municípios da campanha: um por município da Bahia — em Salvador, uma zona eleitoral cada.',
    })
  })

  it('resolves detail pages with section title only', () => {
    expect(resolveCampaignPageChrome('/campanha/municipios/cairu', 'coordinator')).toEqual({
      title: 'Municípios',
    })
  })

  it('uses role-based subtitle for quadro', () => {
    expect(resolveCampaignPageChrome('/campanha/quadro', 'advisor')?.subtitle).toContain(
      'sua assessoria',
    )
    expect(resolveCampaignPageChrome('/campanha/quadro', 'coordinator')?.subtitle).toContain(
      'geral',
    )
  })

  it('builds tab metadata from catalog', () => {
    expect(campaignPageMetadataFromCatalog('contatos').title).toBe('Contatos')
    expect(campaignPageMetadata(null).title).toBe('Início')
  })
})
