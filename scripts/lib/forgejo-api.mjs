/**
 * Forgejo REST client for the agent ops scripts (`pnpm agent:*`, workflow
 * helpers). Zero dependencies — plain Node `fetch` — so it also runs inside
 * Forgejo Actions jobs without `pnpm install`.
 *
 * Auth: `FORGEJO_API_TOKEN` (PAT) or the native `GITHUB_TOKEN` that Forgejo
 * Actions injects. Base URL: `FORGEJO_API_URL`, else `<GITHUB_SERVER_URL>/api/v1`
 * inside Actions, else `https://git.solla.dev/api/v1`. A browser-ish User-Agent
 * is sent because the instance sits behind Cloudflare.
 *
 * Shapes are normalized to the GitHub-flavored contract the agent scripts and
 * their unit specs already use: `issue.state` ∈ OPEN|CLOSED,
 * `issue.labels = [{ name, color }]`, `createdAt` ISO string.
 */

const DEFAULT_BASE_URL = 'https://git.solla.dev/api/v1'
const DEFAULT_REPOSITORY = 'fsolla/teqo'
const USER_AGENT = 'teqo-agent-scripts/1.0 (forgejo)'

/**
 * @typedef {object} ForgejoApiOptions
 * @property {string} [base]
 * @property {string} [token]
 * @property {string} [repository]
 * @property {(input: string | URL, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<Response>} [fetchImpl]
 */

/**
 * @param {ForgejoApiOptions} [options]
 */
