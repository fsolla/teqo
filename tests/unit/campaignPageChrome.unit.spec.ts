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

  it('resolves section list chrome without prose subtitle', () => {
    expect(resolveCampaignPageChrome('/campanha/municipios', 'coordinator')).toEqual({
      title: 'Municípios',
    })
    expect(resolveCampaignPageChrome('/campanha/liderancas', 'advisor')).toEqual({
      title: 'Lideranças',
    })
    expect(resolveCampaignPageChrome('/campanha/agenda', 'coordinator')).toEqual({
      title: 'Agenda',
    })
  })

  it('returns null for entity detail pages (chrome set per route)', () => {
    expect(resolveCampaignPageChrome('/campanha/municipios/cairu', 'coordinator')).toBeNull()
    expect(resolveCampaignPageChrome('/campanha/liderancas/42', 'advisor')).toBeNull()
    expect(resolveCampaignPageChrome('/campanha/atividades/foo', 'coordinator')).toBeNull()
  })

  it('keeps section title on parallel municipio v2 route (B147 soft-dep)', () => {
    expect(resolveCampaignPageChrome('/campanha/municipio/cairu/v2', 'coordinator')).toEqual({
      title: 'Municípios',
    })
  })

  it('resolves quadro without role-based prose subtitle', () => {
    expect(resolveCampaignPageChrome('/campanha/quadro', 'advisor')).toEqual({ title: 'Quadro' })
    expect(resolveCampaignPageChrome('/campanha/quadro', 'coordinator')).toEqual({
      title: 'Quadro',
    })
  })

  it('keeps prose subtitle on out-of-scope sections', () => {
    expect(resolveCampaignPageChrome('/campanha/conceitos', 'coordinator')?.subtitle).toContain(
      'cada número',
    )
    expect(resolveCampaignPageChrome('/campanha/perfil', 'coordinator')?.subtitle).toContain(
      'biometria',
    )
  })

  it('builds tab metadata from catalog', () => {
    expect(campaignPageMetadataFromCatalog('contatos').title).toBe('Contatos')
    expect(campaignPageMetadataFromCatalog('meusContatos').title).toBe('Meus contatos')
    expect(campaignPageMetadata(null).title).toBe('Início')
  })

  it('separates staff contatos from the leader meus-contatos (C139)', () => {
    expect(resolveCampaignPageChrome('/campanha/contatos', 'coordinator')).toEqual({
      title: 'Contatos',
      subtitle: 'Fichas da campanha — atualize dados e fale com as pessoas.',
    })
    expect(resolveCampaignPageChrome('/campanha/meus-contatos', 'leader')).toEqual({
      title: 'Meus contatos',
      subtitle: 'Cadastre apoiadores pelo celular. Só você vê os contatos que criou aqui.',
    })
  })
})
