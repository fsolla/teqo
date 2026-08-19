// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  isValidFacebookPixelId,
  normalizeFacebookPixelId,
  trackMetaLead,
  validateFacebookPixelId,
} from '@/lib/facebookPixel'

describe('facebookPixel', () => {
  describe('isValidFacebookPixelId', () => {
    it('accepts numeric IDs between 5 and 20 digits', () => {
      expect(isValidFacebookPixelId('12345')).toBe(true)
      expect(isValidFacebookPixelId('123456789012345')).toBe(true)
    })

    it('rejects empty, non-numeric, and out-of-range values', () => {
      expect(isValidFacebookPixelId('')).toBe(false)
      expect(isValidFacebookPixelId(null)).toBe(false)
      expect(isValidFacebookPixelId(undefined)).toBe(false)
      expect(isValidFacebookPixelId('1234')).toBe(false)
      expect(isValidFacebookPixelId('123456789012345678901')).toBe(false)
      expect(isValidFacebookPixelId('<script>alert(1)</script>')).toBe(false)
      expect(isValidFacebookPixelId('fbq("init")')).toBe(false)
    })
  })

  describe('normalizeFacebookPixelId', () => {
    it('trims whitespace and returns null for invalid values', () => {
      expect(normalizeFacebookPixelId('  123456789012345  ')).toBe('123456789012345')
      expect(normalizeFacebookPixelId('')).toBe(null)
      expect(normalizeFacebookPixelId('   ')).toBe(null)
      expect(normalizeFacebookPixelId('abc')).toBe(null)
    })
  })

  describe('validateFacebookPixelId', () => {
    it('accepts empty values (optional field)', () => {
      expect(validateFacebookPixelId('')).toBe(true)
      expect(validateFacebookPixelId(null)).toBe(true)
      expect(validateFacebookPixelId(undefined)).toBe(true)
    })

    it('accepts numeric IDs between 5 and 20 digits', () => {
      expect(validateFacebookPixelId('123456789012345')).toBe(true)
    })

    it('rejects non-numeric and out-of-range values with the admin message', () => {
      const message = 'Informe somente o ID numérico do Pixel (5 a 20 dígitos), sem HTML ou script.'
      expect(validateFacebookPixelId('1234')).toBe(message)
      expect(validateFacebookPixelId('<script>alert(1)</script>')).toBe(message)
    })
  })

  describe('trackMetaLead', () => {
    it('no-ops when fbq is unavailable', () => {
      expect(() => trackMetaLead('123456789012345', 'Petição teste', 'event-1')).not.toThrow()
    })

    it('fires Lead with content_name and eventID when fbq exists', () => {
      const fbq = vi.fn()
      vi.stubGlobal('window', { fbq })

      trackMetaLead('123456789012345', 'Petição teste', 'event-1')

      expect(fbq).toHaveBeenCalledWith(
        'track',
        'Lead',
        { content_name: 'Petição teste' },
        { eventID: 'event-1' },
      )

      vi.unstubAllGlobals()
    })

    it('no-ops for invalid pixel IDs even when fbq exists', () => {
      const fbq = vi.fn()
      vi.stubGlobal('window', { fbq })

      trackMetaLead('not-a-pixel', 'Petição teste', 'event-1')

      expect(fbq).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })
  })
})
