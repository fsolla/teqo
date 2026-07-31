/**
 * Pure helpers for `agent-promote`: pick the newest commit on stage (ahead of main)
 * that has a successful ci-stage run — not necessarily the current stage head.
 */

/** Branch used when promoting a green commit behind a red stage head. */
export const PROMOTE_GREEN_BRANCH = 'promote/last-green'

/**
 * @param {string[]} commitsAhead newest-first SHAs on origin/main..origin/stage
 * @param {ReadonlySet<string>} greenShas head SHAs with ci-stage success
 * @returns {string | null}
 */
export function findLastGreenPromoteSha(commitsAhead, greenShas) {
  for (const sha of commitsAhead) {
    if (greenShas.has(sha)) return sha
  }
  return null
}

/**
 * @param {Array<{ headSha: string; status: string; conclusion: string | null }>} stageRuns
 * @returns {Set<string>}
 */
export function greenCiStageHeadShas(stageRuns) {
  const green = new Set()
  for (const run of stageRuns) {
    if (run.status === 'completed' && run.conclusion === 'success') {
      green.add(run.headSha)
    }
  }
  return green
}
