// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/(campaign)/campanha/(app)/municipios/leaderships/route'
import {
  createMunicipalityLeadership,
  setMunicipalityLeadershipMembership,
} from '@/app/(campaign)/campanha/actions/leadership'

vi.mock('@/app/(campaign)/campanha/actions/leadership', () => ({
  createMunicipalityLeadership: vi.fn(),
  setMunicipalityLeadershipMembership: vi.fn(),
}))

const mockedCreate = vi.mocked(createMunicipalityLeadership)
const mockedToggle = vi.mocked(setMunicipalityLeadershipMembership)

const postRequest = (body: unknown): Request =>
  new Request('http://localhost/campanha/municipios/leaderships', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: JSON.stringify(body),
  })

describe('POST /campanha/municipios/leaderships body union (B159)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatches a name-only create', async () => {
    mockedCreate.mockResolvedValue({
      leadership: { id: 9 },
      leadershipIDs: [9],
      createdLeadershipName: 'Maria da Serra',
    } as Awaited<ReturnType<typeof createMunicipalityLeadership>>)

    const response = await POST(postRequest({ municipalityId: 1, name: 'Maria da Serra' }))

    expect(mockedCreate).toHaveBeenCalledWith({ municipalityId: 1, name: 'Maria da Serra' })
    expect(mockedToggle).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'success',
      leadershipIDs: [9],
      createdLeadership: { id: 9, name: 'Maria da Serra' },
    })
  })

  it('rejects a phone remnant instead of accepting hidden data', async () => {
    const response = await POST(
      postRequest({ municipalityId: 1, name: 'Maria da Serra', phone: '71999999999' }),
    )

    expect(response.status).toBe(400)
    expect(mockedCreate).not.toHaveBeenCalled()
    expect(mockedToggle).not.toHaveBeenCalled()
  })
})
