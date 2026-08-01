/**
 * plansOnlyClosesGuard — pure policy for PRs that touch only docs/plans/.
 * Plans-only PRs must not carry GitHub issue-closing keywords (Closes/Fixes/Resolves).
 */

const PLANS_ONLY_PREFIX = 'docs/plans/'

/**
 * @param {string} path - repo-relative path with forward slashes
 */
export function isUnderDocsPlans(path) {
  return path === PLANS_ONLY_PREFIX.slice(0, -1) || path.startsWith(PLANS_ONLY_PREFIX)
}

/**
 * True when every changed path lives under docs/plans/ (non-empty diff).
 *
 * @param {string[]} paths
 */
export function isPlansOnlyDiff(paths) {
  if (paths.length === 0) return false
  return paths.every(isUnderDocsPlans)
}

/** GitHub closing keywords + resolves family (case-insensitive). */
const ISSUE_CLOSING_KEYWORD_RE =
  /\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)\b/gi

/**
 * @param {string} body
 * @returns {{ keyword: string, number: number }[]}
 */
export function findIssueClosingKeywords(body) {
  if (!body) return []

  const closers = []
  for (const match of body.matchAll(ISSUE_CLOSING_KEYWORD_RE)) {
    closers.push({ keyword: match[1], number: Number(match[2]) })
  }
  return closers
}

/**
 * @param {{ paths: string[], body: string | null | undefined }} input
 * @returns {{ ok: true } | { ok: false, closers: { keyword: string, number: number }[], message: string }}
 */
export function assertPlansOnlyPrAllowsBody({ paths, body }) {
  if (!isPlansOnlyDiff(paths)) {
    return { ok: true }
  }

  const closers = findIssueClosingKeywords(body ?? '')
  if (closers.length === 0) {
    return { ok: true }
  }

  const unique = [
    ...new Map(
      closers.map((closer) => [`${closer.keyword.toLowerCase()}:${closer.number}`, closer]),
    ).values(),
  ]
  const listed = unique.map((closer) => `${closer.keyword} #${closer.number}`).join(', ')

  return {
    ok: false,
    closers: unique,
    message:
      `PR que altera apenas docs/plans/ não pode usar keywords de fechamento (${listed}). ` +
      'Use "Related #N" ou remova — a implementação fecha a Issue em outro PR.',
  }
}
