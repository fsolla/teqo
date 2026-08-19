/**
 * Pure decision logic for the GitHub PR auto-merge safety net
 * (scripts/github-pr-automerge.mjs). Unit-tested in
 * tests/unit/githubPrFlow.unit.spec.ts — the OPS57 (draft veto) / OPS64
 * (never merge on red CI) pins ported to the GitHub mechanism.
 *
 * GitHub's native auto-merge only fires with the required checks green, so
 * the safety net's only real decisions are: skip (non-main base, draft veto,
 * already merged) or mark-ready (cursor/* draft) before arming auto-merge.
 */

export const CURSOR_HEAD_PREFIX = 'cursor/'

/** OPS57: only `cursor/*` drafts get force-marked ready — any other draft is the actor's veto. */
export const isCursorHead = (ref) => typeof ref === 'string' && ref.startsWith(CURSOR_HEAD_PREFIX)

/**
 * @param {object|null} pr - normalized PR from github-api (or null)
 * @returns {{ action: 'skip' | 'mark-ready' | 'enable-auto-merge', reason: string }}
 */
export const decideAutomergeAction = (pr) => {
  if (!pr) return { action: 'skip', reason: 'pr-inexistente' }
  if (pr.merged) return { action: 'skip', reason: 'ja-mergeada' }
  if (pr.state !== 'OPEN') return { action: 'skip', reason: 'pr-nao-aberta' }
  if (pr.base?.ref !== 'main') return { action: 'skip', reason: 'base-nao-main' }
  if (pr.draft) {
    if (isCursorHead(pr.head?.ref)) return { action: 'mark-ready', reason: 'draft-cursor' }
    return { action: 'skip', reason: 'draft-veto' }
  }
  return { action: 'enable-auto-merge', reason: 'ready' }
}
