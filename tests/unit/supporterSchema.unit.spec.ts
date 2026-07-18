// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  resolveBahiaMunicipality,
  supporterCreateSchema,
  supporterImportConfirmSchema,
  supporterVoteIntentionSchema,
} from '@/lib/schemas/supporter'

describe('supporter schemas', () => {
  it('normalizes phone and optional BA municipality', () => {
    const parsed = supporterCreateSchema.parse({
      name: 'Maria da Silva',
      phone: '+55 (71) 98888-7777',
      city: 'salvador',
      consentAccepted: true,
    })

    expect(parsed.phone).toBe('71988887777')
    expect(parsed.city).toBe('Salvador')
    expect(resolveBahiaMunicipality('feira de santana')).toBe('Feira de Santana')
    expect(resolveBahiaMunicipality('Nowhere')).toBeNull()
  })

  it('requires highlighted consent when vote intention is set on create', () => {
    expect(
      supporterCreateSchema.safeParse({
        name: 'Maria Silva',
        phone: '71988887777',
        voteIntention: 'certo',
        consentAccepted: true,
      }).success,
    ).toBe(false)

    expect(
      supporterCreateSchema.safeParse({
        name: 'Maria Silva',
        phone: '71988887777',
        voteIntention: 'certo',
        consentAccepted: true,
        voteIntentionConsentAccepted: true,
      }).success,
    ).toBe(true)
  })

  it('requires operator attestation for import confirm', () => {
    expect(
      supporterImportConfirmSchema.safeParse({
        rows: [{ nome: 'Ana Silva', telefone: '71988887777' }],
      }).success,
    ).toBe(false)

    expect(
      supporterImportConfirmSchema.parse({
        operatorAttested: true,
        rows: [{ nome: 'Ana Silva', telefone: '71988887777', intencao: 'certo' }],
      }).rows[0]?.telefone,
    ).toBe('71988887777')
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
