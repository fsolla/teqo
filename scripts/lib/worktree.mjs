/**
 * Pure helpers for `scripts/worktree.mjs` — branch naming derived from the
 * claim-queue issue, shared with the unit tests. Naming: `<code>-<slug>`
 * where `code` is the frontmatter `id` (ex. `C15`) and `slug` is the pt-BR
 * title slugified with the repo's `src/lib/slug.ts` (accents stripped,
 * non-alphanumeric → `-`).
 */

import { slugify } from '../../src/lib/slug.ts'

/** Strip the leading `<code> — ` (or any dash variant) off a title. */
const stripCodePrefix = (title, code) => {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return title.replace(new RegExp(`^${escaped}\\s*[—–:-]?\\s*`), '')
}

/**
 * `code` = frontmatter `id` (falls back to the leading `ID — ` token of the
 * title); `subject` = the title with that prefix removed.
 */
export const issueCodeAndSubject = (issue) => {
  const title = issue.title ?? ''
  const code = typeof issue.meta?.id === 'string' && issue.meta.id.length > 0 ? issue.meta.id : null
  const subject = code
    ? stripCodePrefix(title, code)
    : title.replace(/^[A-Za-z0-9+]+\s*[—–:-]?\s*/, '')
  return { code, subject }
}

/**
 * `<code>-<slug>` truncated to `maxLength` total characters (always keeping
 * the code). Throws when the issue has no id — fail loudly, never invent.
 */
export const branchNameForIssue = (issue, maxLength = 60) => {
  const { code, subject } = issueCodeAndSubject(issue)
  if (!code) {
    throw new Error(`Issue sem frontmatter id: #${issue.number} ${issue.title}`)
  }
  const slug = slugify(subject) || 'issue'
  const full = `${code}-${slug}`
  if (full.length <= maxLength) return full
  const keep = Math.max(1, maxLength - code.length - 1)
  return `${code}-${slug.slice(0, keep)}`
}
