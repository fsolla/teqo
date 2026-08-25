// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { municipalityUpdateCreateSchema } from '@/lib/schemas/municipalityUpdate'

describe('municipalityUpdateCreateSchema', () => {
  it('requires body and polarity and accepts urgent and adversary flags', () => {
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        polarity: 'neutra',
        body: 'Mobilização na feira',
      }).success,
    ).toBe(true)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        body: 'Sem polaridade',
      }).success,
    ).toBe(false)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        polarity: 'ruim',
        urgent: true,
        body: 'Precisamos responder hoje.',
      }).success,
    ).toBe(true)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        polarity: 'neutra',
        body: '   ',
      }).success,
    ).toBe(false)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        polarity: 'ruim',
        body: 'Ex-prefeito retirou o apoio na feira.',
      }).success,
    ).toBe(true)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        polarity: 'invalid',
        body: 'Visita adversária confirmada.',
      }).success,
    ).toBe(false)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        polarity: 'ruim',
        adversarySignal: true,
      }).success,
    ).toBe(false)
  })

  it('strips forged author and timestamps from input', () => {
    const parsed = municipalityUpdateCreateSchema.parse({
      municipality: 1,
      polarity: 'neutra',
      body: 'Registro de campo',
      author: 999,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    })

    expect(parsed).toEqual({
      municipality: 1,
      polarity: 'neutra',
      body: 'Registro de campo',
      urgent: false,
      adversarySignal: false,
    })
  })
})
