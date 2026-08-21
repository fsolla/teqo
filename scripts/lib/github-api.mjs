/**
 * GitHub REST + GraphQL client for the CI/PR scripts (`github-pr*`, branch
 * protection). Zero dependencies — plain Node `fetch` — so it also runs
 * inside GitHub Actions jobs without `pnpm install`.
 *
 * Auth: `GITHUB_TOKEN` (PAT locally; the built-in Actions token in
 * workflows). Base URL: `GITHUB_API_URL`, else `https://api.github.com`.
 *
 * Retry (same policy as forgejo-api OPS67): transient failures retry with
 * exponential backoff — a fetch that rejects (network-level, DNS/TCP/reset)
 * retries on ANY method; a 5xx retries on GET only, so read polls survive
 * while write endpoints keep failing closed instead of risking duplicated
 * side effects. 4xx never retries. Defaults: 3 retries, base 300 ms ×2,
 * ±20% jitter.
 *
 * Shapes are normalized to the contract the CLI scripts use: `pr.state` ∈
 * OPEN|CLOSED, `pr.draft`, `pr.nodeId` (GraphQL auto-merge), branch
 * protection normalized for drift comparison.
 */

const DEFAULT_BASE_URL = 'https://api.github.com'
const DEFAULT_GRAPHQL_URL = 'https://api.github.com/graphql'
const DEFAULT_REPOSITORY = 'fsolla/teqo'
const USER_AGENT = 'teqo-agent-scripts/1.0 (github)'
const RETRYABLE_STATUSES = new Set([502, 503, 504])

/**
 * @typedef {object} GithubApiOptions
 * @property {string} [base]
 * @property {string} [graphqlBase]
 * @property {string} [token]
 * @property {string} [repository]
 * @property {(input: string | URL, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<Response>} [fetchImpl]
 * @property {number} [retries] Additional attempts after the first (total = retries + 1). Default 3.
 * @property {number} [backoffMs] Base exponential delay. Default 300.
 * @property {boolean} [jitter] ±20% randomization on each delay. Default true.
 * @property {(ms: number) => Promise<void>} [sleepImpl] Test seam for the backoff delay.
 */

/**
 * @param {GithubApiOptions} [options]
 */
