// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/(campaign)/campanha/(app)/municipios/advisors/route'
import type { MunicipalityListAdvisorsResponse } from '@/app/(campaign)/campanha/(app)/municipios/advisors/types'
import {
  createMunicipalityAdvisor,
  setMunicipalityAdvisorMembership,
} from '@/app/(campaign)/campanha/actions/municipality'

vi.mock('@/app/(campaign)/campanha/actions/municipality', () => ({
  createMunicipalityAdvisor: vi.fn(),
  setMunicipalityAdvisorMembership: vi.fn(),
}))

const mockedCreate = vi.mocked(createMunicipalityAdvisor)
const mockedToggle = vi.mocked(setMunicipalityAdvisorMembership)

const postRequest = (body: unknown): Request =>
  new Request('http://localhost/campanha/municipios/advisors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: JSON.stringify(body),
  })

const jsonBody = async (response: Response): Promise<MunicipalityListAdvisorsResponse> =>
  (await response.json()) as MunicipalityListAdvisorsResponse

/**
 * B154 — the endpoint contract is a discriminated union: the B27 toggle
 * (`advisorId` + `assigned`, no `name`) and the name-only create (`name`, no
 * `advisorId`) dispatch to different actions. These cases pin that a create
 * body can never silently fall through to the toggle (or vice-versa).
 */
describe('POST /campanha/municipios/advisors body union (B154)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches the B27 toggle body to setMunicipalityAdvisorMembership', async () => {
    mockedToggle.mockResolvedValue({
      advisors: [{ id: 7 }],
    } as Awaited<ReturnType<typeof setMunicipalityAdvisorMembership>>)

    const response = await POST(postRequest({ municipalityId: 1, advisorId: 7, assigned: true }))

    expect(mockedCreate).not.toHaveBeenCalled()
    expect(mockedToggle).toHaveBeenCalledWith({ municipality: 1, advisor: 7, assigned: true })
    expect(response.status).toBe(200)
    await expect(jsonBody(response)).resolves.toMatchObject({
      status: 'success',
      advisors: [7],
    })
  })

  it('dispatches the name-only create body to createMunicipalityAdvisor', async () => {
    mockedCreate.mockResolvedValue({
      advisors: [{ id: 9 }],
      createdAdvisorId: 9,
    } as Awaited<ReturnType<typeof createMunicipalityAdvisor>>)

    const response = await POST(postRequest({ municipalityId: 1, name: 'Carlos' }))

    expect(mockedToggle).not.toHaveBeenCalled()
    expect(mockedCreate).toHaveBeenCalledWith({ municipality: 1, name: 'Carlos' })
    expect(response.status).toBe(200)
    await expect(jsonBody(response)).resolves.toMatchObject({
      status: 'success',
      advisors: [9],
      createdAdvisor: { id: 9, name: 'Carlos' },
    })
  })

  it.each([
    ['no dispatch shape at all', { municipalityId: 1 }],
    ['both shapes at once', { municipalityId: 1, advisorId: 7, assigned: true, name: 'Carlos' }],
    ['create with a toggle remnant', { municipalityId: 1, name: 'Carlos', assigned: false }],
    ['name too short', { municipalityId: 1, name: 'C' }],
    ['blank name', { municipalityId: 1, name: '   ' }],
  ])('rejects %s with 400 without calling either action', async (_label, body) => {
    const response = await POST(postRequest(body))

    expect(mockedToggle).not.toHaveBeenCalled()
    expect(mockedCreate).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
  })
})
