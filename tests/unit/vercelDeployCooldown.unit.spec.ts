// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  computeCooldownWait,
  DEPLOY_COOLDOWN_MS,
  evaluateDeployCooldown,
  fetchLastProductionReadyAt,
  lastProductionReadyAtFromDeployment,
} from '../../scripts/lib/vercel-deploy-cooldown.mjs'

const fakeResponse = (ok: boolean, status: number, payload: unknown) =>
  ({
    ok,
    status,
    text: async () => (payload === null ? '' : JSON.stringify(payload)),
  }) as Response

const captureFetch = (response: Response) => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return response
  }
  return { calls, fetchImpl: fetchImpl as typeof fetch }
}

describe('vercelDeployCooldown', () => {
  it('uses a 30-minute cooldown constant', () => {
    expect(DEPLOY_COOLDOWN_MS).toBe(30 * 60 * 1000)
  })

  it('lastProductionReadyAtFromDeployment prefers ready over createdAt', () => {
    expect(lastProductionReadyAtFromDeployment({ ready: 100, createdAt: 50 })).toBe(100)
    expect(lastProductionReadyAtFromDeployment({ createdAt: 50 })).toBe(50)
    expect(lastProductionReadyAtFromDeployment(null)).toBeNull()
  })

  it('computeCooldownWait is inactive when no prior deploy exists', () => {
    expect(computeCooldownWait(null, 1_000_000)).toEqual({
      active: false,
      waitSeconds: 0,
      ageMs: null,
    })
  })

  it('computeCooldownWait defers when the last deploy is younger than 30 minutes', () => {
    const now = 1_700_000_000_000
    const last = now - 10 * 60 * 1000

    expect(computeCooldownWait(last, now)).toEqual({
      active: true,
      waitSeconds: 20 * 60,
      ageMs: 10 * 60 * 1000,
    })
  })

  it('computeCooldownWait clears when the last deploy is older than 30 minutes', () => {
    const now = 1_700_000_000_000
    const last = now - 31 * 60 * 1000

    expect(computeCooldownWait(last, now)).toEqual({
      active: false,
      waitSeconds: 0,
      ageMs: 31 * 60 * 1000,
    })
  })

  it('fetchLastProductionReadyAt reads the newest READY production deployment', async () => {
    const { calls, fetchImpl } = captureFetch(
      fakeResponse(true, 200, {
        deployments: [{ ready: 1_700_000_000_000, createdAt: 1_699_999_000_000 }],
      }),
    )

    await expect(
      fetchLastProductionReadyAt({
        token: 'token',
        projectId: 'prj_test',
        teamId: 'team_test',
        fetchImpl,
      }),
    ).resolves.toBe(1_700_000_000_000)

    expect(calls[0]!.url).toContain('/v6/deployments?')
    expect(calls[0]!.url).toContain('projectId=prj_test')
    expect(calls[0]!.url).toContain('teamId=team_test')
    expect(calls[0]!.url).toContain('target=production')
    expect(calls[0]!.url).toContain('state=READY')
  })

  it('evaluateDeployCooldown surfaces API failures', async () => {
    const { fetchImpl } = captureFetch(
      fakeResponse(false, 403, { error: { message: 'forbidden' } }),
    )

    await expect(
      evaluateDeployCooldown({
        token: 'token',
        projectId: 'prj_test',
        teamId: 'team_test',
        fetchImpl,
      }),
    ).rejects.toThrow(/403/)
  })
})
