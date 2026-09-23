// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildContentPieceWhatsAppUrl,
  contentPieceShareLink,
  contentPieceVoteMessage,
} from '@/lib/contentPieceShare'

const ORIGIN = 'https://jorgesolla1313.com.br'
const LINK = 'https://jorgesolla1313.com.br/conteudos/fim-da-escala-6x1'

describe('content piece vote message (S27)', () => {
  it('uses the video literal with title and link', () => {
    expect(contentPieceVoteMessage('video', 'Fim da escala 6×1 é saúde', LINK)).toBe(
      `Estamos na reta final e o Jorge Solla 1313 precisa do seu voto. Olha esse vídeo: Fim da escala 6×1 é saúde — ${LINK}. Peça voto pra Solla 1313 pra quem você conhece.`,
    )
  })

  it('uses the audio literal', () => {
    expect(contentPieceVoteMessage('audio', 'Mensagem para o grupo', LINK)).toBe(
      `Ouça e mande pro grupo: Mensagem para o grupo — ${LINK}. Peça voto pra Solla 1313.`,
    )
  })

  it('uses the material literal for foto, texto and card', () => {
    const expected = `Fiz/achei esse material do Solla 1313: Card do giro — ${LINK}. Peça voto pra Solla 1313 também.`
    expect(contentPieceVoteMessage('foto', 'Card do giro', LINK)).toBe(expected)
    expect(contentPieceVoteMessage('texto', 'Card do giro', LINK)).toBe(expected)
    expect(contentPieceVoteMessage('card', 'Card do giro', LINK)).toBe(expected)
  })
})

describe('content piece share link (S27)', () => {
  it('shares the public page for an archived piece', () => {
    expect(
      contentPieceShareLink({ slug: 'fim-da-escala-6x1', isLink: false, sourceUrl: null }, ORIGIN),
    ).toBe(LINK)
  })

  it('shares the canonical platform URL for a link piece (never a second copy)', () => {
    expect(
      contentPieceShareLink(
        {
          slug: 'post-instagram',
          isLink: true,
          sourceUrl: 'https://www.instagram.com/reel/ABC/',
        },
        ORIGIN,
      ),
    ).toBe('https://www.instagram.com/reel/ABC/')
  })

  it('degrades to the relative path without an origin', () => {
    expect(contentPieceShareLink({ slug: 'x', isLink: false, sourceUrl: null }, '')).toBe(
      '/conteudos/x',
    )
  })
})

describe('content piece WhatsApp url (S27)', () => {
  it('prefills the sender text with no recipient and no automatic send', () => {
    const url = new URL(buildContentPieceWhatsAppUrl('Peça voto pra Solla 1313'))
    expect(url.origin).toBe('https://wa.me')
    expect(url.pathname).toBe('/')
    expect(url.searchParams.get('text')).toBe('Peça voto pra Solla 1313')
  })
})
