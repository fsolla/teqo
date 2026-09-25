/**
 * Pure helpers for `scripts/worktree.mjs` — branch naming derived from the
 * claim-queue issue, shared with the unit tests. Naming: `<code>-<slug>`
 * where `code` is the frontmatter `id` (ex. `C15`) and `slug` is the pt-BR
 * title slugified with the repo's `src/lib/slug.ts` (accents stripped,
 * non-alphanumeric → `-`).
 */

import { slugify } from '../../src/lib/slug.ts'
import { assertKnownFlags, MODEL_VARIANT, SKILL_AUTO_FLAG } from './agent-session.mjs'

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
 * global da máquina, via Ctrl+T. OPS101: o fallback passou a usar o nome
 * canônico `deepseek/deepseek-flash` (DeepSeek V4.1 Flash, lançado em
 * 2026-09-10; o alias legado segue servido ao preço Flash, mas pode sumir
 * sem aviso).
 */
export const OPENCODE_PRESET_MODEL =
  process.env.OPENCODE_WORKTREE_MODEL || 'deepseek/deepseek-flash'

/**
 * Per-invocation model map — fixed menu of named flags (OPS93; values
 * corrected in OPS95 after the OPS93 delivery shipped wrong IDs; OPS100 adds
 * `--glm` and `--free`). OPS112 corrects `--go` → DeepSeek V4.1 Flash and
 * `--zen` → Muse Spark 1.3 Free. OPS129 updates `--zen` → Space Bunny Free
 * and `--free` → Space Bunny Alpha.
 * The directive picks `WORKTREE_MODEL_MAP[flag]` when
 * a single flag is present, otherwise falls back to `OPENCODE_PRESET_MODEL`.
 * No `--variant` is emitted in the directive (the TUI yargs rejects the flag —
 * OPS95). OPS127: the session is created in variant `max` — it rides the
 * `POST /session` body and the `opencode run` argv of the driver/headless
 * (`MODEL_VARIANT` in `./agent-session.mjs`), never the directive/attach.
 */
