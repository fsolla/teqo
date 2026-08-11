// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  resolveBahiaMunicipality,
  supporterCreateSchema,
  supporterImportConfirmSchema,
  supporterVoteIntentionSchema,
} from '@/lib/schemas/supporter'

describe('supporter schemas', () => {
  it('normalizes phones and optional BA municipality', () => {
    const parsed = supporterCreateSchema.parse({
      name: 'Maria da Silva',
      phones: ['+55 (71) 98888-7777'],
      city: 'salvador',
      consentAccepted: true,
    })

    expect(parsed.phones).toEqual(['71988887777'])
    expect(parsed.city).toBe('Salvador')
    expect(resolveBahiaMunicipality('feira de santana')).toBe('Feira de Santana')
    expect(resolveBahiaMunicipality('Nowhere')).toBeNull()
  })

  it('requires highlighted consent when vote intention is set on create', () => {
    expect(
      supporterCreateSchema.safeParse({
        name: 'Maria Silva',
        phones: ['71988887777'],
        voteIntention: 'certo',
        consentAccepted: true,
      }).success,
    ).toBe(false)

    expect(
      supporterCreateSchema.safeParse({
        name: 'Maria Silva',
        phones: ['71988887777'],
        voteIntention: 'certo',
        consentAccepted: true,
        voteIntentionConsentAccepted: true,
      }).success,
    ).toBe(true)
  })

  it('requires operator attestation and a token for import confirm', () => {
    expect(
      supporterImportConfirmSchema.safeParse({
        importToken: 'token',
      }).success,
    ).toBe(false)

    expect(
      supporterImportConfirmSchema.safeParse({
        operatorAttested: true,
      }).success,
    ).toBe(false)

    expect(
      supporterImportConfirmSchema.parse({
        operatorAttested: true,
        importToken: 'batch.123.sig',
      }).importToken,
    ).toBe('batch.123.sig')
  })

  it('requires vote intention consent acceptance', () => {
    expect(
      supporterVoteIntentionSchema.safeParse({
        id: 1,
        voteIntention: 'indeciso',
      }).success,
    ).toBe(false)
  })
})
