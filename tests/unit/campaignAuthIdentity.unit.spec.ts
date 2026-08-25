// @vitest-environment node

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { buildWhatsAppUrl, normalizeBrazilianPhone, sanitizeBrazilianPhoneInput } from '@/lib/phone'
import { campaignLoginSchema } from '@/lib/schemas/campaign-login'

describe('campaign auth identity helpers', () => {
  it('guards migration rollback when phone-only accounts exist', () => {
    const migration = readFileSync(
      new URL(
        '../../src/migrations/20260718_010733_consolidate_campaign_schema.ts',
        import.meta.url,
      ),
      'utf8',
    )

    expect(migration).toContain('IF EXISTS (SELECT 1 FROM "campaign_user")')
    expect(migration).toContain('RAISE EXCEPTION')
  })

  it.each([
    ['(71) 99999-1234', '71999991234'],
    ['+55 71 99999-1234', '71999991234'],
    ['55 71 99999-1234', '71999991234'],
  ])('normalizes Brazilian mobile phone %s', (input, expected) => {
    expect(normalizeBrazilianPhone(input)).toBe(expected)
  })

  it.each(['7199991234', '55719999912345', 'invalid'])(
    'rejects invalid Brazilian mobile phone %s',
    (input) => {
      expect(normalizeBrazilianPhone(input)).toBeNull()
    },
  )

  it.each([
    ['+55 (71) 99999-1234', '71999991234'],
    ['55 71 99999 1234', '71999991234'],
    ['71999991234', '71999991234'],
    ['55999991234', '55999991234'],
  ])(
    'sanitizes pasted or typed Brazilian phone %s without corrupting DDD 55',
    (input, expected) => {
      expect(sanitizeBrazilianPhoneInput(input)).toBe(expected)
    },
  )

  it('builds a wa.me URL from the canonical phone', () => {
    expect(buildWhatsAppUrl('(71) 99999-1234', 'Olá, Solla!')).toBe(
      'https://wa.me/5571999991234?text=Ol%C3%A1%2C+Solla%21',
    )
  })

  it('validates a single email-or-phone login field', () => {
    expect(
      campaignLoginSchema.parse({
        identifier: ' pessoa@example.com ',
        password: 'secret',
      }),
    ).toEqual({
      identifier: 'pessoa@example.com',
      password: 'secret',
    })
    expect(
      campaignLoginSchema.parse({
        identifier: '+55 (71) 99999-1234',
        password: 'secret',
      }),
    ).toEqual({
      identifier: '71999991234',
      password: 'secret',
    })
  })
})
