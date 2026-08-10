/**
 * Pure helpers for `scripts/worktree.mjs` — branch naming derived from the
 * claim-queue issue, shared with the unit tests. Naming: `<code>-<slug>`
 * where `code` is the frontmatter `id` (ex. `C15`) and `slug` is the pt-BR
 * title slugified with the repo's `src/lib/slug.ts` (accents stripped,
 * non-alphanumeric → `-`).
 */

import { slugify } from '../../src/lib/slug.ts'

/**
 * Prefix of every `/plan-issue` planning-worktree branch (`pnpm worktree
 * plan`). Lowercase-led `plans/…`, so it can never collide with a `next`
 * branch — `<Code>-<slug>` is always uppercase-led — neither in branch name
 * nor, structurally, in the port/slot space derived from the branch.
 */
export const PLAN_BRANCH_PREFIX = 'plans/plan-issue'

/** Env var the interactive-terminal `worktree()` function sets to request the opencode launch. */
export const WORKTREE_TERMINAL_ENV = 'TEQO_WORKTREE_TERMINAL'

/** Preset model for the opencode launch — change the preset by editing this constant. */
export const OPENCODE_PRESET_MODEL = 'deepseek/deepseek-v4-flash'

/**
 * Skill command sent as the launch's initial message per purpose. `next`
 * sends `/work-issue` (the OPS25 command executes the full cycle); `plan`
 * and `new` send nothing — the opencode CLI's `--prompt` always auto-submits,
 * there is no prefill-without-submit flag, and the TUI autocomplete completes
 * `/plan-` instead (`new` is just "apenas conversar", no skill at all; gap
 * registered for the opencode repo). Switch `plan` to `/plan-issue` here if
 * the CLI ever gains prefill-without-submit.
 */
export const OPENCODE_SKILL_COMMAND_BY_PURPOSE = { next: '/work-issue', plan: null, new: null }

/**
 * Prefix of every neutral-worktree branch (`pnpm worktree new`). Lowercase-led
 * `work/…` — structurally disjoint from `next`'s uppercase-led `<Code>-<slug>`
 * and from `plan`'s `plans/plan-issue-…`, in branch name and slot space alike.
 */
export const WORK_BRANCH_PREFIX = 'work'

/** Total branch-name budget — mirrors `branchNameForIssue` (60). */
const NAMESPACE_BRANCH_MAX_LENGTH = 60

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

/**
 * Shared branch naming for namespace worktrees NOT tied to the claim queue
 * (`plan`, `new`). Every invocation must land on a DIFFERENT branch so
 * parallel sessions coexist:
 *  - `bag` given → `<prefix><slug>`; if that name is already taken,
 *    `<prefix><slug>-2`, `-3`, …
 *  - no `bag` → the next free sequential `<prefix>1`, `<prefix>2`, …
 * `prefix` carries the namespace AND its separator (`plans/plan-issue-` for
 * plan, `work/` for new), so the sequential and bag forms share one spelling
 * per namespace. `taken` = branch short-names already alive (local refs +
 * origin); when a name is free it is reused only as a name-free slot — the
 * branch is created fresh from `origin/main` each time. Both namespaces are
 * lowercase-led, so neither can collide with `next`'s uppercase-led
 * `<Code>-<slug>` branches.
 */
const namespaceBranchName = ({ prefix, bag = '', taken = new Set(), fallback }) => {
  const hasBag = typeof bag === 'string' && bag.trim().length > 0

  if (!hasBag) {
    for (let n = 1; ; n += 1) {
      const candidate = `${prefix}${n}`
      if (!taken.has(candidate)) return candidate
    }
  }

  const slug = slugify(bag) || fallback
  const base = `${prefix}${slug.slice(0, NAMESPACE_BRANCH_MAX_LENGTH - prefix.length)}`
  if (!taken.has(base)) return base

  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`
    const keep = Math.max(1, NAMESPACE_BRANCH_MAX_LENGTH - prefix.length - suffix.length)
    const candidate = `${prefix}${slug.slice(0, keep)}${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * Launch directive for the opencode TUI, printed by `worktree next`/`plan`
 * right before the `cd <dir>` line when called from the interactive terminal
 * (`WORKTREE_TERMINAL=1`): `launch opencode <dir> --model <preset> --auto
 * [--prompt <command>]`. The shell function (`.agents/shell/worktree.sh`)
 * applies the `cd` first, then word-splits and executes this line — the dir
 * is always `<root without spaces>/<slugified branch>`, so the line never
 * needs quoting. Returns `null` outside the terminal so the `/worktree`
 * opencode command never launches a nested TUI.
 */
export const opencodeLaunchDirective = ({ dir, purpose, terminal = false }) => {
  if (!terminal) return null
  const prompt = OPENCODE_SKILL_COMMAND_BY_PURPOSE[purpose]
  const args = [dir, '--model', OPENCODE_PRESET_MODEL, '--auto']
  if (prompt) args.push('--prompt', prompt)
  return `launch opencode ${args.join(' ')}`
}

/**
 * Branch for a `/plan-issue` planning worktree — see `namespaceBranchName`
 * (namespace `plans/plan-issue-…`, fallback label `plano`).
 */
export const planBranchName = ({ bag = '', taken = new Set() }) =>
  namespaceBranchName({ prefix: `${PLAN_BRANCH_PREFIX}-`, bag, taken, fallback: 'plano' })

/**
 * Branch for a neutral worktree (`pnpm worktree new`) — see
 * `namespaceBranchName` (namespace `work/…`, fallback label `work`).
 */
export const workBranchName = ({ bag = '', taken = new Set() }) =>
  namespaceBranchName({ prefix: `${WORK_BRANCH_PREFIX}/`, bag, taken, fallback: 'work' })
