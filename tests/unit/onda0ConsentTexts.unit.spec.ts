import { describe, expect, it } from 'vitest'

import {
  ONDA0_CONSENT_ENTRIES,
  ONDA0_CONSENT_KEY_LIST,
  ONDA0_PRIVACY_POLICY_BODY,
  ONDA0_PROVISIONAL_BANNER,
} from '@/lib/onda0ConsentTexts'

describe('onda0ConsentTexts', () => {
  it('includes the provisional banner in every consent and privacy body', () => {
    for (const { text } of ONDA0_CONSENT_ENTRIES) {
      expect(text.root.children[0]?.children[0]).toMatchObject({ text: ONDA0_PROVISIONAL_BANNER })
    }
    expect(ONDA0_PRIVACY_POLICY_BODY.root.children[0]?.children[0]).toMatchObject({
      text: ONDA0_PROVISIONAL_BANNER,
    })
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
