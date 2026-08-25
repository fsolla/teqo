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
  })

  it('disableAutoMerge sends the GraphQL disable mutation with the node id', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok({ data: { disablePullRequestAutoMerge: { pullRequest: { number: 7 } } } })
      },
    })
    await api.disableAutoMerge('PR_node7')
    expect(calls[0].url).toContain('/graphql')
    expect(calls[0].init?.method).toBe('POST')
    const payload = JSON.parse(calls[0].init?.body ?? '{}')
    expect(payload.query).toContain('disablePullRequestAutoMerge')
    expect(payload.variables).toEqual({ id: 'PR_node7' })
  })

  it('ensureAutoMergeDisabled throws fail-closed on an unknown PR', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () => ok({ message: 'Not Found' }, 404),
      retries: 0,
    })
    await expect(api.ensureAutoMergeDisabled(13)).rejects.toThrow(/não encontrado/)
  })

  it('ensureAutoMergeDisabled converges once a poll sees null', async () => {
    let poll = 0
    let disabledCalls = 0
    const sleeps: number[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url) => {
        if (String(url).includes('/graphql')) {
          disabledCalls += 1
          return ok({ data: { disablePullRequestAutoMerge: { pullRequest: { number: 9 } } } })
        }
        poll += 1
        // Armed on the first two polls, disarmed on the third.
        return ok({
          number: 9,
          state: 'open',
          draft: false,
          node_id: 'PR_node9',
          ...(poll < 3 ? { auto_merge: { merge_method: 'rebase' } } : {}),
        })
      },
      sleepImpl: async (ms) => {
        sleeps.push(ms)
      },
    })
    await expect(api.ensureAutoMergeDisabled(9)).resolves.toBe(true)
    expect(disabledCalls).toBe(2)
    expect(sleeps.length).toBe(2)
  })

  it('ensureAutoMergeDisabled throws after exhausting attempts while still armed', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url) => {
        if (String(url).includes('/graphql')) {
          return ok({ data: { disablePullRequestAutoMerge: { pullRequest: { number: 11 } } } })
        }
        return ok({
          number: 11,
          state: 'open',
          draft: false,
          node_id: 'PR_node11',
          auto_merge: { merge_method: 'rebase' },
        })
      },
      sleepImpl: async () => {},
      retries: 0,
    })
    await expect(api.ensureAutoMergeDisabled(11, { attempts: 3 })).rejects.toThrow(/auto-merge/i)
  })

  it('ensureAutoMergeDisabled is idempotent — a null auto_merge gets no mutation', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok({ number: 21, state: 'open', draft: false })
      },
    })
    await expect(api.ensureAutoMergeDisabled(21)).resolves.toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).not.toContain('/graphql')
  })

  it('getPullRequestAutoMergeStatus reads the GraphQL status and normalizes it', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok({
          data: {
            repository: {
              pullRequest: {
                id: 'PR_node33',
                isDraft: false,
                mergeable: 'MERGEABLE',
                mergeStateStatus: 'CLEAN',
                autoMergeRequest: {
                  mergeMethod: 'REBASE',
                  enabledBy: { login: 'github-actions[bot]' },
                },
              },
            },
          },
        })
      },
    })
    const status = await api.getPullRequestAutoMergeStatus(33)
    expect(status).toEqual({
      number: 33,
      nodeId: 'PR_node33',
      isDraft: false,
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      autoMergeRequest: { mergeMethod: 'REBASE', enabledBy: 'github-actions[bot]' },
    })
    expect(calls[0].url).toContain('/graphql')
    expect(calls[0].init?.method).toBe('POST')
    const payload = JSON.parse(calls[0].init?.body ?? '{}')
    expect(payload.query).toContain('query PullRequestAutoMergeStatus')
    expect(payload.query).toContain('autoMergeRequest')
    expect(payload.variables).toEqual({ owner: 'fsolla', name: 'teqo', number: 33 })
  })

  it('getPullRequestAutoMergeStatus normalizes a disarmed PR to autoMergeRequest null', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () =>
        ok({
          data: {
            repository: {
              pullRequest: {
                id: 'PR_node34',
                isDraft: false,
                mergeable: 'MERGEABLE',
                mergeStateStatus: 'BLOCKED',
                autoMergeRequest: null,
              },
            },
          },
        }),
    })
    const status = await api.getPullRequestAutoMergeStatus(34)
    expect(status.autoMergeRequest).toBeNull()
    expect(status.isDraft).toBe(false)
  })

  it('getPullRequestAutoMergeStatus throws fail-closed on an unknown PR', async () => {
    const api = createApi({
      token: 'tok',
      fetchImpl: async () => ok({ data: { repository: { pullRequest: null } } }),
      retries: 0,
    })
    await expect(api.getPullRequestAutoMergeStatus(99)).rejects.toThrow(/não encontrado/)
  })

  it('convertPullRequestToDraft sends the GraphQL draft mutation with the node id', async () => {
    const calls: FetchCall[] = []
    const api = createApi({
      token: 'tok',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return ok({
          data: { convertPullRequestToDraft: { pullRequest: { number: 41, isDraft: true } } },
        })
      },
    })
    await api.convertPullRequestToDraft('PR_node41')
    expect(calls[0].url).toContain('/graphql')
    expect(calls[0].init?.method).toBe('POST')
    const payload = JSON.parse(calls[0].init?.body ?? '{}')
    expect(payload.query).toContain('convertPullRequestToDraft')
    expect(payload.variables).toEqual({ id: 'PR_node41' })
  })
})
