import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApi } from '../../scripts/lib/github-api.mjs'

type FetchCall = {
  url: string
  method?: string
  init?: { headers?: Record<string, string>; method?: string; body?: string }
}

const ok = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const issue = (over: Record<string, unknown> = {}) => ({
  number: 1,
  title: 'x',
  body: '---\nid: T1\n---\n',
  state: 'open',
  created_at: '2026-08-20T10:00:00Z',
  labels: [{ name: 'ready', color: '0e8a16' }],
  ...over,
})

describe('github-api (issue tracker layer)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('listIssues filters out pull-request entries and normalizes to the contract', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      base: 'https://api.github.com',
      token: 'tok',
      repository: 'fsolla/teqo',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok([issue({ number: 1 }), issue({ number: 2, pull_request: { url: 'x' } })])
      },
    })
    const issues = await api.listIssues({ state: 'open' })
    expect(issues).toHaveLength(1)
    expect(issues[0].number).toBe(1)
    expect(issues[0].state).toBe('OPEN')
    expect(issues[0].createdAt).toBe('2026-08-20T10:00:00Z')
    expect(issues[0].labels).toEqual([{ name: 'ready', color: '0e8a16' }])
    expect(calls[0].url).toContain('/repos/fsolla/teqo/issues?state=open&per_page=100&page=1')
  })

  it('getIssue normalizes a single issue', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () => ok(issue({ number: 42 })),
    })
    const got = await api.getIssue(42)
    expect(got?.number).toBe(42)
    expect(got?.state).toBe('OPEN')
  })

  it('createIssue POSTs title+body and returns the normalized issue', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok(issue({ number: 7 }))
      },
    })
    const created = await api.createIssue({ title: 'T', body: 'B' })
    expect(created.number).toBe(7)
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(calls[0].init?.body ?? '{}')).toEqual({ title: 'T', body: 'B' })
  })

  it('setLabels removes by name then adds', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok([])
      },
    })
    await api.setLabels(5, { add: ['done'], remove: ['in-progress'] })
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.github.com/repos/fsolla/teqo/issues/5/labels/in-progress',
      'https://api.github.com/repos/fsolla/teqo/issues/5/labels',
    ])
    expect(calls[0].init?.method).toBe('DELETE')
    expect(calls[1].init?.method).toBe('POST')
    expect(JSON.parse(calls[1].init?.body ?? '{}')).toEqual({ labels: ['done'] })
  })

  it('closeIssue PATCHes state=closed', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok(issue({ state: 'closed' }))
      },
    })
    await api.closeIssue(9)
    expect(calls[0].url).toContain('/issues/9')
    expect(calls[0].init?.method).toBe('PATCH')
    expect(JSON.parse(calls[0].init?.body ?? '{}')).toEqual({ state: 'closed' })
  })

  it('workflowDispatch posts inputs and ref', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok({})
      },
    })
    await api.workflowDispatch('agent-pool.yml', { ref: 'main', inputs: { action: 'start' } })
    expect(calls[0].url).toContain('/actions/workflows/agent-pool.yml/dispatches')
    expect(JSON.parse(calls[0].init?.body ?? '{}')).toEqual({
      ref: 'main',
      inputs: { action: 'start' },
    })
  })

  it('getFileContents base64-decodes content', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () => ok({ content: Buffer.from('olá mundo').toString('base64'), sha: 's' }),
    })
    const file = await api.getFileContents('a/b.md', 'main')
    expect(file?.content).toBe('olá mundo')
    expect(file?.sha).toBe('s')
  })

  it('getPullRequest normalizes auto_merge into autoMerge', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () =>
        ok({ number: 5, state: 'open', draft: false, auto_merge: { merge_method: 'rebase' } }),
    })
    const pr = await api.getPullRequest(5)
    expect(pr?.autoMerge?.mergeMethod).toBe('rebase')
    expect(pr?.head).toEqual({ ref: '', sha: '' })
  })

  it('disableAutoMerge DELETEs the auto-merge endpoint', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok({})
      },
    })
    await api.disableAutoMerge(7)
    expect(calls[0].url).toContain('/repos/fsolla/teqo/pulls/7/auto-merge')
    expect(calls[0].init?.method).toBe('DELETE')
  })

  it('disableAutoMerge tolerates 404 when nothing is armed', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () => ok({ message: 'Auto-merge request is disabled for this pull request' }, 404),
    })
    await expect(api.disableAutoMerge(9)).resolves.toBeUndefined()
  })

  it('disableAutoMerge rethrows non-404 errors', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () => ok({ message: 'nope' }, 422),
    })
    await expect(api.disableAutoMerge(11)).rejects.toThrow(/422/)
  })
})
