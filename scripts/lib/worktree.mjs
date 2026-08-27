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

/**
 * Preset model for the opencode launch — fallback comum aos 3 repos do fluxo
 * (infra-solla, teqo, iara-pwa). Override sem editar código: global via
 * `export OPENCODE_WORKTREE_MODEL=…`, ou por repo na chave
 * `OPENCODE_WORKTREE_MODEL` da `.forgejo/worktree.env`. Ex-OPS78/OPS82: o
 * preset era o flavor `-0731` via Vercel AI Gateway; voltou ao provider
 * direto porque o gateway está sem créditos (erros "positive credit balance"
 * em 24/08/2026) e porque unificar o default reduz a sobrescrita confusa de
 * seleção de modelo do TUI (opencode issues #8349/#13456). OPS93: com
 * `--cheap/--pro/--zen/--go/--alibaba/--glm/--free` o mapa `WORKTREE_MODEL_MAP`
 * escolhe o modelo por invocação; sem flag o preset permanece. OPS95: sem
 * `--variant` na diretiva (o TUI rejeita o flag) — variantes ficam na config
 * global da máquina, via Ctrl+T.
 */
export const OPENCODE_PRESET_MODEL =
  process.env.OPENCODE_WORKTREE_MODEL || 'deepseek/deepseek-v4-flash'

/**
 * Per-invocation model map — fixed menu of named flags (OPS93; values
 * corrected in OPS95 after the OPS93 delivery shipped wrong IDs; OPS100 adds
 * `--glm` and `--free`). The directive picks `WORKTREE_MODEL_MAP[flag]` when
 * a single flag is present, otherwise falls back to `OPENCODE_PRESET_MODEL`.
 * No `--variant` is emitted (the TUI yargs rejects the flag — OPS95):
 * variants live on the machine's global config, selectable via Ctrl+T
 * (`opencode run --variant max` remains the headless path).
 */
export const WORKTREE_MODEL_MAP = {
  cheap: 'cheapestinference/deepseek-v4-flash',
  pro: 'deepseek/deepseek-v4-pro',
  zen: 'opencode-go/ox-alpha-free',
  go: 'opencode-go/hy3',
  alibaba: 'alibaba-token-plan/deepseek-v4-flash',
  glm: 'opencode-go/glm-5.3-flash',
  free: 'openrouter/openrouter/free',
}

/** Set of flag names that select a model (keys of WORKTREE_MODEL_MAP). */
export const WORKTREE_MODEL_FLAGS = new Set(Object.keys(WORKTREE_MODEL_MAP))

/**
 * Resolve the model for a parsed `flags` bag (from `parseArgs`). At most one
 * model flag may be present — multiple → throw (fail-high, never guess).
 * No flag → `OPENCODE_PRESET_MODEL`.
 */
export const resolveWorktreeModel = (flags = {}) => {
  const active = [...WORKTREE_MODEL_FLAGS].filter((flag) => flags[flag])
  if (active.length > 1) {
    throw new Error(
      `Flags de modelo conflitantes: --${active.join(' --')} (use apenas um de --cheap/--pro/--zen/--go/--alibaba/--glm/--free)`,
    )
  }
  if (active.length === 1) return WORKTREE_MODEL_MAP[active[0]]
  return OPENCODE_PRESET_MODEL
}

/**
 * Skill command sent as the launch's initial message per purpose. `next`
 * sends `/work-issue` (the OPS25 command executes the full cycle; the OPS33
 * launch appends `--issue <N>` — the claimed issue — via
 * `opencodeLaunchDirective`); `plan` sends `/plan-issue` (OPS31 — auto-submit
 * is the real need of the flow), `fix` sends `/bug-fix` (with the bug
 * description as the argument) and `new` sends nothing ("apenas conversar",
 * no skill at all). The opencode CLI's `--prompt` always auto-submits, there
 * is no prefill-without-submit flag; prefill stays an upstream-only feature
 * request (proposition annotated), not a Teqo fallback.
 */
