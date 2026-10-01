// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildConsentRichText,
  FACE_INDEX_CONSENT_PARAGRAPHS,
  FACE_INDEX_CONSENT_TEXT,
  FACE_SEARCH_CONSENT_PARAGRAPHS,
  FACE_SEARCH_CONSENT_TEXT,
} from '../../scripts/lib/faceConsentTexts.mjs'

// C242 — the versioned legal texts of the selfie search: the Lexical shape the
// Consent collection stores and the honest content the visitor reads.

describe('buildConsentRichText', () => {
  it('builds the Lexical root with one paragraph per text', () => {
    const rich = buildConsentRichText(['Um.', 'Dois.'])

    expect(rich.root.type).toBe('root')
    expect(rich.root.children).toHaveLength(2)
    expect(rich.root.children[0].children[0].text).toBe('Um.')
    expect(rich.root.children[1].children[0].text).toBe('Dois.')
  })

  it('produces an empty root for no paragraphs (fail-closed content)', () => {
    expect(buildConsentRichText([]).root.children).toEqual([])
  })
})

const flatten = (text: unknown): string =>
  (text as { root: { children: { children: { text: string }[] }[] } }).root.children
    .map((paragraph) => paragraph.children.map((child) => child.text).join(''))
    .join('\n')

describe('face consent texts', () => {
  it('has substantive paragraphs in both texts', () => {
    expect(FACE_SEARCH_CONSENT_PARAGRAPHS.length).toBeGreaterThanOrEqual(4)
    expect(FACE_INDEX_CONSENT_PARAGRAPHS.length).toBeGreaterThanOrEqual(4)
    for (const paragraph of [...FACE_SEARCH_CONSENT_PARAGRAPHS, ...FACE_INDEX_CONSENT_PARAGRAPHS]) {
      expect(paragraph.trim().length).toBeGreaterThan(40)
    }
  })

  it('states the on-device processing and the LGPD basis in the query consent', () => {
    const text = flatten(FACE_SEARCH_CONSENT_TEXT)
    expect(text).toMatch(/aparelho/i)
    expect(text).toMatch(/não é enviada nem armazenada/i)
    expect(text).toMatch(/LGPD/)
    expect(text).toMatch(/retirar este consentimento/i)
  })

  it('states the anonymous index and the self-service opt-out in the notice', () => {
    const text = flatten(FACE_INDEX_CONSENT_TEXT)
    expect(text).toMatch(/índice biométrico anônimo/i)
    expect(text).toMatch(/sem nome/i)
    expect(text).toMatch(/Minha presença/)
    expect(text).toMatch(/remoção de uma foto/i)
  })
})
