// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  request: 1,
  auth: vi.fn(),
  findByID: vi.fn(),
}))

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>()
  const requestCaches = new Map<number, Map<unknown, unknown>>()

  return {
    ...original,
    cache:
      <Result>(callback: () => Promise<Result>) =>
      (): Promise<Result> => {
        const requestCache = requestCaches.get(state.request) ?? new Map<unknown, unknown>()
        requestCaches.set(state.request, requestCache)
        if (!requestCache.has(callback)) requestCache.set(callback, callback())
        return requestCache.get(callback) as Promise<Result>
      },
  }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: () => ({ value: 'request-token' }),
  })),
}))

vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    auth: state.auth,
    findByID: state.findByID,
  })),
}))

import { getCampaignUser, getCampaignUserRaw } from '@/utilities/campaignAuth'

describe('campaign auth request memoization', () => {
  beforeEach(() => {
    state.request += 1
    state.auth.mockReset()
    state.findByID.mockReset()
    state.auth.mockResolvedValue({
      user: { id: 7, collection: 'campaignUser', role: 'geral' },
    })
    state.findByID.mockResolvedValue({
      id: 7,
      collection: 'campaignUser',
      name: 'Coordenação',
      email: 'coordenacao@example.com',
      role: 'geral',
    })
  })

  it('shares authentication and fresh role reload within one request', async () => {
    const [fromLayout, fromPage] = await Promise.all([getCampaignUser(), getCampaignUser()])

    expect(fromLayout).toBe(fromPage)
    expect(state.auth).toHaveBeenCalledTimes(1)
    expect(state.findByID).toHaveBeenCalledTimes(1)
  })

  it('does not share authentication across requests', async () => {
    await getCampaignUser()
    state.request += 1
    await getCampaignUser()

    expect(state.auth).toHaveBeenCalledTimes(2)
    expect(state.findByID).toHaveBeenCalledTimes(2)
  })

  it('keeps an uncached raw function for tests and action boundaries', async () => {
    await Promise.all([getCampaignUserRaw(), getCampaignUserRaw()])

    expect(state.auth).toHaveBeenCalledTimes(2)
    expect(state.findByID).toHaveBeenCalledTimes(2)
  })
})