export const WORKTREE_MODEL_MAP = {
  cheap: 'cheapestinference/deepseek-v4-flash',
  pro: 'deepseek/deepseek-v4-pro',
  zen: 'opencode/space-bunny-free',
  go: 'opencode-go/deepseek-v4.1-flash',
  alibaba: 'alibaba-token-plan/deepseek-v4-flash',
  glm: 'opencode-go/glm-5.3-flash',
  free: 'openrouter/stealth/space-bunny-alpha',
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

const hasBag = (bag) => typeof bag === 'string' && bag.trim().length > 0

/**
 * Accepted flag NAMES per worktree subcommand (OPS122). Names only — the
 * `=`/value form stays `parseArgs`' concern. Before OPS122 an unknown flag
 * (`--auto`, a typo) parsed to `true` and was silently dropped; now the CLI
 * fails high with a neighbor suggestion, mirroring OPS110-F1. `stay` is kept
 * for `kill` so its specific "não se aplica" message still fires.
 */
export const WORKTREE_FLAG_ALLOWLIST = {
  next: ['issue', 'stay', 'no-migrate', 'auto', ...WORKTREE_MODEL_FLAGS],
  plan: ['stay', 'no-migrate', 'auto', ...WORKTREE_MODEL_FLAGS],
  new: ['stay', 'no-migrate', 'auto', ...WORKTREE_MODEL_FLAGS],
  fix: ['stay', 'no-migrate', 'headless', 'directive', 'auto', ...WORKTREE_MODEL_FLAGS],
  kill: ['force', 'stay'],
}

/**
 * Fail high on any flag the worktree subcommand does not accept. Delegates the
 * message/suggestion rule to `assertKnownFlags` (single owner, shared with the
 * session CLI). Unknown subcommands return silently — the CLI prints the usage.
 * @param {{ subcommand?: string | null, flags?: Record<string, unknown> }} [options]
 */
export const validateWorktreeFlags = ({ subcommand = null, flags = {} } = {}) => {
  const accepted = WORKTREE_FLAG_ALLOWLIST[subcommand]
  if (!accepted) return
  assertKnownFlags({ flags, accepted })
}

/**
 * The human's `--auto` (opt-out of the skill GATE) only makes sense when there
 * IS a skill invocation to auto-submit. Deterministic matrix, checked BEFORE
 * any git/provisioning so an unhonorable flag never leaves an orphan worktree:
 * `next`/`fix` always; `plan` only with a bag (OPS119 keeps it driverless
 * otherwise); `new` never; `--stay` never (the launch is suppressed); outside
 * the interactive terminal never (the `/worktree` command only applies `cd`, so
 * the launch — and thus the auto-submit — does not exist there). The purpose
 * matrix is checked before the terminal so `new --auto` reports the actionable
 * "neutra" message. Throws a clear message pointing at the valid form.
 * @param {{ purpose?: string | null, bag?: string | null, stay?: boolean, headless?: boolean, terminal?: boolean }} [options]
 */
export const assertSkillAutoSupported = ({
  purpose = null,
  bag = null,
  stay = false,
  headless = false,
  terminal = true,
} = {}) => {
  if (headless) {
    throw new Error(
      '`--headless` (auto-unblock) roda `opencode run --command` sem a invocation de skill — `--auto` não se aplica. Remova a flag.',
    )
  }
  if (stay) {
    throw new Error(
      '`--stay` suprime o launch — `--auto` ficaria sem efeito. Remova `--auto` ou `--stay`.',
    )
  }
  const supported =
    purpose === 'next' || (purpose === 'fix' && hasBag(bag)) || (purpose === 'plan' && hasBag(bag))
  if (!supported) {
    if (purpose === 'plan') {
      throw new Error(
        '`--auto` exige um comando para auto-submeter: `plan` sem bag abre a sessão sem driver (OPS119). Use `plan <bag>` ou remova `--auto`.',
      )
    }
    if (purpose === 'new') {
      throw new Error(
        '`new` é uma sessão neutra, sem skill — `--auto` não se aplica. Remova a flag ou use `next`/`plan`/`fix`.',
      )
    }
    throw new Error(`\`--auto\` não se aplica a \`${purpose}\`.`)
  }
  if (!terminal) {
    throw new Error(
      '`--auto` só é honrado no terminal interativo — o comando `/worktree` só aplica o `cd`, sem launch. Rode `pnpm worktree` no terminal ou remova `--auto`.',
    )
  }
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
  if (!hasBag(bag)) {
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
 * (`WORKTREE_TERMINAL=1`): `launch node scripts/agent-session.mjs start
 * --purpose=<P> --dir=<dir> --model=<preset|map> [--issue=<N>]
 * [--argument="<bag>"]` (OPS110 — o launch deixa de abrir um TUI local dono da
 * sessão e passa a delegar ao `scripts/agent-session.mjs`, que sobe/anexa no
 * servidor compartilhado: o run sobrevive ao fechamento do terminal e pode ser
 * reatado de outro dispositivo). O mapa purpose→skill e a montagem do comando
 * vivem no dono do ciclo de vida (`scripts/lib/agent-session.mjs`,
 * `purposeInvocation`). OPS95 continua: sem `--variant`; modelo vem do mapa
 * `WORKTREE_MODEL_MAP` quando a flag `--cheap/--pro/--zen/--go/--alibaba/--glm/--free`
 * está presente, senão do preset.
 *
 * The shell function (`.agents/shell/worktree.sh`) applies the `cd` first, then
 * tokenizes and executes this line (xargs — quote-aware, never eval) — the dir
 * is always `<root without spaces>/<slugified branch>`, so the line never needs
 * quoting for the path. `next` with an `issueNumber` carries `--issue=<N>`
 * (OPS33: the launch delivers the claimed issue to the agent; the skill reads
 * the rest from GitHub), `fix` (bug description) and `plan` (opening message)
 * with an `argument` carry `--argument="<bag>"` (the text arrives with the
 * skill; quotes/backslashes are stripped because the shell layer tokenizes
 * with xargs, which does not honor backslash escapes). Returns `null` outside
 * the terminal so the `/worktree` opencode command never launches a nested TUI.
 * `sessionScript` é o caminho do CLI de sessão — `worktree.mjs` passa o
 * ABSOLUTO do checkout que emitiu a diretiva (worktrees reabertos/criados
 * antes do merge não têm o arquivo novo; o relativo apontaria para o branch
 * errado). O default relativo existe para os specs.
 *
 * OPS122: `skillAuto` (o `--auto` do HUMANO) vira `--skill-auto` no argv do
 * `start` — nome interno distinto do `--auto` de PERMISSÕES que o `driverArgs`
 * emite para o `opencode run` (são coisas diferentes). O CLI de sessão o
 * transpõe para o texto da invocation (`purposeInvocation`).
 * @param {{ dir: string, purpose: string, terminal?: boolean, issueNumber?: number | null, model?: string | null, argument?: string | null, sessionScript?: string, skillAuto?: boolean }} options
 */
export const opencodeLaunchDirective = ({
  dir,
  purpose,
  terminal = false,
  issueNumber = null,
  model = null,
  argument = null,
  sessionScript = 'scripts/agent-session.mjs',
  skillAuto = false,
}) => {
  if (!terminal) return null
  const selectedModel = model ?? OPENCODE_PRESET_MODEL
  const args = [
    'node',
    sessionScript,
    'start',
    `--purpose=${purpose}`,
    `--dir=${dir}`,
    `--model=${selectedModel}`,
  ]
  if (skillAuto) args.push(`--${SKILL_AUTO_FLAG}`)
  // The issue suffix belongs to `next` alone — `plan`/`new`/`fix` never carry
  // a claimed issue (fail-safe: a stray issueNumber must not break them).
  if (purpose === 'next' && issueNumber) args.push(`--issue=${issueNumber}`)
  // The bag suffix belongs to `fix` (bug description) and `plan` (opening
  // message) — the text arrives with the skill. JSON.stringify quotes the
  // value (it carries spaces); xargs strips the quotes at execution time.
  if (purpose === 'fix' || purpose === 'plan') {
    const sanitized = typeof argument === 'string' ? argument.replace(/["\\]/g, '').trim() : ''
    if (sanitized) args.push(`--argument=${JSON.stringify(sanitized)}`)
  }
  return `launch ${args.join(' ')}`
}

/**
 * Headless launch for the OPS106 auto-unblock wrapper: the same `/bug-fix`
 * contract as `fix`, no TUI and no `--prompt` (the headless CLI has
 * `--command` as a first-class option — the report rides as the message/args).
 * The directive is written to a FILE, never stdout: the provisioning path
 * inherits stdio from git/pnpm/seed children, so stdout cannot be a clean JSON
 * channel. Emitted by `scripts/worktree.mjs fix --headless --directive <path>`.
 */
export const OPENCODE_HEADLESS_COMMAND = 'bug-fix'

/**
 * opencode `run` argv for the auto-unblock agent (model + variant + report, no
 * shell). `--variant` (OPS127) rides before the positional report — after it,
 * it would be swallowed into the report argument. Unlike the attached TUI,
 * `opencode run` accepts the flag.
 * @param {{ model?: string, report?: string, command?: string }} [options]
 */
export const opencodeHeadlessArgs = ({
  model,
  report,
  command = OPENCODE_HEADLESS_COMMAND,
} = {}) => {
  if (typeof model !== 'string' || model.length === 0) {
    throw new Error('opencodeHeadlessArgs: model ausente')
  }
  if (typeof report !== 'string' || report.trim().length === 0) {
    throw new Error('opencodeHeadlessArgs: report vazio')
  }
  return [
    'opencode',
    'run',
    '--model',
    model,
    '--variant',
    MODEL_VARIANT,
    '--auto',
    '--command',
    command,
    report,
  ]
}

/**
 * Machine-readable `--headless` directive persisted for the wrapper.
 * @param {{ dir?: string, branch?: string, model?: string, report?: string }} [options]
 */
export const headlessDirective = ({ dir, branch, model, report } = {}) => {
  if (typeof dir !== 'string' || dir.length === 0) {
    throw new Error('headlessDirective: dir ausente')
  }
  return { dir, branch: branch ?? '', model, argv: opencodeHeadlessArgs({ model, report }) }
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

const NAMESPACE_LAUNCH = new Map([
  ['plan', { noun: 'de planejamento', labelPrefix: 'lote', carriesBag: true }],
  ['new', { noun: 'neutro', labelPrefix: 'bag', carriesBag: false }],
  ['fix', { noun: 'de correção de bug', labelPrefix: 'bug', carriesBag: true }],
])

/**
 * Launch descriptor for a namespace worktree (`plan`/`new`/`fix`) — the pure
 * purpose→options mapping the runner (`cmdNamespaceBranch`) derives from
 * `purpose`+`bag` instead of receiving as droppable parameters. `noun` and
 * `sessionLabel` are the human labels of the provisioning log (`lote "…"`/
 * `bag "…"`/`bug "…"`, or `sequencial` without a bag); `argument` rides the
 * launch directive only for the purposes whose skill accepts a bag (`plan`
 * opening message, `fix` bug description) — `new` is neutral and never carries
 * one. Unknown purposes throw: a purpose without a descriptor is a wiring
 * error, never a silently invented label.
 * @param {{ purpose?: string | null, bag?: string | null }} [options]
 */
export const namespaceLaunchDescriptor = ({ purpose = null, bag = null } = {}) => {
  const entry = NAMESPACE_LAUNCH.get(purpose)
  if (!entry) {
    throw new Error(`namespaceLaunchDescriptor: purpose desconhecido "${purpose}"`)
  }
  return {
    noun: entry.noun,
    sessionLabel: hasBag(bag) ? `${entry.labelPrefix} "${bag}"` : 'sequencial',
    argument: entry.carriesBag ? bag : null,
  }
}