export const createApi = ({
  base,
  graphqlBase,
  token,
  repository,
  fetchImpl,
  retries = 3,
  backoffMs = 300,
  jitter = true,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) => {
  const baseUrl = (base ?? process.env.GITHUB_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const graphqlUrl = (graphqlBase ?? process.env.GITHUB_GRAPHQL_URL ?? DEFAULT_GRAPHQL_URL).replace(
    /\/+$/,
    '',
  )
  const repo = repository ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY
  const fetcher = fetchImpl ?? fetch
  const [owner, name] = repo.split('/')
  if (retries < 0 || backoffMs < 0) {
    throw new Error(
      `Retry inválido: retries=${retries}, backoffMs=${backoffMs} — ambos devem ser >= 0`,
    )
  }
  const attemptCount = retries + 1

  const backoffDelay = (attempt) => {
    const base = backoffMs * 2 ** (attempt - 1)
    return jitter ? Math.round(base * (0.8 + Math.random() * 0.4)) : base
  }

  const warnRetry = (path, method, reason, attempt, delay) =>
    console.warn(
      `[github-api] ${method} ${path} falhou (tentativa ${attempt}/${attemptCount}): ${reason} — retry em ${delay}ms`,
    )

  const headers = (withJson = true) => {
    const authToken = token ?? process.env.GITHUB_TOKEN
    if (!authToken) {
      throw new Error('Sem token para a API do GitHub — defina GITHUB_TOKEN.')
    }
    return {
      Authorization: `Bearer ${authToken}`,
      'User-Agent': USER_AGENT,
      ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    }
  }

  const request = async (path, { method = 'GET', body, query } = {}) => {
    const qs = query
      ? '?' +
        Object.entries(query)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
          .join('&')
      : ''
    const url = `${baseUrl}${path}${qs}`
    const retryAfter = async (attempt, reason) => {
      const delay = backoffDelay(attempt)
      warnRetry(path, method, reason, attempt, delay)
      await sleepImpl(delay)
    }
    for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
      const isLastAttempt = attempt === attemptCount
      let response
      try {
        response = await fetcher(url, {
          method,
          headers: headers(),
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        })
      } catch (error) {
        if (isLastAttempt) throw error
        await retryAfter(attempt, error.message)
        continue
      }
      if (method === 'GET' && !isLastAttempt && RETRYABLE_STATUSES.has(response.status)) {
        await response.body?.cancel()
        await retryAfter(attempt, `HTTP ${response.status}`)
        continue
      }
      let text
      try {
        text = await response.text()
      } catch (error) {
        if (isLastAttempt || method !== 'GET') throw error
        await retryAfter(attempt, error.message)
        continue
      }
      if (response.status === 404 && method === 'GET') return null
      if (!response.ok) {
        throw new Error(`GitHub API ${method} ${path} → ${response.status}: ${text.slice(0, 400)}`)
      }
      if (!text) return null
      try {
        return JSON.parse(text)
      } catch {
        throw new Error(`GitHub API ${method} ${path}: resposta não-JSON: ${text.slice(0, 80)}`)
      }
    }
  }

  const graphql = async (query, variables) => {
    let response
    try {
      response = await fetcher(graphqlUrl, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ query, variables }),
      })
    } catch (error) {
      throw new Error(`GitHub GraphQL falhou (rede): ${error.message}`)
    }
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`GitHub GraphQL → ${response.status}: ${text.slice(0, 400)}`)
    }
    const parsed = JSON.parse(text)
    const firstError = parsed?.errors?.[0]
    if (firstError) {
      throw new Error(`GitHub GraphQL: ${firstError.message}`)
    }
    return parsed.data ?? null
  }

  const normalizeState = (state) => (String(state).toLowerCase() === 'closed' ? 'CLOSED' : 'OPEN')

  const normalizePullRequest = (pr) => ({
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    state: normalizeState(pr.state),
    merged: Boolean(pr.merged_at || pr.merged),
    draft: Boolean(pr.draft),
    mergeable: pr.mergeable ?? null,
    nodeId: pr.node_id ?? '',
    head: { ref: pr.head?.ref ?? '', sha: pr.head?.sha ?? '' },
    base: { ref: pr.base?.ref ?? '' },
  })

  /** Issue shape normalized to the agent-script contract (same as forgejo-api). */
  const normalizeIssue = (issue) => ({
    number: issue.number,
    title: issue.title,
    body: issue.body ?? '',
    state: normalizeState(issue.state),
    createdAt: issue.created_at,
    labels: (issue.labels ?? []).map((label) => ({
      name: label.name,
      color: label.color ?? '',
    })),
  })

  const api = {
    /**
     * GET /repos/{owner}/{repo}/pulls/{number} — normalized.
     * @param {number} number
     */
    getPullRequest: async (number) => {
      const pr = await request(`/repos/${owner}/${name}/pulls/${number}`)
      return pr ? normalizePullRequest(pr) : null
    },

    /** GET /repos/{owner}/{repo}/issues — normalized; `limit` → `per_page`. */
    listIssues: async ({ state = 'open', labels, limit = 100, page = 1 } = {}) => {
      const issues = await request(`/repos/${owner}/${name}/issues`, {
        query: { state, labels, per_page: limit, page },
      })
      // GitHub returns PRs in the issues list; filter them out (the Forgejo
      // `type: issues` query had no GitHub equivalent).
      return (Array.isArray(issues) ? issues : [])
        .filter((issue) => !issue.pull_request)
        .map(normalizeIssue)
    },

    /** GET /repos/{owner}/{repo}/issues/{number} — normalized. */
    getIssue: async (number) => {
      const issue = await request(`/repos/${owner}/${name}/issues/${number}`)
      return issue ? normalizeIssue(issue) : null
    },

    /** POST /repos/{owner}/{repo}/issues — creates with title+body. */
    createIssue: async ({ title, body }) => {
      const issue = await request(`/repos/${owner}/${name}/issues`, {
        method: 'POST',
        body: { title, body },
      })
      return normalizeIssue(issue)
    },

    /** Adds labels by NAME (GitHub labels are repo-level, addressed by name). */
    addLabels: (number, labels) =>
      request(`/repos/${owner}/${name}/issues/${number}/labels`, {
        method: 'POST',
        body: { labels },
      }),

    /** Removes labels by NAME (GitHub DELETE is by label name). */
    removeLabels: async (number, labels) => {
      for (const label of labels) {
        await request(
          `/repos/${owner}/${name}/issues/${number}/labels/${encodeURIComponent(label)}`,
          {
            method: 'DELETE',
          },
        )
      }
    },

    /**
     * @param {number} number
     * @param {{ add?: string[], remove?: string[] }} [options]
     */
    setLabels: async (number, { add = [], remove = [] } = {}) => {
      if (remove.length > 0) await api.removeLabels(number, remove)
      if (add.length > 0) await api.addLabels(number, add)
    },

    /** POST /issues/{number}/comments — { body }. */
    addComment: (number, body) =>
      request(`/repos/${owner}/${name}/issues/${number}/comments`, {
        method: 'POST',
        body: { body },
      }),

    /** PATCH state=closed — closes the issue on the GitHub tracker. */
    closeIssue: (number) =>
      request(`/repos/${owner}/${name}/issues/${number}`, {
        method: 'PATCH',
        body: { state: 'closed' },
      }),

    /** GET /issues/{number}/comments — [{ body, user }]. */
    listIssueComments: async (number) => {
      const comments = await request(`/repos/${owner}/${name}/issues/${number}/comments`)
      return (Array.isArray(comments) ? comments : []).map((comment) => ({
        body: comment.body ?? '',
        user: comment.user?.login ?? '',
      }))
    },

    /** GET /pulls/{number}/files — [{ filename, status }]. */
    listPullRequestFiles: async (number) => {
      const files = await request(`/repos/${owner}/${name}/pulls/${number}/files`)
      return (Array.isArray(files) ? files : []).map((file) => ({
        filename: file.filename ?? '',
        status: file.status ?? '',
      }))
    },

    /** GET /pulls — normalized, GitHub PATCH uses `draft` not `is_draft`. */
    listPullRequests: async ({ state = 'open', limit = 100 } = {}) => {
      const pulls = await request(`/repos/${owner}/${name}/pulls`, {
        query: { state, per_page: limit },
      })
      return (Array.isArray(pulls) ? pulls : []).map(normalizePullRequest)
    },

    /** POST /actions/workflows/{file}/dispatches — triggers a workflow. */
    workflowDispatch: (workflowFile, { ref = 'main', inputs = {} } = {}) =>
      request(`/repos/${owner}/${name}/actions/workflows/${workflowFile}/dispatches`, {
        method: 'POST',
        body: { ref, inputs },
      }),

    /** GET /contents/{path}?ref= — { content, sha } base64-decoded. */
    getFileContents: async (path, ref = 'main') => {
      const file = await request(`/repos/${owner}/${name}/contents/${path}`, { query: { ref } })
      if (!file) return null
      return {
        content: Buffer.from(file.content ?? '', 'base64').toString('utf8'),
        sha: file.sha,
      }
    },

    /** PUT /contents/{path} — creates/updates a file on a branch (sha for update). */
    writeFile: (path, { message, content, branch = 'main', sha } = {}) =>
      request(`/repos/${owner}/${name}/contents/${path}`, {
        method: 'PUT',
        body: {
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch,
          ...(sha ? { sha } : {}),
        },
      }),

    /** POST /contents/{path} — creates a file on a branch (fails if it exists). */
    createFile: (path, { message, content, branch = 'main' } = {}) =>
      request(`/repos/${owner}/${name}/contents/${path}`, {
        method: 'PUT',
        body: {
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch,
        },
      }),

    /** PUT /contents/{path} — updates an existing file (sha required). */
    updateFile: (path, { message, content, branch = 'main', sha } = {}) =>
      request(`/repos/${owner}/${name}/contents/${path}`, {
        method: 'PUT',
        body: {
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch,
          sha,
        },
      }),

    /** PATCH draft:false — marks a draft PR ready for review. */
    markPullRequestReady: (number) =>
      request(`/repos/${owner}/${name}/pulls/${number}`, {
        method: 'PATCH',
        body: { draft: false },
      }),

    /** POST /pulls — creates a PR (never draft). */
    createPullRequest: async ({ head, base = 'main', title, body }) => {
      const pr = await request(`/repos/${owner}/${name}/pulls`, {
        method: 'POST',
        body: { head, base, title, body },
      })
      return { number: pr.number, title: pr.title, htmlUrl: pr.html_url }
    },

    /**
     * Enables GitHub's native auto-merge (GraphQL) with the repo's canonical
     * merge style (rebase). The server waits for the required checks — a PR
     * with a red `CI (PR) / checks` can never auto-merge.
     */
    enableAutoMerge: async (nodeId, mergeMethod = 'REBASE') => {
      await graphql(
        `
          mutation EnablePullRequestAutoMerge($id: ID!, $mergeMethod: PullRequestMergeMethod!) {
            enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $mergeMethod }) {
              pullRequest {
                number
              }
            }
          }
        `,
        { id: nodeId, mergeMethod },
      )
    },

    /**
     * GET /repos/{owner}/{repo}/branches/{branch}/protection — normalized for
     * drift comparison; `null` when the branch has no protection rule (404).
     */
    getBranchProtection: async (branch = 'main') => {
      const rule = await request(`/repos/${owner}/${name}/branches/${branch}/protection`)
      if (!rule) return null
      return {
        required_status_checks: rule.required_status_checks
          ? {
              strict: Boolean(rule.required_status_checks.strict),
              contexts: (rule.required_status_checks.checks ?? []).map((entry) => entry.context),
            }
          : null,
        enforce_admins: Boolean(rule.enforce_admins?.enabled ?? rule.enforce_admins),
        required_pull_request_reviews: rule.required_pull_request_reviews ?? null,
      }
    },

    /**
     * PUT /repos/{owner}/{repo}/branches/{branch}/protection — replaces the
     * whole rule (GitHub replace semantics: omitted protections are removed).
     */
    updateBranchProtection: (payload, branch = 'main') =>
      request(`/repos/${owner}/${name}/branches/${branch}/protection`, {
        method: 'PUT',
        body: payload,
      }),

    /** PATCH /repos/{owner}/{repo} — repo settings (e.g. allow_auto_merge). */
    updateRepository: (payload) =>
      request(`/repos/${owner}/${name}`, { method: 'PATCH', body: payload }),
  }

  return api
}

/** Default instance bound to the environment. */
export const githubApi = createApi({})
