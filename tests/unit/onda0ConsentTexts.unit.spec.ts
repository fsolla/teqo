import { describe, expect, it } from 'vitest'

import {
  ONDA0_CONSENT_ENTRIES,
  ONDA0_CONSENT_KEY_LIST,
  ONDA0_PRIVACY_POLICY_BODY,
  ONDA0_PROVISIONAL_BANNER,
} from '@/lib/onda0ConsentTexts'

const firstParagraphText = (body: { root: { children: unknown[] } }): string | undefined => {
  const paragraph = body.root.children[0]
  if (!paragraph || typeof paragraph !== 'object' || !('children' in paragraph)) return undefined
  const children = paragraph.children
  if (!Array.isArray(children)) return undefined
  const textNode = children[0]
  if (!textNode || typeof textNode !== 'object' || !('text' in textNode)) return undefined
  return typeof textNode.text === 'string' ? textNode.text : undefined
}

describe('onda0ConsentTexts', () => {
  it('includes the provisional banner in every consent and privacy body', () => {
    for (const { text } of ONDA0_CONSENT_ENTRIES) {
      expect(firstParagraphText(text)).toBe(ONDA0_PROVISIONAL_BANNER)
    }
    expect(firstParagraphText(ONDA0_PRIVACY_POLICY_BODY)).toBe(ONDA0_PROVISIONAL_BANNER)
  })

  it('defines all four stable keys', () => {
    expect(ONDA0_CONSENT_ENTRIES.map((entry) => entry.key)).toEqual(ONDA0_CONSENT_KEY_LIST)
  })

  it('builds multi-paragraph lexical roots for each consent', () => {
    for (const { text } of ONDA0_CONSENT_ENTRIES) {
      expect(text.root.children.length).toBeGreaterThan(3)
    }
  })
})