export const createApi = ({ base, token, repository, fetchImpl } = {}) => {
  const baseUrl = (
    base ??
    process.env.FORGEJO_API_URL ??
    (process.env.GITHUB_SERVER_URL ? `${process.env.GITHUB_SERVER_URL}/api/v1` : null) ??
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '')
  const repo =
    repository ??
    process.env.FORGEJO_REPOSITORY ??
    process.env.GITHUB_REPOSITORY ??
    DEFAULT_REPOSITORY
  const fetcher = fetchImpl ?? fetch
  const [owner, name] = repo.split('/')

  const request = async (path, { method = 'GET', body, query } = {}) => {
    const authToken = token ?? process.env.FORGEJO_API_TOKEN ?? process.env.GITHUB_TOKEN
    if (!authToken) {
      throw new Error(
        'Sem token para a API do Forgejo — defina FORGEJO_API_TOKEN (ou rode dentro do Forgejo Actions).',
      )
    }
    const qs = query
      ? '?' +
        Object.entries(query)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
          .join('&')
      : ''
    const response = await fetcher(`${baseUrl}${path}${qs}`, {
      method,
      headers: {
        Authorization: `token ${authToken}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Forgejo API ${method} ${path} → ${response.status}: ${text.slice(0, 400)}`)
    }
    return text ? JSON.parse(text) : null
  }

  const normalizeState = (state) => (String(state).toLowerCase() === 'closed' ? 'CLOSED' : 'OPEN')

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
    /** GET /api/v1/repos/{owner}/{repo}/issues — shape normalized like `gh issue list --json`. */
    listIssues: async ({ state = 'open', labels, limit = 200, page = 1 } = {}) => {
      const issues = await request(`/repos/${owner}/${name}/issues`, {
        query: { state, labels, limit, page, type: 'issues' },
      })
      return (Array.isArray(issues) ? issues : []).map(normalizeIssue)
    },

    getIssue: async (number) => {
      const issue = await request(`/repos/${owner}/${name}/issues/${number}`)
      return normalizeIssue(issue)
    },

    createIssue: async ({ title, body }) => {
      const issue = await request(`/repos/${owner}/${name}/issues`, {
        method: 'POST',
        body: { title, body },
      })
      return normalizeIssue(issue)
    },

    /** Adds labels (never removes). */
    addLabels: (number, labels) =>
      request(`/repos/${owner}/${name}/issues/${number}/labels`, {
        method: 'POST',
        body: { labels },
      }),

    /** Removes labels by name (resolves ids, ignores unknown names). */
    removeLabels: async (number, labels) => {
      const current = await request(`/repos/${owner}/${name}/issues/${number}/labels`)
      for (const label of current ?? []) {
        if (labels.includes(label.name)) {
          await request(`/repos/${owner}/${name}/issues/${number}/labels/${label.id}`, {
            method: 'DELETE',
          })
        }
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

    addComment: (number, body) =>
      request(`/repos/${owner}/${name}/issues/${number}/comments`, {
        method: 'POST',
        body: { body },
      }),

    listIssueComments: async (number) => {
      const comments = await request(`/repos/${owner}/${name}/issues/${number}/comments`)
      return (Array.isArray(comments) ? comments : []).map((comment) => ({
        body: comment.body ?? '',
        user: comment.user?.login ?? '',
      }))
    },

    listPullRequestFiles: async (number) => {
      const files = await request(`/repos/${owner}/${name}/pulls/${number}/files`)
      return (Array.isArray(files) ? files : []).map((file) => ({
        filename: file.filename,
        status: file.status,
      }))
    },

    /** GET /api/v1/repos/{owner}/{repo}/pulls — raw, normalized lightly. */
    listPullRequests: async ({ state = 'open', limit = 100 } = {}) => {
      const pulls = await request(`/repos/${owner}/${name}/pulls`, {
        query: { state, limit },
      })
      return (Array.isArray(pulls) ? pulls : []).map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: normalizeState(pr.state),
        body: pr.body ?? '',
        head: { ref: pr.head?.ref, sha: pr.head?.sha },
        base: { ref: pr.base?.ref },
      }))
    },

    getPullRequest: async (number) => {
      const pr = await request(`/repos/${owner}/${name}/pulls/${number}`)
      return {
        number: pr.number,
        title: pr.title,
        state: normalizeState(pr.state),
        merged: Boolean(pr.merged),
        mergeable: pr.mergeable,
        isDraft: Boolean(pr.is_draft),
        body: pr.body ?? '',
        head: { ref: pr.head?.ref, sha: pr.head?.sha },
        base: { ref: pr.base?.ref },
      }
    },

    /** Marks a draft PR as ready for review (PATCH is_draft=false). */
    markPullRequestReady: (number) =>
      request(`/repos/${owner}/${name}/pulls/${number}`, {
        method: 'PATCH',
        body: { is_draft: false },
      }),

    createPullRequest: async ({ head, base, title, body }) => {
      const pr = await request(`/repos/${owner}/${name}/pulls`, {
        method: 'POST',
        body: { head, base, title, body },
      })
      return { number: pr.number, title: pr.title, htmlUrl: pr.html_url }
    },

    /**
     * Commit statuses of a sha (Forgejo Actions check runs surface here).
     * Returns [{ context, state }] with state ∈ success|failure|pending|error.
     */
    listCommitStatuses: async (sha) => {
      const statuses = await request(`/repos/${owner}/${name}/commits/${sha}/status`)
      const combined = statuses?.statuses ?? []
      return combined.map((entry) => ({ context: entry.context, state: entry.status }))
    },

    /** Merges a PR with rebase (the repo's canonical merge style). */
    mergePullRequest: (number) =>
      request(`/repos/${owner}/${name}/pulls/${number}/merge`, {
        method: 'POST',
        body: { Do: 'rebase' },
      }),

    /** Triggers a workflow via workflow_dispatch. */
    workflowDispatch: (workflowFile, { ref = 'main', inputs = {} } = {}) =>
      request(`/repos/${owner}/${name}/actions/workflows/${workflowFile}/dispatches`, {
        method: 'POST',
        body: { ref, inputs },
      }),

    /** GET /api/v1/repos/{owner}/{repo}/contents/{path}?ref=… — { content, sha } base64-decoded. */
    getFileContents: async (path, ref = 'main') => {
      const file = await request(`/repos/${owner}/${name}/contents/${path}`, {
        query: { ref },
      })
      return {
        content: Buffer.from(file.content ?? '', 'base64').toString('utf8'),
        sha: file.sha,
      }
    },

    /** POST /contents — creates a file on a branch (fails if it exists). */
    createFile: (path, { message, content, branch }) =>
      request(`/repos/${owner}/${name}/contents/${path}`, {
        method: 'POST',
        body: {
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch,
        },
      }),

    /** PUT /contents — updates an existing file (sha required). */
    updateFile: (path, { message, content, branch, sha }) =>
      request(`/repos/${owner}/${name}/contents/${path}`, {
        method: 'PUT',
        body: {
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch,
          sha,
        },
      }),

    /** POST /api/v1/repos/{owner}/{repo}/branch_protections (Forgejo rule-based protection). */
    updateBranchProtection: (branch, payload) =>
      request(`/repos/${owner}/${name}/branch_protections`, {
        method: 'POST',
        body: { ...payload, branch_name: branch },
      }),

    /** GET /api/v1/repos/{owner}/{repo}/branch_protections — normalized rules. */
    listBranchProtections: async () => {
      const rules = await request(`/repos/${owner}/${name}/branch_protections`)
      return (Array.isArray(rules) ? rules : []).map((rule) => ({
        rule_name: rule.rule_name ?? '',
        branch_name: rule.branch_name ?? '',
        enable_status_check: Boolean(rule.enable_status_check),
        status_check_contexts: rule.status_check_contexts ?? [],
        enable_push: Boolean(rule.enable_push),
        required_approvals: rule.required_approvals ?? 0,
        dismiss_stale_approvals: Boolean(rule.dismiss_stale_approvals),
      }))
    },

    /** PATCH /api/v1/repos/{owner}/{repo}/branch_protections/{name} — updates an existing rule. */
    editBranchProtection: (name, payload) =>
      request(`/repos/${owner}/${name}/branch_protections/${name}`, {
        method: 'PATCH',
        body: payload,
      }),

    /**
     * The CI (PR) cascade rollup is green and Forgejo finished computing
     * mergeability. Returns the last PR read. A draft PR stops the wait
     * (converted mid-run): the caller decides what "no merge" means — the CLI
     * skips non-`cursor/*` drafts (OPS57 veto).
     *
     * OPS61 rollup gate: the CI (PR) cascade's aggregate job (`checks`, the
     * `if: always()` rollup over every ci-pr job) must have POSTED and be
     * success. Job statuses are posted as jobs finish, so a snapshot with zero
     * pending can still miss jobs that were not scheduled yet. The rollup only
     * exists once the whole cascade settled (it `needs` every job), so its
     * absence keeps the wait going.
     *
     * The safety-net's OWN context (`PR Ready + auto-merge / …`) is posted as
     * `pending` for the whole run and flips only at the end — it must never
     * gate the verdict. Live finding (PR #67): the pre-OPS61
     * `pending.length === 0` gate was unsatisfiable for that reason, so the
     * CLI never auto-merged anything — every Forgejo merge so far was manual
     * (`merged_by` the owner), which is also what PR #52's red-CI merge was
     * (manual, not a waitForChecks race). The branch-protection rule on the
     * server is the real gate for manual merges too: the merge POST is
     * rejected (405) while the required context is not green.
     *
     * `mergeable === false` is only trusted after the cascade settled — while
     * jobs still run (or the branch-protection rule blocks), Forgejo may
     * report false without meaning "conflict".
     */
    waitForChecks: async (number, { timeoutMs = 30 * 60 * 1000, pollMs = 15000, log } = {}) => {
      const started = Date.now()
      for (;;) {
        const pr = await api.getPullRequest(number)
        if (!pr || pr.state !== 'OPEN' || pr.merged || pr.isDraft) return pr
        const statuses = await api.listCommitStatuses(pr.head.sha)
        const verdicts = statuses.filter(
          (entry) => !entry.context.startsWith('PR Ready + auto-merge'),
        )
        const rollup = verdicts.find((entry) => entry.context.startsWith('CI (PR) / checks'))
        const cascadeSettled = Boolean(rollup && rollup.state === 'success')
        const failed = verdicts.filter(
          (entry) => entry.state === 'failure' || entry.state === 'error',
        )
        if (failed.length > 0) {
          const names = failed.map((entry) => entry.context).join(', ')
          throw new Error(`Checks falharam no PR #${number}: ${names}`)
        }
        if (pr.mergeable === false && cascadeSettled) {
          throw new Error(`PR #${number} não mergeável (conflito?) — resolver manualmente.`)
        }
        if (cascadeSettled && pr.mergeable === true) return pr
        if (Date.now() - started > timeoutMs) {
          throw new Error(`Timeout esperando checks do PR #${number}.`)
        }
        if (log)
          log(
            `[pr#${number}] ${verdicts.length} status, rollup=${
              rollup ? rollup.state : 'ausente'
            }, mergeable=${pr.mergeable ?? 'computando'} — aguardando…`,
          )
        await new Promise((resolve) => setTimeout(resolve, pollMs))
      }
    },

    /**
     * Wait for checks then merge by rebase (the `gh pr merge --auto --rebase`
     * equivalent). The verdict is a RE-READ of the PR, never the merge POST
     * response: Forgejo 9 answers a successful merge with 200 + empty body, so
     * response shape alone cannot distinguish "merged" from "still open".
     *
     * @returns {Promise<{ attempted: boolean, merged: boolean, pr: object | null }>}
     */
    autoMerge: async (number, options) => {
      const pr = await api.waitForChecks(number, options)
      if (!pr || pr.merged || pr.state !== 'OPEN' || pr.isDraft) {
        return { attempted: false, merged: Boolean(pr?.merged), pr }
      }
      try {
        await api.mergePullRequest(number)
      } catch (error) {
        const after = await api.getPullRequest(number)
        if (!after?.merged && after?.state === 'OPEN') throw error
        return { attempted: true, merged: Boolean(after?.merged), pr: after }
      }
      const after = await api.getPullRequest(number)
      return { attempted: true, merged: Boolean(after?.merged), pr: after }
    },
  }

  return api
}

/** Default instance bound to the environment. */
export const forgejoApi = createApi({})
