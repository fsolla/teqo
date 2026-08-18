import { describe, expect, it } from 'vitest'

import { createApi } from '../../scripts/lib/forgejo-api.mjs'

type FetchCall = {
  url: string
  method?: string
  init?: { headers?: Record<string, string>; method?: string; body?: string }
  body?: unknown
}

const ok = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('forgejo-api', () => {
  it('builds the request with token, JSON body and explicit User-Agent', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      base: 'https://git.solla.dev/api/v1',
      token: 'tok',
      repository: 'fsolla/teqo',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok({ number: 1, title: 'x', body: '', state: 'open', created_at: '', labels: [] })
      },
    })

    await api.createIssue({ title: 't', body: 'b' })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://git.solla.dev/api/v1/repos/fsolla/teqo/issues')
    expect(calls[0].init!.method).toBe('POST')
    expect(calls[0].init!.headers!.Authorization).toBe('token tok')
    expect(calls[0].init!.headers!['User-Agent']).toContain('teqo-agent-scripts')
    expect(JSON.parse(calls[0].init!.body!)).toEqual({ title: 't', body: 'b' })
  })

  it('defaults the base URL to git.solla.dev with the default repo path', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url) => {
        calls.push({ url: String(url) })
        return ok([{ number: 1, title: '', body: '', state: 'open', created_at: '', labels: [] }])
      },
    })

    await api.listIssues()

    expect(calls[0].url).toContain('https://git.solla.dev/api/v1/repos/fsolla/teqo/issues?')
  })

  it('normalizes state and labels to the gh-flavored contract', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () =>
        ok({
          number: 7,
          title: 't',
          body: 'b',
          state: 'closed',
          created_at: '2026-01-01T00:00:00Z',
          labels: [{ name: 'ready', color: '0E8A16' }],
        }),
    })

    const issue = await api.getIssue(7)

    expect(issue.state).toBe('CLOSED')
    expect(issue.labels).toEqual([{ name: 'ready', color: '0E8A16' }])
    expect(issue.createdAt).toBe('2026-01-01T00:00:00Z')
  })

  it('throws with the API error body on non-2xx', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () => ok('{"message":"nope"}', 403),
    })

    await expect(api.listIssues()).rejects.toThrow(/403/)
    await expect(api.listIssues()).rejects.toThrow(/nope/)
  })

  it('fails closed when no token is available', async () => {
    delete process.env.FORGEJO_API_TOKEN
    delete process.env.GITHUB_TOKEN
    const api = createApi({ fetchImpl: async () => ok('[]') })

    await expect(api.listIssues()).rejects.toThrow(/Sem token/)
  })

  it('setLabels removes by id and adds by name', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), method: init?.method, body: init?.body })
        if (String(url).endsWith('/labels') && init?.method === 'GET') {
          return ok([{ name: 'blocked', id: 42 }])
        }
        return ok(null)
      },
    })

    await api.setLabels(5, { add: ['ready'], remove: ['blocked'] })

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ['GET', 'https://git.solla.dev/api/v1/repos/fsolla/teqo/issues/5/labels'],
      ['DELETE', 'https://git.solla.dev/api/v1/repos/fsolla/teqo/issues/5/labels/42'],
      ['POST', 'https://git.solla.dev/api/v1/repos/fsolla/teqo/issues/5/labels'],
    ])
    expect(JSON.parse(calls[2].body as string)).toEqual({ labels: ['ready'] })
  })

  it('workflowDispatch posts inputs and ref', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) })
        return ok(null)
      },
    })

    await api.workflowDispatch('agent-pool.yml', { ref: 'main', inputs: { action: 'tick' } })

    expect(calls[0].url).toContain('/actions/workflows/agent-pool.yml/dispatches')
    expect(calls[0].body).toEqual({ ref: 'main', inputs: { action: 'tick' } })
  })

  it('merges with rebase (repo canonical merge style)', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) })
        return ok(null)
      },
    })

    await api.mergePullRequest(4)

    expect(calls[0].url).toContain('/pulls/4/merge')
    expect(calls[0].body).toEqual({ Do: 'rebase' })
  })

  it('waitForChecks returns once every status is settled and no failure exists', async () => {
    let poll = 0
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url) => {
        if (String(url).includes('/pulls/')) {
          return ok({
            number: 4,
            state: 'open',
            merged: false,
            mergeable: true,
            head: { ref: 'x', sha: 'abc' },
          })
        }
        poll += 1
        const statuses =
          poll < 2
            ? [{ context: 'CI / static', status: 'pending' }]
            : [{ context: 'CI / static', status: 'success' }]
        return ok({ statuses })
      },
    })

    const pr = await api.waitForChecks(4, { pollMs: 1 })

    expect(pr).toBeTruthy()
    expect(poll).toBe(2)
  })

  it('waitForChecks keeps polling while mergeable is still being computed', async () => {
    let poll = 0
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url) => {
        if (String(url).includes('/pulls/')) {
          poll += 1
          return ok({
            number: 4,
            state: 'open',
            merged: false,
            mergeable: poll < 2 ? null : true,
            head: { ref: 'x', sha: 'abc' },
          })
        }
        return ok({ statuses: [{ context: 'CI / static', status: 'success' }] })
      },
    })

    const pr = await api.waitForChecks(4, { pollMs: 1 })

    expect(poll).toBe(2)
    expect(pr.mergeable).toBe(true)
  })

  it('waitForChecks fails fast when the PR is not mergeable', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url) => {
        if (String(url).includes('/pulls/')) {
          return ok({
            number: 4,
            state: 'open',
            merged: false,
            mergeable: false,
            head: { ref: 'x', sha: 'abc' },
          })
        }
        return ok({ statuses: [{ context: 'CI / static', status: 'success' }] })
      },
    })

    await expect(api.waitForChecks(4, { pollMs: 1 })).rejects.toThrow(/não mergeável/)
  })

  it('autoMerge verifies the merge by re-reading the PR (POST answers 200 + empty body)', async () => {
    const calls: string[] = []
    let poll = 0
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        if (String(url).includes('/merge')) return new Response('', { status: 200 })
        if (String(url).includes('/pulls/')) {
          poll += 1
          const merged = poll > 1
          return ok({
            number: 27,
            state: merged ? 'closed' : 'open',
            merged,
            mergeable: true,
            head: { ref: 'x', sha: 'abc' },
          })
        }
        return ok({ statuses: [{ context: 'CI / static', status: 'success' }] })
      },
    })

    const result = await api.autoMerge(27, { pollMs: 1 })

    expect(result).toEqual({
      attempted: true,
      merged: true,
      pr: expect.objectContaining({ merged: true }),
    })
    expect(calls.filter((call) => call.includes('/merge'))).toHaveLength(1)
    expect(
      calls.filter(
        (call) => call === 'GET https://git.solla.dev/api/v1/repos/fsolla/teqo/pulls/27',
      ),
    ).toHaveLength(2)
  })

  it('autoMerge rethrows when the merge POST fails and the PR stays open', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, _init) => {
        if (String(url).includes('/merge'))
          return ok('{"message":"PR not in mergeable state"}', 405)
        if (String(url).includes('/pulls/')) {
          return ok({
            number: 27,
            state: 'open',
            merged: false,
            mergeable: true,
            head: { ref: 'x', sha: 'abc' },
          })
        }
        return ok({ statuses: [{ context: 'CI / static', status: 'success' }] })
      },
    })

    await expect(api.autoMerge(27, { pollMs: 1 })).rejects.toThrow(/405/)
  })

  it('autoMerge reports merged when a concurrent actor merged after our POST failed', async () => {
    let poll = 0
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, _init) => {
        if (String(url).includes('/merge'))
          return ok('{"message":"Pull request was already merged"}', 405)
        if (String(url).includes('/pulls/')) {
          poll += 1
          const merged = poll > 1
          return ok({
            number: 27,
            state: merged ? 'closed' : 'open',
            merged,
            mergeable: true,
            head: { ref: 'x', sha: 'abc' },
          })
        }
        return ok({ statuses: [{ context: 'CI / static', status: 'success' }] })
      },
    })

    const result = await api.autoMerge(27, { pollMs: 1 })

    expect(result).toEqual({
      attempted: true,
      merged: true,
      pr: expect.objectContaining({ merged: true }),
    })
  })

  it('autoMerge is a no-op for an already merged PR (no POST)', async () => {
    const calls: string[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        return ok({
          number: 4,
          state: 'closed',
          merged: true,
          mergeable: false,
          head: { ref: 'x', sha: 'abc' },
        })
      },
    })

    const result = await api.autoMerge(4, { pollMs: 1 })

    expect(result).toEqual({
      attempted: false,
      merged: true,
      pr: expect.objectContaining({ merged: true }),
    })
    expect(calls.some((call) => call.includes('/merge'))).toBe(false)
  })

  it('getFileContents decodes base64 and updateFile sends sha', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({
          url: String(url),
          method: init?.method,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        })
        if (init?.method === 'GET') {
          return ok({ content: Buffer.from('{"a":1}').toString('base64'), sha: 'shasha' })
        }
        return ok(null)
      },
    })

    const file = await api.getFileContents('pool-state.json', 'pool-state')
    expect(file.content).toBe('{"a":1}')
    expect(file.sha).toBe('shasha')

    await api.updateFile('pool-state.json', {
      message: 'm',
      content: '{"a":2}',
      branch: 'pool-state',
      sha: 'shasha',
    })
    expect(calls.at(-1)!.method).toBe('PUT')
    expect(
      Buffer.from((calls.at(-1)!.body as { content: string }).content, 'base64').toString(),
    ).toBe('{"a":2}')
    expect((calls.at(-1)!.body as { sha: string }).sha).toBe('shasha')
  })
})
