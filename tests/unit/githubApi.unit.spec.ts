import { describe, expect, it } from 'vitest'

import { createApi } from '../../scripts/lib/github-api.mjs'

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

describe('github-api', () => {
  it('builds the request with bearer token, JSON body and explicit User-Agent', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      repository: 'fsolla/teqo',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok({ number: 1, title: 't', body: '', state: 'open', node_id: 'PR_x' })
      },
    })

    await api.getPullRequest(1)

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.github.com/repos/fsolla/teqo/pulls/1')
    expect(calls[0].init!.headers!.Authorization).toBe('Bearer tok')
    expect(calls[0].init!.headers!['User-Agent']).toContain('teqo-agent-scripts')
  })

  it('fails closed when no token is available', async () => {
    delete process.env.GITHUB_TOKEN
    const api = createApi({ fetchImpl: async () => ok('{}') })

    await expect(api.getPullRequest(1)).rejects.toThrow(/GITHUB_TOKEN/)
  })

  it('normalizes the pull request to the CLI contract (state/draft/nodeId/head/base)', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () =>
        ok({
          number: 7,
          title: 't',
          body: 'Closes #1',
          state: 'closed',
          merged_at: '2026-08-19T00:00:00Z',
          draft: false,
          mergeable: true,
          node_id: 'PR_abc123',
          head: { ref: 'OPS71-x', sha: 'deadbeef' },
          base: { ref: 'main' },
        }),
    })

    const pr = await api.getPullRequest(7)

    expect(pr).toEqual({
      number: 7,
      title: 't',
      body: 'Closes #1',
      state: 'CLOSED',
      merged: true,
      draft: false,
      mergeable: true,
      nodeId: 'PR_abc123',
      head: { ref: 'OPS71-x', sha: 'deadbeef' },
      base: { ref: 'main' },
    })
  })

  it('markPullRequestReady patches draft:false', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), method: init?.method, body: init?.body })
        return ok(null)
      },
    })

    await api.markPullRequestReady(4)

    expect(calls).toEqual([
      {
        url: 'https://api.github.com/repos/fsolla/teqo/pulls/4',
        method: 'PATCH',
        body: JSON.stringify({ draft: false }),
      },
    ])
  })

  it('createPullRequest posts a Ready PR (never draft) with the given body', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), method: init?.method, body: init?.body })
        return ok({ number: 9, title: 't', html_url: 'https://github.com/fsolla/teqo/pull/9' })
      },
    })

    const created = await api.createPullRequest({
      head: 'OPS71-x',
      base: 'main',
      title: 'OPS71 — x',
      body: 'Closes #97',
    })

    expect(created).toEqual({
      number: 9,
      title: 't',
      htmlUrl: 'https://github.com/fsolla/teqo/pull/9',
    })
    expect(calls[0].url).toBe('https://api.github.com/repos/fsolla/teqo/pulls')
    expect(JSON.parse(String(calls[0].body))).toEqual({
      head: 'OPS71-x',
      base: 'main',
      title: 'OPS71 — x',
      body: 'Closes #97',
    })
  })

  it('enableAutoMerge posts the GraphQL mutation with rebase', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: init?.body })
        return ok({ data: { enablePullRequestAutoMerge: { pullRequest: { number: 4 } } } })
      },
    })

    await api.enableAutoMerge('PR_abc123')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.github.com/graphql')
    const { query, variables } = JSON.parse(String(calls[0].body))
    expect(query).toContain('enablePullRequestAutoMerge')
    expect(query).toContain('mergeMethod')
    expect(variables).toEqual({ id: 'PR_abc123', mergeMethod: 'REBASE' })
  })

  it('enableAutoMerge throws with the GraphQL error message', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () =>
        ok({
          data: null,
          errors: [{ message: 'auto-merge is disabled on this repository' }],
        }),
    })

    await expect(api.enableAutoMerge('PR_x')).rejects.toThrow(/auto-merge is disabled/)
  })

  it('getBranchProtection returns null on 404 and normalizes an existing rule', async () => {
    let calls = 0
    const api = createApi({
      token: 'tok',
      fetchImpl: async () => {
        calls += 1
        if (calls === 1) return ok('{"message":"Not Found"}', 404)
        return ok({
          url: 'https://api.github.com/repos/fsolla/teqo/branches/main/protection',
          required_status_checks: {
            strict: false,
            checks: [{ context: 'CI (PR) / checks', app_id: null }],
            contexts: ['CI (PR) / checks'],
          },
          enforce_admins: { enabled: true, url: '…' },
          required_pull_request_reviews: null,
        })
      },
    })

    expect(await api.getBranchProtection('main')).toBeNull()

    const rule = await api.getBranchProtection('main')
    expect(rule).toEqual({
      required_status_checks: {
        strict: false,
        contexts: ['CI (PR) / checks'],
      },
      enforce_admins: true,
      required_pull_request_reviews: null,
    })
  })

  it('updateBranchProtection PUTs the full desired rule', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), method: init?.method })
        return ok(null)
      },
    })

    await api.updateBranchProtection({ enforce_admins: true }, 'main')

    expect(calls[0].url).toBe('https://api.github.com/repos/fsolla/teqo/branches/main/protection')
    expect(calls[0].method).toBe('PUT')
  })

  it('throws with the API error body on non-2xx', async () => {
    let calls = 0
    const api = createApi({
      token: 'tok',
      retries: 0,
      fetchImpl: async () => {
        calls += 1
        return ok('{"message":"Bad credentials"}', 401)
      },
    })

    await expect(api.getPullRequest(1)).rejects.toThrow(/401/)
    await expect(api.getPullRequest(1)).rejects.toThrow(/Bad credentials/)
    expect(calls).toBe(2)
  })
})
