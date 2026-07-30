// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { CursorApiError, cursorApiRequest } from '../../scripts/lib/agent-pool-cursor.mjs'

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

describe('cursorApiRequest', () => {
  it('sends Basic auth with the key as username and parses JSON', async () => {
    const { calls, fetchImpl } = captureFetch(fakeResponse(true, 200, { ok: true }))
    const result = await cursorApiRequest('/v1/me', { apiKey: 'crsr_teste', fetchImpl })
    expect(result).toEqual({ ok: true })
    expect(calls[0]!.url).toBe('https://api.cursor.com/v1/me')
    const auth = (calls[0]!.init.headers as Record<string, string>).authorization
    expect(auth).toBe(`Basic ${Buffer.from('crsr_teste:').toString('base64')}`)
  })

  it('posts a JSON body only when provided', async () => {
    const { calls, fetchImpl } = captureFetch(fakeResponse(true, 200, { agent: {} }))
    await cursorApiRequest('/v1/agents', {
      method: 'POST',
      body: { prompt: { text: 'oi' } },
      apiKey: 'k',
      fetchImpl,
    })
    expect(calls[0]!.init.body).toBe(JSON.stringify({ prompt: { text: 'oi' } }))

    const getCalls = captureFetch(fakeResponse(true, 200, {}))
    await cursorApiRequest('/v1/models', { apiKey: 'k', fetchImpl: getCalls.fetchImpl })
    expect(getCalls.calls[0]!.init.body).toBeUndefined()
  })

  it('throws CursorApiError with status and parsed body on failure', async () => {
    const { fetchImpl } = captureFetch(
      fakeResponse(false, 409, { error: { code: 'agent_id_conflict' } }),
    )
    const failure = await cursorApiRequest('/v1/agents', {
      method: 'POST',
      body: {},
      apiKey: 'k',
      fetchImpl,
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(CursorApiError)
    expect((failure as InstanceType<typeof CursorApiError>).status).toBe(409)
    expect((failure as InstanceType<typeof CursorApiError>).body).toEqual({
      error: { code: 'agent_id_conflict' },
    })
  })

  it('fails closed without an API key (status 0, no fetch)', async () => {
    const { calls, fetchImpl } = captureFetch(fakeResponse(true, 200, {}))
    const failure = await cursorApiRequest('/v1/me', { apiKey: '', fetchImpl }).catch(
      (error: unknown) => error,
    )
    expect((failure as InstanceType<typeof CursorApiError>).status).toBe(0)
    expect(calls).toHaveLength(0)
  })
})
