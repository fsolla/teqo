import { describe, expect, it } from 'vitest'

import {
  buildHomeSearchShareText,
  buildHomeSearchWhatsAppShareHref,
  buildWhatsAppTextShareUrl,
  resolveHomeSearchShareStrategy,
} from '@/lib/homeSearchShare'

describe('homeSearchShare', () => {
  it('builds share text from title and absolute URL', () => {
    expect(
      buildHomeSearchShareText('Atividade X', 'https://campanha.test/campanha/atividades/x'),
    ).toBe('Atividade X\nhttps://campanha.test/campanha/atividades/x')
  })

  it('builds wa.me text-only share URL', () => {
    const href = buildWhatsAppTextShareUrl('Olá\nhttps://example.com')
    expect(href).toBe('https://wa.me/?text=Ol%C3%A1%0Ahttps%3A%2F%2Fexample.com')
  })

  it('falls back to whatsapp strategy when navigator.share is unavailable', () => {
    expect(resolveHomeSearchShareStrategy()).toBe('whatsapp')
  })

  it('builds WhatsApp share href for desktop fallback', () => {
    const href = buildHomeSearchWhatsAppShareHref(
      'Demanda Y',
      'https://campanha.test/campanha/demandas/y',
    )
    expect(href).toContain('https://wa.me/?text=')
    expect(href).toContain('Demanda+Y')
    expect(href).toContain(encodeURIComponent('https://campanha.test/campanha/demandas/y'))
  })
})
