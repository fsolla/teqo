// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  PETITION_BODY_HTML,
  PETITION_BODY_SECTIONS,
  PETITION_CONSENT_KEY,
  PETITION_FORM_SUBTITLE,
  PETITION_FORM_TITLE,
  PETITION_ID,
  PETITION_SUBTITLE,
  PETITION_TITLE,
} from '../../scripts/lib/petitionPl5594Content.mjs'

// S48 — the PL 5594/2026 petition content is editorial but versioned: the seed
// writes it to a fresh/staging/production database, so these invariants are the
// guard against a silent editorial drift.

const plainText = PETITION_BODY_HTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('petitionPl5594Content', () => {
  it('pins the public identity (id is the URL and the signature FK)', () => {
    expect(PETITION_ID).toBe('pl-5594-2026')
    expect(PETITION_TITLE).toBe('Quem quer ser presidente deve abrir os sigilos')
    expect(PETITION_SUBTITLE).toBe(
      'Apoie o PL 5594/2026: candidatos à Presidência e à Vice-Presidência devem autorizar o acesso aos sigilos bancário, fiscal, telefônico e de internet.',
    )
    expect(PETITION_FORM_TITLE).toBe('Assine o abaixo-assinado')
    expect(PETITION_FORM_SUBTITLE).toBe('Preencha seus dados para apoiar o PL 5594/2026.')
  })

  it('reuses the existing petition Consent by stable key, never by id', () => {
    expect(PETITION_CONSENT_KEY).toBe('whatsapp-inscricao')
  })

  it('has the five planned sections with an h2 each', () => {
    expect(PETITION_BODY_SECTIONS.map((section) => section.heading)).toEqual([
      'O que o PL 5594/2026 propõe',
      'Por que isso importa agora',
      'O que o PL não faz',
      'O pedido',
      'Texto oficial e tramitação',
    ])
    expect(PETITION_BODY_HTML.match(/<h2>/g)).toHaveLength(5)
    for (const section of PETITION_BODY_SECTIONS) {
      expect(section.html.trim().length).toBeGreaterThan(0)
    }
  })

  it('carries the official facts of the bill', () => {
    expect(plainText).toContain('cinco exercícios fiscais anteriores')
    expect(plainText).toContain('excluído o conteúdo das comunicações')
    expect(plainText).toContain('excluído o conteúdo de mensagens, arquivos')
    expect(plainText).toContain('autoridades e órgãos públicos legalmente competentes')
    expect(plainText).toContain('sistema de auditoria')
    expect(plainText).toContain('proteção de dados pessoais')
    expect(plainText).toContain('Justiça Eleitoral')
    expect(PETITION_BODY_HTML).toContain(
      'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2648344',
    )
    expect(PETITION_BODY_HTML).toContain(
      'https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=3184912',
    )
  })

  it('mentions the 18/10 debate without accusing anyone or promising approval', () => {
    expect(plainText).toContain('18/10/2026')
    expect(plainText).toContain('Lula desafiou Flávio Bolsonaro a abrir seus sigilos')
    expect(plainText).toContain('19/10/2026')

    // The law's own access purpose says "indícios concretos de ilícitos"; that
    // is a legal competence, not an accusation. The guard is against naming a
    // crime/irregularity as fact and against promising the bill's approval.
    expect(plainText).not.toMatch(/\b(crime|corrupção|desvio|lavagem)\b/i)
    expect(plainText).not.toMatch(
      /será aprovad|vai ser aprovad|vamos aprovar|aprovação garantida|garantir a aprovação/i,
    )
    expect(plainText).toContain(
      'não substitui a apuração de responsabilidades nem presume irregularidade',
    )
  })
})