export const OPENCODE_SKILL_COMMAND_BY_PURPOSE = {
  next: '/work-issue',
  plan: '/plan-issue',
  new: null,
  fix: '/bug-fix',
}

/**
 * Prefix of every neutral-worktree branch (`pnpm worktree new`). Lowercase-led
 * `work/…` — structurally disjoint from `next`'s uppercase-led `<Code>-<slug>`
 * and from `plan`'s `plans/plan-issue-…`, in branch name and slot space alike.
 */
export const WORK_BRANCH_PREFIX = 'work'

/**
 * Prefix of every bug-fix worktree branch (`pnpm worktree fix`). Lowercase-led
 * `fix/…` — structurally disjoint from `next`'s uppercase-led `<Code>-<slug>`,
 * from `plan`'s `plans/plan-issue-…` and from `new`'s `work/…`, in branch name
 * and slot space alike.
 */
export const FIX_BRANCH_PREFIX = 'fix'

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
 * (`WORKTREE_TERMINAL=1`): `launch opencode <dir> --model <preset|map>
 * --auto [--prompt "<command>"]` (OPS95: no `--variant` — the TUI yargs
 * rejects the unknown flag and the helper prints instead of opening; modelo
 * vem do mapa `WORKTREE_MODEL_MAP` quando a flag `--cheap/--pro/--zen/
 * --go/--alibaba/--glm/--free` está presente, senão do preset). The shell function
 * (`.agents/shell/worktree.sh`) applies the `cd` first, then tokenizes and
 * executes this line (xargs — quote-aware, never eval) — the dir is always
 * `<root without spaces>/<slugified branch>`, so the line never needs quoting
 * for the path. `next` with an `issueNumber` sends `/work-issue --issue <N>`
 * (OPS33: the launch delivers the claimed issue to the agent; the skill reads
 * the rest from GitHub), `fix` with an `argument` sends `/bug-fix <argument>`
 * (the bug description arrives with the skill), the prompt value is quoted in
 * the line because it now carries a space. Returns `null` outside the terminal
 * so the `/worktree` opencode command never launches a nested TUI.
 * @param {{ dir: string, purpose: string, terminal?: boolean, issueNumber?: number | null, model?: string | null, argument?: string | null }} options
 */
export const opencodeLaunchDirective = ({
  dir,
  purpose,
  terminal = false,
  issueNumber = null,
  model = null,
  argument = null,
}) => {
  if (!terminal) return null
  const prompt = OPENCODE_SKILL_COMMAND_BY_PURPOSE[purpose]
  const selectedModel = model ?? OPENCODE_PRESET_MODEL
  const args = [dir, '--model', selectedModel, '--auto']
  if (prompt) {
    // The issue suffix belongs to `next` alone — `plan`/`new`/`fix` never carry
    // a claimed issue (fail-safe: a stray issueNumber must not break them).
    const issueSuffix = purpose === 'next' && issueNumber ? `--issue ${issueNumber}` : null
    // The bag suffix belongs to `fix` alone — the bug description arrives with
    // the skill. Quotes/backslashes are stripped: the shell layer tokenizes the
    // directive with xargs, which does not honor backslash escapes.
    const sanitized = typeof argument === 'string' ? argument.replace(/["\\]/g, '').trim() : null
    const bagSuffix = purpose === 'fix' && sanitized ? sanitized : null
    const value = [prompt, issueSuffix, bagSuffix].filter(Boolean).join(' ')
    // JSON.stringify quotes the value — the directive carries spaces now.
    args.push('--prompt', JSON.stringify(value))
  }
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

/**
 * Branch for a bug-fix worktree (`pnpm worktree fix`) — see
 * `namespaceBranchName` (namespace `fix/…`, fallback label `fix`).
 */
export const fixBranchName = ({ bag = '', taken = new Set() }) =>
  namespaceBranchName({ prefix: `${FIX_BRANCH_PREFIX}/`, bag, taken, fallback: 'fix' })
